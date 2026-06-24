import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logCollectionAddActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── CSV row parser (handles quoted fields with commas and escaped quotes) ─────

function parseCsvRow(line: string): string[] {
  const cols: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let val = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { val += '"'; i += 2; }
          else { i++; break; }
        } else {
          val += line[i++];
        }
      }
      cols.push(val);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) { cols.push(line.slice(i)); break; }
      cols.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return cols;
}

// Discogs standard export columns:
// 0: Catalog#  1: Artist  2: Title  3: Label  4: Format  5: Rating
// 6: Released  7: release_id  8: CollectionFolder  9: Date Added
// 10: Collection Media Condition  11: Collection Sleeve Condition  12: Collection Notes

interface ParsedRow {
  releaseId: number;
  artist: string;
  title: string;
  label: string | null;
  format: string | null;
  rating: number | null;
  released: number | null;
  folder: string | null;
  dateAdded: string | null;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  notes: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "CSV must be under 10 MB." }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }
  const MAX_ROWS = 20_000; // a header row plus a generously large collection
  if (lines.length - 1 > MAX_ROWS) {
    return NextResponse.json({ error: `CSV has too many rows — limit is ${MAX_ROWS.toLocaleString()}.` }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let enrichmentPending = 0;
  // Accumulated across all batches so the first-ever-import check (in
  // logCollectionAddActivity, called once after the loop) sees the whole
  // import as a single unit rather than re-evaluating per 100-row batch.
  const allNewRecordIds: string[] = [];

  const BATCH = 100;

  // Process in batches to avoid loading all parsed rows at once
  for (let batchStart = 1; batchStart < lines.length; batchStart += BATCH) {
    const batchLines = lines.slice(batchStart, batchStart + BATCH);

    // Parse each line in this batch
    const parsedRows: ParsedRow[] = [];
    for (const line of batchLines) {
      if (!line.trim()) continue;
      try {
        const cols = parseCsvRow(line);
        const releaseId = parseInt(cols[7] ?? "", 10);
        if (isNaN(releaseId)) { failed++; continue; }
        const artist = cols[1]?.trim();
        const title  = cols[2]?.trim();
        if (!artist || !title) { failed++; continue; }
        parsedRows.push({
          releaseId,
          artist,
          title,
          label:          cols[3]?.trim() || null,
          format:         cols[4]?.trim() || null,
          rating:         parseInt(cols[5] ?? "", 10) || null,
          released:       parseInt(cols[6] ?? "", 10) || null,
          folder:         cols[8]?.trim() || null,
          dateAdded:      cols[9]?.trim() || null,
          mediaCondition: cols[10]?.trim() || null,
          sleeveCondition: cols[11]?.trim() || null,
          notes:          cols[12]?.trim() || null,
        });
      } catch {
        failed++;
      }
    }

    if (parsedRows.length === 0) continue;

    // 1. Find which release_ids already exist in records
    const releaseIdStrs = parsedRows.map(r => r.releaseId.toString());
    const existingMap = new Map<string, string>(); // discogs_id → record uuid

    const { data: existingRecords } = await supabase
      .from("records")
      .select("id, discogs_id")
      .in("discogs_id", releaseIdStrs);

    for (const rec of existingRecords ?? []) {
      if (rec.discogs_id) existingMap.set(rec.discogs_id, rec.id);
    }

    // 2. Insert records that don't exist yet
    const toInsert = parsedRows.filter(r => !existingMap.has(r.releaseId.toString()));
    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from("records")
        .insert(toInsert.map(r => ({
          discogs_id: r.releaseId.toString(),
          artist:     r.artist,
          album:      r.title,
          label:      r.label,
          format:     r.format,
          year:       r.released,
          cover_url:  null,
        })))
        .select("id, discogs_id");

      if (insertErr) {
        // Race condition or duplicate — re-fetch to get IDs
        const { data: refetched } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("discogs_id", toInsert.map(r => r.releaseId.toString()));
        for (const rec of refetched ?? []) {
          if (rec.discogs_id) existingMap.set(rec.discogs_id, rec.id);
        }
      } else {
        for (const rec of inserted ?? []) {
          if (rec.discogs_id) existingMap.set(rec.discogs_id, rec.id);
        }
      }
    }

    // 3. Find which records are already linked to this user
    const resolvedIds = parsedRows
      .map(r => existingMap.get(r.releaseId.toString()))
      .filter((id): id is string => id !== undefined);

    const alreadyLinked = new Set<string>();
    for (let i = 0; i < resolvedIds.length; i += BATCH) {
      const { data: links } = await supabase
        .from("user_records")
        .select("record_id")
        .eq("user_id", user.id)
        .in("record_id", resolvedIds.slice(i, i + BATCH));
      for (const l of links ?? []) alreadyLinked.add(l.record_id);
    }

    // 4. Insert new user_records links with CSV metadata
    const toLink = parsedRows.filter(r => {
      const recId = existingMap.get(r.releaseId.toString());
      return recId && !alreadyLinked.has(recId);
    });

    skipped += resolvedIds.length - toLink.length;

    if (toLink.length > 0) {
      const linkRows = toLink.map(r => ({
        user_id:             user.id,
        record_id:           existingMap.get(r.releaseId.toString())!,
        media_condition:     r.mediaCondition,
        sleeve_condition:    r.sleeveCondition,
        notes:               r.notes,
        rating:              r.rating,
        folder_name:         r.folder,
        date_added:          r.dateAdded ? new Date(r.dateAdded).toISOString() : null,
        enrichment_status:   "pending",
      }));

      const { error: linkErr } = await (supabase as any)
        .from("user_records")
        .insert(linkRows);

      if (!linkErr) {
        imported += toLink.length;
        enrichmentPending += toLink.length;
        allNewRecordIds.push(...linkRows.map(r => r.record_id));
      } else {
        console.error("[csv-import] user_records insert error:", linkErr.message);
        failed += toLink.length;
      }
    }
  }

  await logCollectionAddActivity(supabase, user.id, allNewRecordIds);

  // Fire-and-forget enrichment trigger (best-effort)
  const enrichUrl = new URL("/api/collection/csv-enrich", request.url).toString();
  fetch(enrichUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rekodo-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify({ userId: user.id }),
  }).catch(() => {});

  return NextResponse.json({ success: true, imported, skipped, failed, enrichmentPending });
}
