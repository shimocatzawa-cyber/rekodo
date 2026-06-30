import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logCollectionAddActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── CSV parser (handles quoted fields with commas, escaped quotes, and
// embedded newlines) ───────────────────────────────────────────────────────
// Operates on the whole file, not line-by-line: Discogs's "Collection Notes"
// column is free text, and a note that itself spans multiple lines means the
// CSV file has a literal newline INSIDE a quoted field. Pre-splitting the
// file on \n (as this used to) breaks that single logical row into two
// fragments wherever that happens — usually surfacing as two rows in the
// "couldn't be read" count instead of one correctly-parsed row.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; } // normalize CRLF — \n (below) ends the row
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  // Final field/row if the file doesn't end with a trailing newline
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  return rows;
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
  const rows = parseCsv(text).filter(cols => cols.some(c => c.trim()));

  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }
  const MAX_ROWS = 20_000; // a header row plus a generously large collection
  if (rows.length - 1 > MAX_ROWS) {
    return NextResponse.json({ error: `CSV has too many rows — limit is ${MAX_ROWS.toLocaleString()}.` }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let enrichmentPending = 0;
  let conditionsBackfilled = 0;
  // Accumulated across all batches so the first-ever-import check (in
  // logCollectionAddActivity, called once after the loop) sees the whole
  // import as a single unit rather than re-evaluating per 100-row batch.
  const allNewRecordIds: string[] = [];

  const BATCH = 100;

  // Process in batches to avoid loading all parsed rows at once
  for (let batchStart = 1; batchStart < rows.length; batchStart += BATCH) {
    const batchRows = rows.slice(batchStart, batchStart + BATCH);

    // Parse each row in this batch
    const parsedRows: ParsedRow[] = [];
    for (const cols of batchRows) {
      try {
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

    // 3. Find which records are already linked to this user — and what their
    // current condition fields are, so an already-linked row can repair a
    // missing condition value instead of being skipped outright. This is what
    // lets the same upload double as a recovery tool (e.g. after the sync bug
    // that nulled out condition data) and a bulk-import fallback for existing
    // collectors when Discogs sync/the API itself is unavailable, not just a
    // new-user onboarding path.
    const resolvedIds = parsedRows
      .map(r => existingMap.get(r.releaseId.toString()))
      .filter((id): id is string => id !== undefined);

    const linkByRecordId = new Map<string, { id: string; media_condition: string | null; sleeve_condition: string | null }>();
    for (let i = 0; i < resolvedIds.length; i += BATCH) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: links } = await (supabase as any)
        .from("user_records")
        .select("id, record_id, media_condition, sleeve_condition")
        .eq("user_id", user.id)
        .in("record_id", resolvedIds.slice(i, i + BATCH));
      for (const l of links ?? []) linkByRecordId.set(l.record_id, l);
    }

    // 4. Insert new user_records links with CSV metadata
    const toLink = parsedRows.filter(r => {
      const recId = existingMap.get(r.releaseId.toString());
      return recId && !linkByRecordId.has(recId);
    });

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

    // 5. Already-linked rows: fill in condition fields only where currently
    // empty — never overwrite a value that's already there. A row with
    // nothing new to add is a genuine skip; one that fills a gap counts
    // toward conditionsBackfilled instead.
    const alreadyLinked = parsedRows.filter(r => {
      const recId = existingMap.get(r.releaseId.toString());
      return recId && linkByRecordId.has(recId);
    });

    for (const r of alreadyLinked) {
      const recId = existingMap.get(r.releaseId.toString())!;
      const link  = linkByRecordId.get(recId)!;

      const patch: Record<string, string> = {};
      if (r.mediaCondition && !link.media_condition) patch.media_condition = r.mediaCondition;
      if (r.sleeveCondition && !link.sleeve_condition) patch.sleeve_condition = r.sleeveCondition;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: backfillErr } = await (supabase as any)
        .from("user_records")
        .update(patch)
        .eq("id", link.id);

      if (backfillErr) {
        console.error("[csv-import] condition backfill error:", backfillErr.message);
        skipped++;
      } else {
        conditionsBackfilled++;
      }
    }
  }

  await logCollectionAddActivity(supabase, user.id, allNewRecordIds);

  revalidateTag(`collection-${user.id}`, {});

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

  return NextResponse.json({ success: true, imported, skipped, failed, enrichmentPending, conditionsBackfilled });
}
