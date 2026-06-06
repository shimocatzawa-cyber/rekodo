import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildAuthHeader } from "@/lib/discogs/oauth";

const UA = "rekodo/1.0";
const BATCH = 100;
const VINYL_SIZES = ['LP', '12"', '10"', '7"', 'EP', 'Mini-Album'] as const;

interface FormatShape {
  name?: string;
  descriptions?: string[];
}

function extractFormat(formats: FormatShape[] | undefined): string | null {
  const fmt = formats?.[0];
  if (!fmt) return null;
  const name = fmt.name ?? "";
  const descs = fmt.descriptions ?? [];
  if (name === "Vinyl") {
    return (descs.find(d => (VINYL_SIZES as readonly string[]).includes(d)) ?? "Vinyl");
  }
  return name || null;
}

interface CollectionItem {
  discogs_id: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  label: string | null;
  format: string | null;
  country: string | null;
}

interface DiscogsBasicInfo {
  id: number;
  artists: Array<{ name: string }>;
  title: string;
  year: number;
  genres: string[];
  styles: string[];
  cover_image: string;
  thumb: string;
  labels: Array<{ name: string }>;
  formats: FormatShape[];
  country?: string;
}

export async function GET(request: NextRequest) {
  // Capture all request-scoped resources before streaming starts
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Capture the JWT before streaming starts — the SSR cookie context does not
  // survive inside the background IIFE, so auth.uid() returns null for RLS checks.
  // We use this token directly for price writes instead of the supabase client.
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseJwt      = session?.access_token ?? "";
  const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = await cookies();
  const accessToken    = cookieStore.get("dg_at")?.value;
  const tokenSecret    = cookieStore.get("dg_ts")?.value;
  const discogsUser    = cookieStore.get("dg_un")?.value;

  if (!accessToken || !tokenSecret || !discogsUser) {
    return Response.json({ error: "No Discogs session — please reconnect" }, { status: 400 });
  }

  const key    = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = (data: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => {});
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // ── Background sync ────────────────────────────────────────────────────────
  ;(async () => {
    try {

      // ── Phase 1: Fetch full Discogs collection ──────────────────────────────
      send({ type: "status", message: "Fetching your Discogs collection..." });

      const collectionItems: CollectionItem[] = [];

      for (let page = 1; ; page++) {
        if (request.signal.aborted) return;

        const url = new URL(
          `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/folders/0/releases`
        );
        url.searchParams.set("per_page", String(BATCH));
        url.searchParams.set("page", String(page));

        const auth = buildAuthHeader("GET", url.toString(), key, secret, accessToken, tokenSecret);
        const res  = await fetch(url.toString(), {
          headers: { Authorization: auth, "User-Agent": UA },
        });

        if (!res.ok) {
          if (page === 1) throw new Error(`Discogs collection fetch failed: ${res.status}`);
          break;
        }

        const data = await res.json() as {
          releases: Array<{ basic_information: DiscogsBasicInfo }>;
          pagination: { pages: number; items: number };
        };

        for (const item of data.releases ?? []) {
          const info = item.basic_information;
          const artistNames = (info.artists ?? [])
            .map(a => a.name.replace(/ \(\d+\)$/, "").trim())
            .join(", ");
          const fmt   = info.formats?.[0];
          const genre = info.genres?.[0] ?? info.styles?.[0] ?? (fmt?.descriptions?.[0] ?? null);
          collectionItems.push({
            discogs_id: String(info.id),
            artist:     artistNames || "Unknown",
            album:      info.title ?? "Unknown",
            year:       info.year  || null,
            genre,
            cover_url:  info.cover_image ?? info.thumb ?? null,
            label:      info.labels?.[0]?.name ?? null,
            format:     extractFormat(info.formats),
            country:    info.country ?? null,
          });
        }

        const totalPages = data.pagination?.pages ?? 1;
        send({ type: "fetch_page", page, totalPages, fetched: collectionItems.length });

        if (page >= totalPages) break;

        await sleep(1000); // 1 req/sec between page fetches
      }

      const total = collectionItems.length;

      // ── Phase 2: Insert new records + link to collection ────────────────────
      send({ type: "processing", done: 0, total, phase: "inserting",
             message: "Syncing new records..." });

      const allDiscogsIds = collectionItems.map(r => r.discogs_id);

      // Which discogs_ids already have a DB row?
      const existingMap = new Map<string, string>(); // discogs_id → record uuid
      for (let i = 0; i < allDiscogsIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("discogs_id", allDiscogsIds.slice(i, i + BATCH));
        for (const r of data ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
      }

      // Insert only records not yet in the DB
      const newItems = collectionItems.filter(r => !existingMap.has(r.discogs_id));

      for (let i = 0; i < newItems.length; i += BATCH) {
        const { data, error } = await supabase
          .from("records")
          .insert(newItems.slice(i, i + BATCH).map(r => ({
            discogs_id: r.discogs_id,
            artist:     r.artist,
            album:      r.album,
            year:       r.year,
            genre:      r.genre,
            cover_url:  r.cover_url,
            label:      r.label,
            format:     r.format,
            country:    r.country,
          })))
          .select("id, discogs_id");

        if (error) {
          // Race condition: re-fetch this batch
          const batchIds = newItems.slice(i, i + BATCH).map(r => r.discogs_id);
          const { data: retried } = await supabase
            .from("records").select("id, discogs_id").in("discogs_id", batchIds);
          for (const r of retried ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
        } else {
          for (const r of data ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
        }
      }

      // Resolve the full list of record UUIDs
      const savedRecordIds = collectionItems
        .map(r => existingMap.get(r.discogs_id))
        .filter((id): id is string => id !== undefined);

      // Link records to user's collection (skip already-linked)
      const alreadyLinked = new Set<string>();
      for (let i = 0; i < savedRecordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("user_records")
          .select("record_id")
          .eq("user_id", user.id)
          .in("record_id", savedRecordIds.slice(i, i + BATCH));
        for (const l of data ?? []) alreadyLinked.add(l.record_id);
      }

      const newLinks = savedRecordIds
        .filter(id => !alreadyLinked.has(id))
        .map(id => ({ user_id: user.id, record_id: id }));

      for (let i = 0; i < newLinks.length; i += BATCH) {
        await supabase.from("user_records").insert(newLinks.slice(i, i + BATCH));
      }

      const newAdded = newLinks.length;

      // ── Phase 3: Backfill missing format/country ────────────────────────────
      // Find records in user's collection that have NULL format or country.
      // These are records that existed in the DB before those columns were added.

      interface RecordStub { id: string; discogs_id: string }
      const needingBackfill: RecordStub[] = [];

      for (let i = 0; i < savedRecordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("id", savedRecordIds.slice(i, i + BATCH))
          .not("discogs_id", "is", null)
          .or("format.is.null,country.is.null");
        for (const r of data ?? []) needingBackfill.push(r as RecordStub);
      }

      let backfillDone = 0;
      const backfillTotal = needingBackfill.length;

      if (backfillTotal > 0) {
        send({
          type: "processing", done: newAdded, total, phase: "backfill",
          message: `Syncing... ${newAdded} of ${total} records`,
        });

        const BACKFILL_BATCH = 3;
        for (let bi = 0; bi < needingBackfill.length; bi += BACKFILL_BATCH) {
          if (request.signal.aborted) break;

          const bfBatch = needingBackfill.slice(bi, bi + BACKFILL_BATCH);
          await Promise.all(bfBatch.map(async (record) => {
            try {
              const releaseUrl = `https://api.discogs.com/releases/${encodeURIComponent(record.discogs_id)}?key=${key}&secret=${secret}`;
              const res = await fetch(releaseUrl, { headers: { "User-Agent": UA } });
              if (res.ok) {
                const data = await res.json() as { formats?: FormatShape[]; country?: string };
                await supabase.from("records")
                  .update({ format: extractFormat(data.formats), country: data.country ?? null })
                  .eq("id", record.id);
              }
            } catch { /* skip */ }
          }));

          backfillDone += bfBatch.length;
          send({
            type: "processing",
            done: newAdded + backfillDone,
            total,
            phase: "backfill",
            message: `Syncing... ${newAdded + backfillDone} of ${total} records`,
          });

          if (bi + BACKFILL_BATCH < needingBackfill.length) await sleep(1_000);
        }
      }

      // ── Phase 4: Fetch marketplace prices ──────────────────────────────────
      // Only process records with no price or prices older than 30 days.
      const staleDate = new Date(Date.now() - 30 * 86_400_000).toISOString();

      type PriceUr = { record_id: string; price_fetched_at: string | null };
      const allUrForPrice: PriceUr[] = [];
      for (let from = 0; ; from += BATCH) {
        const { data: urPage } = await supabase
          .from("user_records")
          .select("record_id, price_fetched_at")
          .eq("user_id", user.id)
          .range(from, from + BATCH - 1);
        if (!urPage || urPage.length === 0) break;
        allUrForPrice.push(...(urPage as PriceUr[]));
        if (urPage.length < BATCH) break;
      }

      const needPriceIds = allUrForPrice
        .filter(ur => !ur.price_fetched_at || ur.price_fetched_at < staleDate)
        .map(ur => ur.record_id);

      type PriceRecord = { id: string; discogs_id: string | null };
      const priceRecords: PriceRecord[] = [];
      for (let i = 0; i < needPriceIds.length; i += BATCH) {
        const { data: rPage } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("id", needPriceIds.slice(i, i + BATCH));
        for (const r of rPage ?? []) priceRecords.push(r as PriceRecord);
      }

      const priceable = priceRecords.filter(r => !!r.discogs_id);
      const priceTotal = priceable.length;

      let priceUpdated = 0;
      let testDiag = "";

      if (priceTotal > 0) {
        // ── Diagnostic: test write before starting the loop ─────────────────
        const testRecord = priceable[0];
        const testUrl = `${supabaseUrl}/rest/v1/user_records`
          + `?user_id=eq.${encodeURIComponent(user.id)}`
          + `&record_id=eq.${encodeURIComponent(testRecord.id)}`;
        const testRes = await fetch(testUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
            "Authorization": `Bearer ${supabaseJwt}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({ price_fetched_at: new Date().toISOString() }),
        });
        const testBody = await testRes.text().catch(() => "error");
        const testDiag = `status=${testRes.status} rows=${testBody.slice(0, 120)}`;
        // ────────────────────────────────────────────────────────────────────

        send({ type: "status", message: `Fetching prices for ${priceTotal} records… jwt=${supabaseJwt ? "ok" : "MISSING"}` });

        // 3 concurrent requests per batch, 2 s between batches ≈ 90 req/min
        const PRICE_BATCH = 3;

        for (let bi = 0; bi < priceable.length; bi += PRICE_BATCH) {
          if (request.signal.aborted) break;

          const batch = priceable.slice(bi, bi + PRICE_BATCH);

          const results = await Promise.all(batch.map(async (record): Promise<boolean> => {
            // returns true if rate-limited
            try {
              // Use listings endpoint — gives low/median/high from real data.
              // The /marketplace/stats endpoint only returns lowest_price.
              const priceUrl =
                `https://api.discogs.com/marketplace/listings` +
                `?release_id=${encodeURIComponent(record.discogs_id!)}` +
                `&status=For+Sale&sort=price&sort_order=asc&per_page=10` +
                `&key=${key}&secret=${secret}`;
              const priceAbort = new AbortController();
              const priceTimeout = setTimeout(() => priceAbort.abort(), 12_000);
              let priceRes: Response;
              try {
                priceRes = await fetch(priceUrl, {
                  headers: { "User-Agent": UA, Authorization: `Discogs key=${key}, secret=${secret}` },
                  cache: "no-store",
                  signal: priceAbort.signal,
                });
              } finally {
                clearTimeout(priceTimeout);
              }

              if (priceRes.status === 429) return true;

              if (priceRes.ok) {
                const pd = await priceRes.json();
                type PdListing = { price?: { value?: unknown; currency?: string } };
                const pdListings: PdListing[] = pd.listings ?? [];

                const pdPrices = pdListings
                  .map(l => (typeof l.price?.value === "number" && l.price.value > 0 ? l.price.value : null))
                  .filter((v): v is number => v !== null);

                const currency  = pdListings.find(l => l.price?.currency)?.price?.currency ?? "USD";
                const pdLow    = pdPrices.length > 0 ? pdPrices[0]                                 : null;
                const pdMedian = pdPrices.length > 0 ? pdPrices[Math.floor(pdPrices.length / 2)]   : null;
                const pdHigh   = pdPrices.length > 0 ? pdPrices[pdPrices.length - 1]               : null;

                const restHeaders = {
                  "Content-Type": "application/json",
                  "apikey": supabaseAnonKey,
                  "Authorization": `Bearer ${supabaseJwt}`,
                  "Prefer": "return=minimal",
                };
                const restUrl = `${supabaseUrl}/rest/v1/user_records`
                  + `?user_id=eq.${encodeURIComponent(user.id)}`
                  + `&record_id=eq.${encodeURIComponent(record.id)}`;

                const writeRes = await fetch(restUrl, {
                  method: "PATCH",
                  headers: restHeaders,
                  body: JSON.stringify({
                    price_last_sold:  null,
                    price_low:        pdLow,
                    price_median:     pdMedian,
                    price_high:       pdHigh,
                    price_currency:   currency,
                    price_fetched_at: new Date().toISOString(),
                  }),
                });

                const writeBody = await writeRes.text().catch(() => "");
                if (priceUpdated === 0 && bi === 0) {
                  // Always surface the first write result so we can diagnose
                  send({ type: "status", message: `[diag] write status=${writeRes.status} jwt=${supabaseJwt ? "present" : "MISSING"} body=${writeBody.slice(0, 120)}` });
                }

                if (writeRes.ok) {
                  priceUpdated++;
                } else {
                  console.error("[sync] price write error:", writeRes.status, writeBody, "record_id:", record.id);
                }
              } else {
                // No listings — just mark as fetched so we don't retry for 30 days
                await fetch(
                  `${supabaseUrl}/rest/v1/user_records`
                    + `?user_id=eq.${encodeURIComponent(user.id)}`
                    + `&record_id=eq.${encodeURIComponent(record.id)}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      "apikey": supabaseAnonKey,
                      "Authorization": `Bearer ${supabaseJwt}`,
                      "Prefer": "return=minimal",
                    },
                    body: JSON.stringify({ price_fetched_at: new Date().toISOString() }),
                  }
                );
              }
            } catch { /* skip this record */ }
            return false;
          }));

          send({ type: "pricing", done: Math.min(bi + PRICE_BATCH, priceTotal), total: priceTotal });

          if (results.some(Boolean)) {
            // At least one 429 — brief back off before continuing
            send({ type: "status", message: "Rate limited — pausing 8s…" });
            await sleep(8_000);
          } else if (bi + PRICE_BATCH < priceable.length) {
            await sleep(2_000);
          }
        }
      }

      // ── Complete ────────────────────────────────────────────────────────────
      const timestamp = new Date().toISOString();

      await supabase
        .from("profiles")
        .update({ last_synced_at: timestamp })
        .eq("id", user.id);

      send({ type: "complete", total, newAdded, updated: backfillDone, priceUpdated, timestamp, diag: testDiag || "no price phase" });

    } catch (err: unknown) {
      send({ type: "error", message: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache, no-transform",
      "Connection":      "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
