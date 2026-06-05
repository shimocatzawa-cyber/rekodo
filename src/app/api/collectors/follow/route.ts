import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  // Check current follow state
  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (existing) {
    // Unfollow
    await supabase.from("follows").delete().eq("id", existing.id);
    return Response.json({ isFollowing: false });
  } else {
    // Follow
    await supabase.from("follows").insert({ follower_id: user.id, following_id: followingId });
    return Response.json({ isFollowing: true });
  }
}
