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

  // Check if already following
  const { data: existing, error: selectError } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (selectError) {
    return Response.json({ error: selectError.message }, { status: 500 });
  }

  if (existing) {
    const { error: delError } = await supabase
      .from("follows")
      .delete()
      .eq("id", existing.id);
    if (delError) return Response.json({ error: delError.message }, { status: 500 });
    return Response.json({ isFollowing: false });
  } else {
    const { error: insError } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: followingId });
    if (insError) return Response.json({ error: insError.message }, { status: 500 });
    return Response.json({ isFollowing: true });
  }
}
