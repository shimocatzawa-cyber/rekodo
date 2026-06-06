import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

      // ── Collection value from Discogs ───────────────────────────────────────
      type ColVal = { minimum?: { value?: number; currency?: string }; median?: { value?: number }; maximum?: { value?: number } };
      let colVal: ColVal = {};
      try {
        const cvUrl  = `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/value`;
        const cvAuth = buildAuthHeader("GET", cvUrl, key, secret, accessToken, tokenSecret);
        const cvRes  = await fetch(cvUrl, { headers: { Authorization: cvAuth, "User-Agent": UA } });
        if (cvRes.ok) colVal = await cvRes.json() as ColVal;
      } catch { /* non-fatal */ }

      // ── Complete ────────────────────────────────────────────────────────────
      const timestamp = new Date().toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("profiles") as any)
        .update({
          last_synced_at:            timestamp,
          collection_value_low:      colVal.minimum?.value     ?? null,
          collection_value_med:      colVal.median?.value      ?? null,
          collection_value_high:     colVal.maximum?.value     ?? null,
          collection_value_currency: colVal.minimum?.currency  ?? null,
          collection_value_at:       colVal.minimum?.value ? timestamp : null,
        })
        .eq("id", user.id);

      // ── Snapshot for trend analysis ─────────────────────────────────────────
      if (colVal.minimum?.value != null) {
        try {
          const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const adminDb = svcKey
            ? createServiceClient(sbUrl, svcKey, { auth: { persistSession: false } })
            : supabase;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminDb as any).from("collection_value_snapshots").insert({
            user_id:      user.id,
            snapshot_at:  timestamp,
            value_low:    colVal.minimum?.value  ?? null,
            value_med:    colVal.median?.value   ?? null,
            value_high:   colVal.maximum?.value  ?? null,
            currency:     colVal.minimum?.currency ?? "USD",
            record_count: total,
          });
        } catch { /* non-fatal */ }
      }

      send({ type: "complete", total, newAdded, updated: backfillDone, priceUpdated: 0, timestamp });

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
