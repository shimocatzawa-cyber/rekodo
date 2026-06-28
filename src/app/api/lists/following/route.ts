import { createClient } from "@/lib/supabase/server";
import type { DiscoverList } from "@/app/lists/types";

export const dynamic = "force-dynamic";

function compatLabel(score: number): string {
  if (score >= 55) return "Twins";
  if (score >= 35) return "Same Record, Different Pressing";
  if (score >= 20) return "Bandmates";
  if (score >= 10) return "Label Mate";
  if (score >=  5) return "The A Side to My B";
  if (score >=  2) return "Regular at the Same Shop";
  if (score >=  1) return "Passing Acquaintance";
  return "Complete Stranger";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: pubLists } = await supabase
    .from("lists")
    .select("id, title, slug, user_id, list_type")
    .eq("is_public", true)
    .eq("list_type", "top5")
    .order("created_at", { ascending: false })
    .limit(100);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("public_collection_summary").select("user_id").in("user_id", pubUserIds),
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
    if (items.length === 0) continue;
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
