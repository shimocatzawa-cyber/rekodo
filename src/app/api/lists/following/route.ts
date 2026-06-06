import { createClient } from "@/lib/supabase/server";
import type { DiscoverList } from "@/app/lists/page";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (!follows || follows.length === 0) {
    return Response.json({ lists: [] });
  }

  const followingIds = follows.map(f => f.following_id);

  const { data: pubLists } = await supabase
    .from("lists")
    .select("id, title, slug, user_id")
    .eq("is_public", true)
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!pubLists || pubLists.length === 0) {
    return Response.json({ lists: [] });
  }

  const pubListIds = pubLists.map(l => l.id);
  const pubUserIds = [...new Set(pubLists.map(l => l.user_id))];

  const [{ data: pubProfiles }, { data: pubItems }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").in("id", pubUserIds),
    supabase.from("list_items").select("list_id, position, record_id").in("list_id", pubListIds).order("position"),
  ]);

  const profileById = new Map((pubProfiles ?? []).map(p => [p.id, p]));
  const pubRecordIds = [...new Set((pubItems ?? []).map(i => i.record_id).filter(Boolean) as string[])];
  const { data: pubRecords } = pubRecordIds.length
    ? await supabase.from("records").select("id, cover_url").in("id", pubRecordIds)
    : { data: [] };
  const coverById = new Map((pubRecords ?? []).map(r => [r.id, r.cover_url]));

  const lists: DiscoverList[] = [];
  for (const l of pubLists) {
    const profile = profileById.get(l.user_id);
    if (!profile) continue;
    const items = (pubItems ?? [])
      .filter(i => i.list_id === l.id)
      .sort((a, b) => a.position - b.position);
    const covers = items.slice(0, 4).map(i =>
      i.record_id ? (coverById.get(i.record_id) ?? null) : null
    );
    lists.push({
      id: l.id, title: l.title, slug: l.slug,
      username: profile.username, displayName: profile.display_name ?? null,
      covers, itemCount: items.length, saveCount: 0,
    });
  }

  return Response.json({ lists });
}
