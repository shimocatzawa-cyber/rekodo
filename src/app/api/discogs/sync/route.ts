import { type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enqueueSync } from "@/lib/sync-queue";
import { invalidateCollectionCache } from "@/lib/collectionCache";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check tokens via the DB (service role) — the 10-minute OAuth cookies are
  // only set during the initial connect handshake and must not gate re-syncs.
  // The Edge Function reads from discogs_tokens directly; the cookies are unused
  // in the actual sync and were causing all re-syncs to fail after 10 minutes.
  const adminDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: tokenRow } = await adminDb
    .from("discogs_tokens")
    .select("discogs_username")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tokenRow) {
    return Response.json({ error: "No Discogs connection — please connect Discogs from your collection page" }, { status: 400 });
  }

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

      // Bust both caches so in-progress loads see live data
      revalidateTag(`collection-${user.id}`, {});
      void invalidateCollectionCache(user.id);

      // Fire Edge Function — intentionally no await (non-blocking)
      // All data work (fetch, insert, link, backfill, collection value) runs
      // inside the Edge Function, so it completes even if the user navigates away.
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
      let lastPhase        = "";
      let lastPage         = 0;
      let lastBackfillDone = -1;
      let completedData: {
        total_records: number; new_added: number; records_updated: number;
        completed_at: string | null;
      } | null = null;

      const POLL_MS   = 2000;
      const MAX_POLLS = 300; // 10-minute ceiling

      for (let i = 0; i < MAX_POLLS; i++) {
        if (request.signal.aborted) return;
        await sleep(POLL_MS);

        const { data: job } = await supabase
          .from("sync_queue")
          .select("status, phase, total_records, current_page, total_pages, progress_done, new_added, records_updated, error_message, completed_at")
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
        } else if (job.phase === "backfill" && (job.progress_done ?? 0) !== lastBackfillDone) {
          // Backfill reports live per-record progress (job.total_records is
          // temporarily repurposed to the backfill batch size during this phase).
          lastPhase        = "backfill";
          lastBackfillDone = job.progress_done ?? 0;
          send({
            type: "processing", done: job.progress_done ?? 0, total: job.total_records ?? 0,
            phase: "backfill",
            message: `Finalising sync... ${job.progress_done ?? 0} of ${job.total_records ?? 0}`,
          });
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
            completed_at:    job.completed_at     ?? null,
          };
          break;
        }
      }

      // Guard: one final check if the polling loop hit its ceiling
      if (!completedData) {
        const { data: finalJob } = await supabase
          .from("sync_queue")
          .select("status, total_records, new_added, records_updated, error_message, completed_at")
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
          completed_at:    finalJob.completed_at     ?? null,
        };
      }

      const total     = completedData.total_records;
      const newAdded  = completedData.new_added;
      const timestamp = completedData.completed_at ?? new Date().toISOString();

      send({ type: "complete", total, newAdded, updated: completedData.records_updated, priceUpdated: 0, timestamp });

      // Bust both caches so the next page load reflects the new collection
      revalidateTag(`collection-${user.id}`, {});
      void invalidateCollectionCache(user.id);

      // Phase 7: Collection intelligence — recomputes on next Library tab load
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
