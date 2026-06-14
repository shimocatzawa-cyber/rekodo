import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST — authenticated. Queues all of the user's records for enrichment
// (sets enrichment_status = 'pending' for any record not already enriched)
// then fires the enrichment worker.
//
// Skips already-enriched records so re-running is safe.
// Failed records are re-queued so they get another attempt.
export async function POST(request: NextRequest) {
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

  if (queued > 0) {
    // Fire enrichment worker — best-effort, no await
    const enrichUrl = new URL("/api/collection/csv-enrich", request.url).toString();
    fetch(enrichUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rekodo-internal": "true",
      },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {});
  }

  const batchesEstimate = Math.ceil(queued / 50);
  const minutesEstimate = Math.ceil((batchesEstimate * 60) / 60);

  return NextResponse.json({
    queued,
    message: queued > 0
      ? `${queued} records queued. Enrichment runs in background (~${minutesEstimate} min).`
      : "All records already enriched.",
  });
}
