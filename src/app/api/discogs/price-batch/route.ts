import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const UA = "rekodo/1.0";
const BATCH_LIMIT = 50;       // records per call — keeps each invocation under 60s
const CONCURRENT  = 3;        // concurrent Discogs requests
const SLEEP_MS    = 2_000;    // between batches ≈ 90 req/min

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore  = await cookies();
  const discogsToken = cookieStore.get("dg_at")?.value;
  const discogsSecret = cookieStore.get("dg_ts")?.value;

  const key    = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const adminDb = svcKey
    ? createServiceClient(sbUrl, svcKey, { auth: { persistSession: false } })
    : supabase;

  const staleDate = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Count total still needing pricing
  const { count: totalRemaining } = await supabase
    .from("user_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .or(`price_fetched_at.is.null,price_fetched_at.lt.${staleDate}`);

  // Get the next batch
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

  let priced = 0;

  for (let bi = 0; bi < priceable.length; bi += CONCURRENT) {
    const batch = priceable.slice(bi, bi + CONCURRENT);

    await Promise.all(batch.map(async (record) => {
      try {
        const abort   = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 12_000);
        let res: Response;
        try {
          res = await fetch(
            `https://api.discogs.com/marketplace/listings` +
            `?release_id=${encodeURIComponent(record.discogs_id)}` +
            `&status=For+Sale&sort=price&sort_order=asc&per_page=10` +
            `&key=${key}&secret=${secret}`,
            { headers: { "User-Agent": UA }, cache: "no-store", signal: abort.signal }
          );
        } finally {
          clearTimeout(timeout);
        }

        if (res.ok) {
          const pd = await res.json();
          type L = { price?: { value?: unknown; currency?: string } };
          const listings: L[] = pd.listings ?? [];
          const prices = listings
            .map(l => (typeof l.price?.value === "number" && l.price.value > 0 ? l.price.value : null))
            .filter((v): v is number => v !== null);
          const currency = listings.find(l => l.price?.currency)?.price?.currency ?? "USD";

          await adminDb.from("user_records").update({
            price_low:        prices[0] ?? null,
            price_median:     prices[Math.floor(prices.length / 2)] ?? null,
            price_high:       prices[prices.length - 1] ?? null,
            price_currency:   currency,
            price_fetched_at: new Date().toISOString(),
          }).eq("user_id", user.id).eq("record_id", record.id);

          priced++;
        } else {
          await adminDb.from("user_records")
            .update({ price_fetched_at: new Date().toISOString() })
            .eq("user_id", user.id).eq("record_id", record.id);
        }
      } catch { /* skip */ }
    }));

    if (bi + CONCURRENT < priceable.length) await sleep(SLEEP_MS);
  }

  const remaining = Math.max(0, (totalRemaining ?? 0) - recordIds.length);

  return Response.json({
    priced,
    remaining,
    total: totalRemaining ?? 0,
  });
}
