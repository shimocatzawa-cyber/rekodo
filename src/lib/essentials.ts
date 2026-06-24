import type { SupabaseClient } from "@supabase/supabase-js";

export type EssentialsSummary = {
  total: number;
  primaryGenre: string | null;
  primaryGenrePct: number;
  covers: { artist: string; album: string; coverUrl: string | null }[];
};

// Mirrors the essentials-wall aggregation in src/app/insights/page.tsx, but
// scoped to any user (via the public_essentials view) instead of just the
// signed-in owner, so it can be shown on a public profile.
export async function getPublicEssentials(
  supabase: SupabaseClient,
  userId: string
): Promise<EssentialsSummary | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: links } = await (supabase as any)
    .from("public_essentials")
    .select("record_id, date_added")
    .eq("user_id", userId);

  if (!links || links.length === 0) return null;

  const recordIds = links.map((l: { record_id: string }) => l.record_id);
  const { data: records } = await supabase
    .from("records")
    .select("id, artist, album, genre, cover_url")
    .in("id", recordIds);

  const recordById = new Map((records ?? []).map(r => [r.id, r]));

  const sorted = [...links].sort(
    (a: { date_added: string | null }, b: { date_added: string | null }) =>
      new Date(b.date_added ?? 0).getTime() - new Date(a.date_added ?? 0).getTime()
  );

  const genreCounts = new Map<string, number>();
  for (const l of sorted) {
    const genre = recordById.get(l.record_id)?.genre ?? "Unknown";
    genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }

  let primaryGenre: string | null = null;
  let primaryGenrePct = 0;
  if (genreCounts.size > 0) {
    const [topGenre, topCount] = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    primaryGenre = topGenre;
    primaryGenrePct = Math.round((topCount / sorted.length) * 100);
  }

  type Cover = { artist: string; album: string; coverUrl: string | null };
  const covers: Cover[] = sorted
    .map((l: { record_id: string }): Cover | null => {
      const r = recordById.get(l.record_id);
      if (!r) return null;
      return { artist: r.artist, album: r.album, coverUrl: r.cover_url ?? null };
    })
    .filter((c: Cover | null): c is Cover => c !== null);

  return { total: sorted.length, primaryGenre, primaryGenrePct, covers };
}
