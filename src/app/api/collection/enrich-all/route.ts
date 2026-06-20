import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST — authenticated. Queues all of the user's records for enrichment
// (sets enrichment_status = 'pending' for any record not already enriched).
// /api/collection/enrich-status picks up the actual enrichment run on its
// next poll.
//
// Skips already-enriched records so re-running is safe.
// Failed records are re-queued so they get another attempt.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Set enrichment_status = 'pending' for all records that haven't been enriched yet
  // (NULL = never queued, 'failed' = previous failure — both should be retried)
  const { count, error } = await (supabase as any)
    .from("user_records")
    .update({ enrichment_status: "pending" })
    .eq("user_id", user.id)
    .or("enrichment_status.is.null,enrichment_status.eq.failed")
    .select("*", { count: "exact", head: true }) as { count: number | null; error: unknown };

  if (error) {
    console.error("[enrich-all] update error:", error);
    return NextResponse.json({ error: "Failed to queue records" }, { status: 500 });
  }

  const queued = count ?? 0;

  // No fire-and-forget trigger here — /api/collection/enrich-status (polled
  // every 8s by CollectionClient while pending > 0) picks this up reliably
  // on its next poll instead. A bare server-to-server fetch() from this
  // request would otherwise risk being killed before it starts, the same
  // unreliable pattern already found and removed from csv-enrich's own
  // self-chaining.

  const batchesEstimate = Math.ceil(queued / 50);
  const minutesEstimate = Math.ceil((batchesEstimate * 60) / 60);

  return NextResponse.json({
    queued,
    message: queued > 0
      ? `${queued} records queued. Enrichment runs in background (~${minutesEstimate} min).`
      : "All records already enriched.",
  });
}
