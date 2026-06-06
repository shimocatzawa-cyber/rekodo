import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const UA         = "rekodo/1.0";
const BATCH_LIMIT = 50;
const CONCURRENT  = 2;
const SLEEP_MS    = 2_500;   // ~48 req/min — under Discogs 60/min app-auth limit

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key    = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const adminDb = svcKey
    ? createServiceClient(sbUrl, svcKey, { auth: { persistSession: false } })
    : supabase;

  // Count how many still need median
  const { count: totalRemaining } = await supabase
    .from("user_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("median_fetched_at", null);

  // Get next batch
  const { data: urBatch } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .is("median_fetched_at", null)
    .limit(BATCH_LIMIT);

  const recordIds = (urBatch ?? []).map(r => r.record_id as string);

  if (recordIds.length === 0) {
    return Response.json({ priced: 0, processed: 0, remaining: 0, total: 0 });
  }

  const { data: records } = await supabase
    .from("records")
    .select("id, discogs_id")
    .in("id", recordIds);

  const priceable = (records ?? []).filter(
    (r): r is { id: string; discogs_id: string } => !!r.discogs_id
  );

  let priced = 0;
  let processed = 0;
  const now = new Date().toISOString();

  for (let bi = 0; bi < priceable.length; bi += CONCURRENT) {
    const batch = priceable.slice(bi, bi + CONCURRENT);

    await Promise.all(batch.map(async (record) => {
      try {
        const abort   = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 12_000);
        let res: Response;
        try {
          // Marketplace search returns individual listings with prices —
          // sorted asc so we can compute median from the array
          res = await fetch(
            `https://api.discogs.com/marketplace/search` +
            `?release_id=${encodeURIComponent(record.discogs_id)}` +
            `&status=For+Sale` +
            `&sort=price&sort_order=asc` +
            `&per_page=50` +
            `&key=${key}&secret=${secret}`,
            { headers: { "User-Agent": UA }, cache: "no-store", signal: abort.signal }
          );
        } finally {
          clearTimeout(timeout);
        }

        if (res.status === 429) return; // skip — don't mark as fetched, retry next call

        const update: Record<string, unknown> = { median_fetched_at: now };

        if (res.ok) {
          const pd = await res.json();
          type L = { price?: { value?: unknown; currency?: string }; last_sale?: { value?: unknown } };
          // Discogs may use 'listings' or 'results' depending on the endpoint
          const items: L[] = pd.listings ?? pd.results ?? [];
          const prices = items
            .map(l => (typeof l.price?.value === "number" && l.price.value > 0 ? l.price.value : null))
            .filter((v): v is number => v !== null);

          if (prices.length > 0) {
            const currency = (items.find(l => l.price?.currency)?.price?.currency) ?? "USD";
            update.price_median   = prices[Math.floor(prices.length / 2)];
            update.price_currency = currency;
            priced++;
          }

          // Check if Discogs includes last sold data in the response
          const lastSold = pd.last_sale?.price?.value ?? pd.last_sold?.value ?? null;
          if (typeof lastSold === "number" && lastSold > 0) {
            update.price_last_sold = lastSold;
          }
        }

        await adminDb.from("user_records")
          .update(update)
          .eq("user_id", user.id)
          .eq("record_id", record.id);

        processed++;
      } catch { /* skip */ }
    }));

    if (bi + CONCURRENT < priceable.length) await sleep(SLEEP_MS);
  }

  const remaining = Math.max(0, (totalRemaining ?? 0) - processed);

  return Response.json({ priced, processed, remaining, total: totalRemaining ?? 0 });
}
