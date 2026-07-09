import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: posts, error } = await (supabase as any)
    .from("shelf_posts")
    .select(`
      id,
      image_url,
      created_at,
      user_id,
      profiles!shelf_posts_user_id_fkey (
        username,
        display_name,
        avatar_url,
        is_donor
      ),
      shelf_post_likes ( user_id )
    `)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    console.error("[shelf/wall]", error);
    return NextResponse.json({ posts: [] });
  }

  const viewerId = user?.id ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (posts ?? []).map((p: any) => ({
    id:          p.id,
    imageUrl:    p.image_url,
    createdAt:   p.created_at,
    userId:      p.user_id,
    username:    p.profiles?.username ?? "",
    displayName: p.profiles?.display_name ?? null,
    avatarUrl:   p.profiles?.avatar_url ?? null,
    isDonor:     p.profiles?.is_donor ?? false,
    likeCount:   (p.shelf_post_likes ?? []).length,
    likedByMe:   viewerId ? (p.shelf_post_likes ?? []).some((l: any) => l.user_id === viewerId) : false,
  }));

  return NextResponse.json({ posts: mapped });
}
