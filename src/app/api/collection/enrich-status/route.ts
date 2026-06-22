import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Polled every 8s by CollectionClient while enrichment is in progress. Also
// owns re-triggering csv-enrich for the next batch — enrich-all only fires
// the first one, and csv-enrich no longer self-chains (that bare
// server-to-server fetch() pattern was found unreliable on Vercel, the same
// lesson already learned for the Spotify matcher). Using the most recent
// enrichment_attempted_at as an activity signal avoids needing a separate
// lock column: if nothing's been touched in the last 20s, the previous
// batch finished (or silently died) and it's safe to fire another.
const RETRIGGER_IF_IDLE_MS = 20_000;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    { count: total },
    { count: enrichedCount },
    { count: pendingCount },
    { count: failedCount },
  ] = await Promise.all([
    (supabase as any)
      .from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("enrichment_status", "is", null),
    (supabase as any)
      .from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("enrichment_status", "enriched"),
    (supabase as any)
      .from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("enrichment_status", "pending"),
    (supabase as any)
      .from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("enrichment_status", "failed"),
  ]) as [
    { count: number | null },
    { count: number | null },
    { count: number | null },
    { count: number | null },
  ];

  const t  = total ?? 0;
  const e  = enrichedCount ?? 0;
  const p  = pendingCount ?? 0;
  const f  = failedCount ?? 0;
  const pct = t > 0 ? Math.round((e / t) * 100) : 0;

  if (p > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastAttempt } = await (supabase as any)
      .from("user_records")
      .select("enrichment_attempted_at")
      .eq("user_id", user.id)
      .not("enrichment_attempted_at", "is", null)
      .order("enrichment_attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { enrichment_attempted_at: string } | null };

    const lastAttemptAt = lastAttempt?.enrichment_attempted_at
      ? new Date(lastAttempt.enrichment_attempted_at).getTime()
      : 0;

    if (Date.now() - lastAttemptAt > RETRIGGER_IF_IDLE_MS) {
      const enrichUrl = new URL("/api/collection/csv-enrich", request.url).toString();
      after(async () => {
        try {
          await fetch(enrichUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-rekodo-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
            },
            body: JSON.stringify({ userId: user.id }),
          });
        } catch (err) {
          console.error(`[enrich-status] csv-enrich trigger failed for user ${user.id}:`, err);
        }
      });
    }
  }

  return NextResponse.json({
    total:           t,
    enriched:        e,
    pending:         p,
    failed:          f,
    percentComplete: pct,
  });
}
