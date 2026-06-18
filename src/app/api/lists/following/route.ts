import { createClient } from "@/lib/supabase/server";
import type { DiscoverList } from "@/app/lists/types";

export const dynamic = "force-dynamic";

function compatLabel(score: number): string {
  if (score >= 70) return "Soul Twin";
  if (score >= 55) return "Doppelgänger Ear";
  if (score >= 40) return "The Same Frequency";
  if (score >= 31) return "Regular at the Same Shop";
  if (score >= 20) return "Overlapping Frequencies";
  if (score >= 10) return "Distant Relatives";
  return "Different Paths";
}

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
    .select("id, title, slug, user_id, list_type")
    .eq("is_public", true)
    .eq("list_type", "top5")
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!pubLists || pubLists.length === 0) {
    return Response.json({ lists: [] });
  }

  const pubListIds = pubLists.map(l => l.id);
  const pubUserIds = [...new Set(pubLists.map(l => l.user_id))];

  const [
    { data: pubProfiles },
    { data: pubItems },
    { data: recCountRows },
    { data: savedRows },
    { data: scoreRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").in("id", pubUserIds),
    supabase.from("list_items").select("list_id, position, record_id").in("list_id", pubListIds).order("position"),
    supabase.from("user_records").select("user_id").in("user_id", pubUserIds),
    supabase.from("saved_lists").select("list_id").eq("user_id", user.id).in("list_id", pubListIds),
    supabase.from("compatibility_scores")
      .select("user_id_b, score")
      .eq("user_id_a", user.id)
      .in("user_id_b", pubUserIds),
  ]);

  const profileById = new Map((pubProfiles ?? []).map(p => [p.id, p]));

  const recCounts = new Map<string, number>();
  for (const r of recCountRows ?? []) recCounts.set(r.user_id, (recCounts.get(r.user_id) ?? 0) + 1);

  const savedSet = new Set((savedRows ?? []).map(r => r.list_id as string));

  const scoreByUser = new Map<string, number>(
    (scoreRows ?? []).map(r => [r.user_id_b as string, r.score as number])
  );

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
    // Skip top5 lists that aren't fully filled (need all 5 slots)
    if (items.length < 5) continue;
    const covers = items.slice(0, 4).map(i =>
      i.record_id ? (coverById.get(i.record_id) ?? null) : null
    );
    const score = scoreByUser.get(l.user_id);
    lists.push({
      id: l.id, title: l.title, slug: l.slug,
      userId: l.user_id,
      username: profile.username, displayName: profile.display_name ?? null,
      covers, itemCount: items.length, saveCount: 0,
      recordCount: recCounts.get(l.user_id) ?? 0,
      isSaved: savedSet.has(l.id),
      matchScore: score,
      matchLabel: score !== undefined ? compatLabel(score) : undefined,
    });
  }

  return Response.json({ lists });
}
