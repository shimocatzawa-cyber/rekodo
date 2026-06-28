import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const adminDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error, count } = await adminDb
    .from("compatibility_scores")
    .delete({ count: "exact" })
    .neq("user_id_a", "00000000-0000-0000-0000-000000000000"); // match all rows

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, deleted: count });
}
