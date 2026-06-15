import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { followingId?: string; action?: string };
  const { followingId, action } = body;

  if (!followingId || typeof followingId !== "string") {
    return Response.json({ error: "Missing followingId" }, { status: 400 });
  }
  if (action !== "follow" && action !== "unfollow") {
    return Response.json({ error: "action must be 'follow' or 'unfollow'" }, { status: 400 });
  }
  if (followingId === user.id) {
    return Response.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  if (action === "follow") {
    // Upsert — safe to call even if the row already exists
    const { error } = await supabase
      .from("follows")
      .upsert(
        { follower_id: user.id, following_id: followingId },
        { onConflict: "follower_id,following_id", ignoreDuplicates: true }
      );
    if (error) {
      console.error("Follow insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ isFollowing: true });
  } else {
    // Delete — safe to call even if the row doesn't exist
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);
    if (error) {
      console.error("Unfollow delete error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ isFollowing: false });
  }
}
