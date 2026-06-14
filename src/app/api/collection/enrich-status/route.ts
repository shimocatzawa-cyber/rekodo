import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return NextResponse.json({
    total:           t,
    enriched:        e,
    pending:         p,
    failed:          f,
    percentComplete: pct,
  });
}
