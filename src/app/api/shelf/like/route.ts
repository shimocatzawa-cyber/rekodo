import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await request.json() as { postId?: string };
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: existing } = await db
    .from("shelf_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("shelf_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Failed to unlike" }, { status: 500 });
    return NextResponse.json({ liked: false });
  } else {
    const { error } = await db.from("shelf_post_likes").insert({ post_id: postId, user_id: user.id });
    if (error) return NextResponse.json({ error: "Failed to like" }, { status: 500 });
    return NextResponse.json({ liked: true });
  }
}
