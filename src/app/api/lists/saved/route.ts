import { createClient } from "@/lib/supabase/server";
import type { DiscoverList } from "@/app/lists/types";

export const dynamic = "force-dynamic";

function compatLabel(score: number): string {
  if (score >= 70) return "Soul Twin";
  if (score >= 55) return "Doppelgänger Ear";
  if (score >= 42) return "The Same Frequency";
  if (score >= 30) return "Regular at the Same Shop";
  if (score >= 20) return "Overlapping Frequencies";
  if (score >= 12) return "Distant Relatives";
  return "Different Paths";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: savedRows } = await supabase
    .from("saved_lists")
    .select("list_id")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  if (!savedRows?.length) return Response.json({ lists: [] });

  const listIds = savedRows.map(r => r.list_id as string);

  const { data: listsData } = await supabase
    .from("lists")
    .select("id, title, slug, user_id")
    .in("id", listIds)
    .eq("is_public", true);

  if (!listsData?.length) return Response.json({ lists: [] });

  const userIds = [...new Set(listsData.map(l => l.user_id))];

  const [
    { data: profiles },
    { data: items },
    { data: recCountRows },
    { data: scoreRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").in("id", userIds),
    supabase.from("list_items").select("list_id, position, record_id").in("list_id", listIds).order("position"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("public_collection_summary").select("user_id").in("user_id", userIds),
    supabase.from("compatibility_scores")
      .select("user_id_b, score")
      .eq("user_id_a", user.id)
      .in("user_id_b", userIds),
  ]);

  const profileById  = new Map((profiles ?? []).map(p => [p.id, p]));
  const recCounts    = new Map<string, number>();
  for (const r of recCountRows ?? []) recCounts.set(r.user_id, (recCounts.get(r.user_id) ?? 0) + 1);
  const scoreByUser  = new Map<string, number>(
    (scoreRows ?? []).map(r => [r.user_id_b as string, r.score as number])
  );

  const recordIds = [...new Set((items ?? []).map(i => i.record_id).filter(Boolean) as string[])];
  const { data: records } = recordIds.length
    ? await supabase.from("records").select("id, cover_url").in("id", recordIds)
    : { data: [] };
  const coverById = new Map((records ?? []).map(r => [r.id, r.cover_url]));

  // Preserve the saved order (savedRows is already sorted by saved_at desc)
  const listById = new Map(listsData.map(l => [l.id, l]));
  const lists: DiscoverList[] = [];

  for (const { list_id } of savedRows) {
    const l = listById.get(list_id as string);
    if (!l) continue;
    const profile = profileById.get(l.user_id);
    if (!profile) continue;
    const listItems = (items ?? [])
      .filter(i => i.list_id === l.id)
      .sort((a, b) => a.position - b.position);
    const covers = listItems.slice(0, 4).map(i =>
      i.record_id ? (coverById.get(i.record_id) ?? null) : null
    );
    const score = scoreByUser.get(l.user_id);
    lists.push({
      id: l.id, title: l.title, slug: l.slug,
      userId: l.user_id,
      username: profile.username, displayName: profile.display_name ?? null,
      covers, itemCount: listItems.length, saveCount: 0,
      recordCount: recCounts.get(l.user_id) ?? 0,
      isSaved: true,
      matchScore: score,
      matchLabel: score !== undefined ? compatLabel(score) : undefined,
    });
  }

  return Response.json({ lists });
}
