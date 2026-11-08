import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Find all record IDs that have a discogs_id but no cover_url
  const { data: records, error: recErr } = await service
    .from("records")
    .select("id")
    .not("discogs_id", "is", null)
    .or("cover_url.is.null,cover_url.eq.");

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
  if (!records?.length) return NextResponse.json({ reset: 0 });

  const recordIds = records.map((r: { id: string }) => r.id);

  // 2. Reset enrichment_status → 'pending' for any user_record pointing at those records
  const BATCH = 200;
  let totalReset = 0;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { count, error } = await (service as any)
      .from("user_records")
      .update({ enrichment_status: "pending", enrichment_attempted_at: null })
      .in("record_id", recordIds.slice(i, i + BATCH))
      .eq("enrichment_status", "enriched")
      .select("*", { count: "exact", head: true });
    if (error) console.error("requeue batch error:", error.message);
    totalReset += count ?? 0;
  }

  return NextResponse.json({ reset: totalReset });
}
