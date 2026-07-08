import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const UA          = "rekodo/1.0";
const BATCH_LIMIT = 50;
const CONCURRENT  = 2;
const SLEEP_MS    = 2_500; // 2 records × 2 calls per 2.5 s ≈ 48 req/min

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key    = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const adminDb  = svcKey
    ? createServiceClient(sbUrl, svcKey, { auth: { persistSession: false } })
    : supabase;

  const staleDate          = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const communityStaleDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const recentReleaseYear  = new Date().getFullYear() - 1; // records from last ~12 months
  const now                = new Date().toISOString();

  // ── All user record IDs (used for community-data checks) ─────────────────────
  const { data: allLinks } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id);

  const allRecordIds = (allLinks ?? []).map(r => r.record_id as string);

  // ── Step 1: records with stale / missing prices ──────────────────────────────
  const { data: stalePriceBatch } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .or(`price_fetched_at.is.null,price_fetched_at.lt.${staleDate}`)
    .limit(BATCH_LIMIT);

  const stalePriceIds = (stalePriceBatch ?? []).map(r => r.record_id as string);
  const staleSet      = new Set(stalePriceIds);

  // ── Step 2: supplement with records missing community data ───────────────────
  // Runs independently of price staleness: the previous sync may have set
  // price_fetched_at for all records, skipping the community data fetch entirely.
  const communityIds: string[] = [];

  if (stalePriceIds.length < BATCH_LIMIT) {
    const candidates = allRecordIds.filter(id => !staleSet.has(id));
    const needed     = BATCH_LIMIT - stalePriceIds.length;

    for (let i = 0; i < candidates.length && communityIds.length < needed; i += 400) {
      const { data } = await supabase
        .from("records")
        .select("id")
        .in("id", candidates.slice(i, i + 400))
        .or(
          `community_fetched_at.is.null,` +
          `and(year.gte.${recentReleaseYear},community_fetched_at.lt.${communityStaleDate})`
        )
        .limit(needed - communityIds.length);
      communityIds.push(...(data ?? []).map((r: { id: string }) => r.id));
    }
  }

  const recordIds = [...stalePriceIds, ...communityIds];

  if (recordIds.length === 0) {
    return Response.json({ priced: 0, processed: 0, remaining: 0, total: 0 });
  }

  // ── Resolve discogs_ids ──────────────────────────────────────────────────────
  const { data: records } = await supabase
    .from("records")
    .select("id, discogs_id")
    .in("id", recordIds);

  const priceable = (records ?? []).filter(
    (r): r is { id: string; discogs_id: string } => !!r.discogs_id
  );

  let priced    = 0;
  let processed = 0;

  for (let bi = 0; bi < priceable.length; bi += CONCURRENT) {
    const batch = priceable.slice(bi, bi + CONCURRENT);

    await Promise.all(batch.map(async (record) => {
      try {
        const abort   = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 15_000);
        const opts    = { headers: { "User-Agent": UA }, cache: "no-store" as const, signal: abort.signal };

        const [statsRes, releaseRes] = await Promise.all([
          fetch(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(record.discogs_id)}?key=${key}&secret=${secret}`, opts),
          fetch(`https://api.discogs.com/releases/${encodeURIComponent(record.discogs_id)}?key=${key}&secret=${secret}`, opts),
        ]).finally(() => clearTimeout(timeout));

        if (statsRes.status === 429 || releaseRes.status === 429) return;

        let numForSale: number | null = null;

        if (statsRes.ok) {
          const pd = await statsRes.json() as {
            lowest_price?: { value?: number; currency?: string } | null;
            num_for_sale?: number;
          };
          const lowest = pd.lowest_price?.value ?? null;
          numForSale   = pd.num_for_sale ?? null;

          await adminDb.from("user_records").update({
            price_low:        lowest,
            price_median:     lowest,
            price_high:       null,
            price_currency:   pd.lowest_price?.currency ?? "USD",
            price_fetched_at: now,
          }).eq("user_id", user.id).eq("record_id", record.id);

          priced++;
        } else {
          await adminDb.from("user_records")
            .update({ price_fetched_at: now })
            .eq("user_id", user.id).eq("record_id", record.id);
        }

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

  // ── Remaining count (union — each record counted once even if it needs both) ──
  const needingWorkSet = new Set<string>();

  // Records still needing prices
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("user_records")
      .select("record_id")
      .eq("user_id", user.id)
      .or(`price_fetched_at.is.null,price_fetched_at.lt.${staleDate}`)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) needingWorkSet.add(r.record_id as string);
    if (data.length < 1000) break;
  }

  // Records still needing community data
  for (let i = 0; i < allRecordIds.length; i += 400) {
    const { data } = await supabase
      .from("records")
      .select("id")
      .in("id", allRecordIds.slice(i, i + 400))
      .or(
        `community_fetched_at.is.null,` +
        `and(year.gte.${recentReleaseYear},community_fetched_at.lt.${communityStaleDate})`
      );
    for (const r of data ?? []) needingWorkSet.add(r.id as string);
  }

  const remaining = needingWorkSet.size;
  const total     = remaining + processed;

  return Response.json({ priced, processed, remaining, total });
}
