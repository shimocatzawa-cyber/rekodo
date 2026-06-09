import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildAuthHeader } from "@/lib/discogs/oauth";
import { enqueueSync } from "@/lib/sync-queue";

const UA          = "rekodo/1.0";
const BATCH       = 100;
const VINYL_SIZES = ['LP', '12"', '10"', '7"', 'EP', 'Mini-Album'] as const;

interface FormatShape { name?: string; descriptions?: string[] }

function extractFormat(formats: FormatShape[] | undefined): string | null {
  const fmt = formats?.[0];
  if (!fmt) return null;
  const name  = fmt.name ?? "";
  const descs = fmt.descriptions ?? [];
  if (name === "Vinyl") {
    return (descs.find(d => (VINYL_SIZES as readonly string[]).includes(d)) ?? "Vinyl");
  }
  return name || null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("dg_at")?.value;
  const tokenSecret = cookieStore.get("dg_ts")?.value;
  const discogsUser = cookieStore.get("dg_un")?.value;

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

  // ── Background work ────────────────────────────────────────────────────────
  ;(async () => {
    try {
      send({ type: "status", message: "Queuing sync job..." });

      // Enqueue — returns existing job ID if one is already running
      const jobId = await enqueueSync(supabase, user.id);

      // Fire Edge Function — intentionally no await (non-blocking)
      const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/discogs-sync-processor`;
      fetch(edgeFnUrl, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ jobId, userId: user.id }),
      }).catch(err => console.error("[sync] Edge Function fire error:", err));

      // ── Poll sync_queue and translate progress → SSE events ────────────────
      // This keeps the existing client-side SSE stream format unchanged.
      let lastPhase = "";
      let lastPage  = 0;
      let completedData: {
        total_records: number; new_added: number; records_updated: number;
      } | null = null;

      const POLL_MS   = 2000;
      const MAX_POLLS = 300; // 10-minute ceiling

      for (let i = 0; i < MAX_POLLS; i++) {
        if (request.signal.aborted) return;
        await sleep(POLL_MS);

        const { data: job } = await supabase
          .from("sync_queue")
          .select("status, phase, total_records, current_page, total_pages, progress_done, new_added, records_updated, error_message")
          .eq("id", jobId)
          .single();

        if (!job) continue;

        if (job.status === "failed") {
          send({ type: "error", message: job.error_message ?? "Sync failed" });
          return;
        }

        // Translate phase → SSE event (deduplicated — only emit on change)
        if (job.phase === "fetching" && (job.current_page ?? 0) > lastPage) {
          lastPage = job.current_page ?? 0;
          send({ type: "fetch_page", page: job.current_page, totalPages: job.total_pages, fetched: job.progress_done });
        } else if (
          (job.phase === "inserting" || job.phase === "linking" || job.phase === "conditions" ||
           job.phase === "updating" || job.phase === "cleanup") &&
          job.phase !== lastPhase
        ) {
          lastPhase = job.phase ?? "";
          const phaseLabel: Record<string, string> = {
            inserting:  "Adding new records",
            linking:    "Linking collection",
            conditions: "Saving grades",
            updating:   "Updating metadata",
            cleanup:    "Cleaning up",
          };
          send({
            type: "processing", done: job.progress_done ?? 0, total: job.total_records ?? 0,
            phase: job.phase,
            message: `${phaseLabel[job.phase ?? ""] ?? "Syncing"}... ${job.total_records ?? 0} records`,
          });
        }

        if (job.status === "completed") {
          completedData = {
            total_records:   job.total_records   ?? 0,
            new_added:       job.new_added        ?? 0,
            records_updated: job.records_updated  ?? 0,
          };
          break;
        }
      }

      // Guard: one final check if the polling loop hit its ceiling
      if (!completedData) {
        const { data: finalJob } = await supabase
          .from("sync_queue")
          .select("status, total_records, new_added, records_updated, error_message")
          .eq("id", jobId)
          .single();

        if (finalJob?.status !== "completed") {
          send({ type: "error", message: finalJob?.error_message ?? "Sync timed out — please try again" });
          return;
        }
        completedData = {
          total_records:   finalJob.total_records   ?? 0,
          new_added:       finalJob.new_added        ?? 0,
          records_updated: finalJob.records_updated  ?? 0,
        };
      }

      const total    = completedData.total_records;
      const newAdded = completedData.new_added;

      // ── Phase 5: Backfill missing format/country ────────────────────────────
      // Fetch all record IDs for this user — collectionItems is not available
      // after the queue handoff, so we query user_records directly.
      const allUserRecordIds: string[] = [];
      for (let from = 0; ; from += BATCH) {
        const { data } = await supabase
          .from("user_records")
          .select("record_id")
          .eq("user_id", user.id)
          .range(from, from + BATCH - 1);
        if (!data || data.length === 0) break;
        allUserRecordIds.push(...data.map(r => r.record_id));
        if (data.length < BATCH) break;
      }

      interface RecordStub { id: string; discogs_id: string }
      const needingBackfill: RecordStub[] = [];

      for (let i = 0; i < allUserRecordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("id", allUserRecordIds.slice(i, i + BATCH))
          .not("discogs_id", "is", null)
          .or("format.is.null,country.is.null");
        for (const r of data ?? []) needingBackfill.push(r as RecordStub);
      }

      let backfillDone = 0;

      if (needingBackfill.length > 0) {
        send({ type: "processing", done: newAdded, total, phase: "backfill",
               message: `Syncing... ${newAdded} of ${total} records` });

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
          send({ type: "processing", done: newAdded + backfillDone, total, phase: "backfill",
                 message: `Syncing... ${newAdded + backfillDone} of ${total} records` });

          if (bi + BACKFILL_BATCH < needingBackfill.length) await sleep(1_000);
        }
      }

      // ── Phase 6: Collection value from Discogs ──────────────────────────────
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
          taste_summary_count:       null,
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

      // ── Phase 7: Collection intelligence ────────────────────────────────────
      // collectionItems is not available after the queue handoff — intelligence
      // will recompute on the next Library tab load (non-fatal if this fails).
      try {
        const { computeCollectionIntelligence } = await import("@/lib/library/intelligence");
        await computeCollectionIntelligence(supabase, user.id, []);
      } catch { /* non-fatal */ }

    } catch (err: unknown) {
      send({ type: "error", message: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
