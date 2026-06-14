import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DISCOGS_DELAY_MS = 1200; // 50 req/min — stays under 60/min ceiling
const VINYL_SIZES = ["LP", '12"', '10"', '7"', "EP", "Mini-Album"];
const COLOUR_KW = [
  "Black", "White", "Red", "Blue", "Green", "Yellow", "Orange", "Purple",
  "Clear", "Colored", "Coloured", "Marbled", "Splatter", "Opaque",
  "Translucent", "Transparent", "Picture Disc", "Etched",
];

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function extractFormat(formats?: Array<{ name?: string; descriptions?: string[] }>): string | null {
  const fmt = formats?.[0];
  if (!fmt) return null;
  const name  = fmt.name ?? "";
  const descs = fmt.descriptions ?? [];
  if (name === "Vinyl") return descs.find((d) => VINYL_SIZES.includes(d)) ?? "Vinyl";
  return name || null;
}

function extractVinylColour(formats?: Array<{ name?: string; descriptions?: string[]; text?: string }>): string | null {
  const vinyl = formats?.find((f) => f.name === "Vinyl");
  if (!vinyl) return null;
  if (vinyl.text?.trim()) return vinyl.text.trim();
  const match = (vinyl.descriptions ?? []).find((d) =>
    COLOUR_KW.some((kw) => d.toLowerCase().includes(kw.toLowerCase()))
  );
  return match ?? null;
}

function extractProducers(extraartists?: Array<{ name: string; role: string }>): string[] {
  if (!extraartists?.length) return [];
  return extraartists.filter((e) => /producer/i.test(e.role)).map((e) => e.name);
}

interface DiscogsRelease {
  id:          number;
  master_id:   number | null;
  country:     string | null;
  genres:      string[] | null;
  styles:      string[] | null;
  images:      Array<{ uri: string; type: string }> | null;
  thumb:       string | null;
  formats?:    Array<{ name?: string; descriptions?: string[]; text?: string }>;
  extraartists?: Array<{ name: string; role: string }>;
}

export async function POST(request: NextRequest) {
  // Internal-only: require the shared header
  if (request.headers.get("x-rekodo-internal") !== "true") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = await createClient();

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "Discogs not configured" }, { status: 500 });
  }

  // 1. Fetch up to 50 pending user_records for this user
  const { data: pendingLinks, error: pendingErr } = await (supabase as any)
    .from("user_records")
    .select("id, record_id")
    .eq("user_id", userId)
    .eq("enrichment_status", "pending")
    .limit(50) as { data: Array<{ id: string; record_id: string }> | null; error: unknown };

  if (pendingErr || !pendingLinks || pendingLinks.length === 0) {
    return NextResponse.json({ processed: 0, enriched: 0, failed: 0 });
  }

  // 2. Get discogs_id for each pending record
  const recordIds = pendingLinks.map(l => l.record_id);
  const { data: recordRows } = await supabase
    .from("records")
    .select("id, discogs_id")
    .in("id", recordIds);

  const discogsIdMap = new Map<string, string>(); // record_id → discogs_id
  for (const r of recordRows ?? []) {
    if (r.discogs_id) discogsIdMap.set(r.id, r.discogs_id);
  }

  // 3. Enrich each record
  let enriched = 0;
  let failedCount = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < pendingLinks.length; i++) {
    const link     = pendingLinks[i];
    const discogsId = discogsIdMap.get(link.record_id);

    if (!discogsId) {
      // No discogs_id — mark as failed so we don't retry forever
      await (supabase as any)
        .from("user_records")
        .update({ enrichment_status: "failed", enrichment_attempted_at: now })
        .eq("id", link.id);
      failedCount++;
      continue;
    }

    // Rate-limit delay (before every call except the first)
    if (i > 0) await sleep(DISCOGS_DELAY_MS);

    try {
      const url = `https://api.discogs.com/releases/${encodeURIComponent(discogsId)}?key=${key}&secret=${secret}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "rekodo/1.0" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        await (supabase as any)
          .from("user_records")
          .update({ enrichment_status: "failed", enrichment_attempted_at: now })
          .eq("id", link.id);
        failedCount++;
        continue;
      }

      const data = await res.json() as DiscogsRelease;

      const coverUrl = data.images?.find(img => img.type === "primary")?.uri
        ?? data.images?.[0]?.uri
        ?? data.thumb
        ?? null;

      // Update records table with enriched data
      await (supabase as any)
        .from("records")
        .update({
          cover_url:    coverUrl,
          master_id:    data.master_id ?? null,
          country:      data.country ?? null,
          genre:        data.genres?.[0] ?? null,
          genres:       data.genres ?? null,
          styles:       data.styles ?? null,
          format:       extractFormat(data.formats),
          vinyl_colour: extractVinylColour(data.formats) ?? "",
          producers:    extractProducers(data.extraartists),
        })
        .eq("id", link.record_id);

      // Mark user_records as enriched
      await (supabase as any)
        .from("user_records")
        .update({ enrichment_status: "enriched", enrichment_attempted_at: now })
        .eq("id", link.id);

      enriched++;
    } catch {
      await (supabase as any)
        .from("user_records")
        .update({ enrichment_status: "failed", enrichment_attempted_at: now })
        .eq("id", link.id);
      failedCount++;
    }
  }

  // 4. If more pending records remain, self-trigger for the next batch
  const { count: remainingCount } = await (supabase as any)
    .from("user_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("enrichment_status", "pending") as { count: number | null };

  if ((remainingCount ?? 0) > 0) {
    const selfUrl = new URL("/api/collection/csv-enrich", request.url).toString();
    fetch(selfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rekodo-internal": "true",
      },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  }

  return NextResponse.json({ processed: pendingLinks.length, enriched, failed: failedCount });
}
