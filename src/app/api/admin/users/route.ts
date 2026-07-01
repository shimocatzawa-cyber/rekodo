import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb, enrichProfiles, PROFILE_COLUMNS, ADMIN_PAGE_SIZE } from "@/app/admin/lib";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const offset = Math.max(0, parseInt(params.get("offset") ?? "0", 10));
  const limit  = Math.min(200, Math.max(1, parseInt(params.get("limit") ?? String(ADMIN_PAGE_SIZE), 10)));

  const adminDb = getAdminDb();
  const { data: profiles, error } = await adminDb
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("last_active_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[api/admin/users] profiles fetch failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = await enrichProfiles(adminDb, profiles ?? []);
  return NextResponse.json({ users });
}
