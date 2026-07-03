import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminDb = getAdminDb();

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: jobs, error } = await adminDb
    .from("sync_queue")
    .select("id, user_id, status, phase, progress_done, total_records, current_page, total_pages, error_message, created_at, updated_at")
    .or(`status.in.(pending,processing),and(status.in.(completed,failed),updated_at.gte.${threeHoursAgo})`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs || jobs.length === 0) return NextResponse.json({ jobs: [] });

  const userIds = [...new Set(jobs.map(j => j.user_id))];
  const { data: profiles } = await adminDb
    .from("profiles")
    .select("id, username")
    .in("id", userIds);

  const usernameMap = new Map((profiles ?? []).map(p => [p.id, p.username]));

  return NextResponse.json({
    jobs: jobs.map(j => ({
      id:           j.id,
      userId:       j.user_id,
      username:     usernameMap.get(j.user_id) ?? j.user_id,
      status:       j.status,
      phase:        j.phase,
      progressDone: j.progress_done,
      totalRecords: j.total_records,
      currentPage:  j.current_page,
      totalPages:   j.total_pages,
      startedAt:     j.created_at,
      updatedAt:     j.updated_at,
      errorMessage:  j.error_message ?? null,
    })),
  });
}
