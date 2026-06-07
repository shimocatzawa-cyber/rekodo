import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const UA          = "rekodo/1.0";
const BATCH_LIMIT = 50;   // records per call
const CONCURRENT  = 2;    // concurrent record fetches
const SLEEP_MS    = 5_000; // 2 records × 2 calls per 5s ≈ 24 req/min — well under Discogs 60/min

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // OAuth cookies present but not currently used (app-auth sufficient for public endpoints)
  await cookies();

  const key    = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const adminDb = svcKey
    ? createServiceClient(sbUrl, svcKey, { auth: { persistSession: false } })
    : supabase;

  const staleDate = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { count: totalRemaining } = await supabase
    .from("user_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .or(`price_fetched_at.is.null,price_fetched_at.lt.${staleDate}`);

  const { data: urBatch } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .or(`price_fetched_at.is.null,price_fetched_at.lt.${staleDate}`)
    .limit(BATCH_LIMIT);

  const recordIds = (urBatch ?? []).map(r => r.record_id as string);

  if (recordIds.length === 0) {
    return Response.json({ priced: 0, remaining: 0, total: totalRemaining ?? 0 });
  }

  const { data: records } = await supabase
    .from("records")
    .select("id, discogs_id")
    .in("id", recordIds);

  const priceable = (records ?? []).filter(
    (r): r is { id: string; discogs_id: string } => !!r.discogs_id
  );

  let priced    = 0;
  let processed = 0;
  const now     = new Date().toISOString();

  for (let bi = 0; bi < priceable.length; bi += CONCURRENT) {
    const batch = priceable.slice(bi, bi + CONCURRENT);

    await Promise.all(batch.map(async (record) => {
      try {
        const abort   = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 15_000);
        const opts    = { headers: { "User-Agent": UA }, cache: "no-store" as const, signal: abort.signal };

        // Fetch marketplace stats (price + num_for_sale) and release (community) concurrently
        const [statsRes, releaseRes] = await Promise.all([
          fetch(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(record.discogs_id)}?key=${key}&secret=${secret}`, opts),
          fetch(`https://api.discogs.com/releases/${encodeURIComponent(record.discogs_id)}?key=${key}&secret=${secret}`, opts),
        ]).finally(() => clearTimeout(timeout));

        // If either endpoint is rate-limited, skip without marking as fetched so it retries
        if (statsRes.status === 429 || releaseRes.status === 429) return;

        let numForSale: number | null = null;

        if (statsRes.ok) {
          const pd = await statsRes.json() as {
            lowest_price?: { value?: number; currency?: string } | null;
            num_for_sale?: number;
          };
          const lowest   = pd.lowest_price?.value ?? null;
          numForSale     = pd.num_for_sale ?? null;

          await adminDb.from("user_records").update({
            price_low:        lowest,
            price_median:     lowest,
            price_high:       null,
            price_currency:   pd.lowest_price?.currency ?? "USD",
            price_fetched_at: now,
          }).eq("user_id", user.id).eq("record_id", record.id);

          priced++;
        } else {
          // Non-200, non-429: mark as fetched so we don't keep retrying
          await adminDb.from("user_records")
            .update({ price_fetched_at: now })
            .eq("user_id", user.id).eq("record_id", record.id);
        }

        // Save community stats to the shared records table regardless of stats result
        if (releaseRes.ok) {
          const rd = await releaseRes.json() as {
            community?: { have?: number; want?: number };
          };
          await adminDb.from("records").update({
            community_have:         rd.community?.have         ?? null,
            community_want:         rd.community?.want         ?? null,
            community_num_for_sale: numForSale,
            community_fetched_at:   now,
          }).eq("id", record.id);
        }

        processed++;
      } catch { /* skip */ }
    }));

    if (bi + CONCURRENT < priceable.length) await sleep(SLEEP_MS);
  }

  const remaining = Math.max(0, (totalRemaining ?? 0) - processed);

  return Response.json({ priced, processed, remaining, total: totalRemaining ?? 0 });
}
