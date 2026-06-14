import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Verify identity via cookie-based session client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { followingId } = await request.json().catch(() => ({}));
  if (!followingId || typeof followingId !== "string") {
    return Response.json({ error: "Missing followingId" }, { status: 400 });
  }
  if (followingId === user.id) {
    return Response.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  // Service-role client bypasses RLS for the actual DB writes.
  // Auth is already verified above so this is safe.
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing, error: selectError } = await admin
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (selectError) {
    return Response.json({ error: selectError.message }, { status: 500 });
  }

  if (existing) {
    const { error: delError } = await admin
      .from("follows")
      .delete()
      .eq("id", existing.id);
    if (delError) return Response.json({ error: delError.message }, { status: 500 });
    return Response.json({ isFollowing: false });
  } else {
    const { error: insError } = await admin
      .from("follows")
      .insert({ follower_id: user.id, following_id: followingId });
    if (insError) return Response.json({ error: insError.message }, { status: 500 });
    return Response.json({ isFollowing: true });
  }
}
