import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getServiceClient() as any;

  // 1. Fetch posts
  const { data: posts, error } = await db
    .from("shelf_posts")
    .select("id, image_url, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    console.error("[shelf/wall] posts query:", error);
    return NextResponse.json({ posts: [] });
  }
  if (!posts?.length) return NextResponse.json({ posts: [] });

  const postIds  = posts.map((p: any) => p.id);
  const userIds  = [...new Set<string>(posts.map((p: any) => p.user_id))];

  // 2. Fetch profiles + likes in parallel
  const [profilesRes, likesRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_donor")
      .in("id", userIds),
    db
      .from("shelf_post_likes")
      .select("post_id, user_id")
      .in("post_id", postIds),
  ]);

  const profileMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (profilesRes.data ?? []).map((p: any) => [p.id, p])
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const likes = (likesRes.data ?? []) as { post_id: string; user_id: string }[];

  const likeCountMap = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const l of likes) {
    likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) ?? 0) + 1);
    if (user && l.user_id === user.id) likedByMeSet.add(l.post_id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = posts.map((p: any) => {
    const profile = profileMap.get(p.user_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = profile as any;
    return {
      id:          p.id,
      imageUrl:    p.image_url,
      createdAt:   p.created_at,
      userId:      p.user_id,
      username:    prof?.username     ?? "",
      displayName: prof?.display_name ?? null,
      avatarUrl:   prof?.avatar_url   ?? null,
      isDonor:     prof?.is_donor     ?? false,
      likeCount:   likeCountMap.get(p.id) ?? 0,
      likedByMe:   likedByMeSet.has(p.id),
    };
  });

  return NextResponse.json({ posts: mapped });
}
