import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { buildProfile, computeScore, computeStyleScore, type RecRow } from "@/lib/compatibility";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const targetIds = (request.nextUrl.searchParams.get("targetIds") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (targetIds.length === 0) return Response.json({ scores: [] });

  const viewerId = user.id;

  // Cached collection scores for these pairs
  const [scoresA, scoresB] = await Promise.all([
    supabase.from("compatibility_scores").select("user_id_b, score").eq("user_id_a", viewerId).in("user_id_b", targetIds),
    supabase.from("compatibility_scores").select("user_id_a, score").eq("user_id_b", viewerId).in("user_id_a", targetIds),
  ]);

  const collectionScore = new Map<string, number>();
  for (const r of scoresA.data ?? []) collectionScore.set(r.user_id_b, r.score);
  for (const r of scoresB.data ?? []) collectionScore.set(r.user_id_a, r.score);

  // Fetch genre/year for viewer + all targets to compute style similarity
  const allIds = [viewerId, ...targetIds];
  const PAGE = 1000;
  const recRows: RecRow[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("user_records")
      .select("user_id, records(artist, genre, year, country)")
      .in("user_id", allIds)
      .range(from, from + PAGE - 1) as any;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const r = row.records;
      if (!r) continue;
      recRows.push({ user_id: row.user_id, artist: r.artist, genre: r.genre, year: r.year, country: r.country });
    }
    if (data.length < PAGE) break;
  }

  const byUser = new Map<string, RecRow[]>();
  for (const r of recRows) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }

  // Build artist frequency map for IDF weighting in computeScore.
  // Counts how many distinct users own each artist across all fetched rows.
  const artistUserSets = new Map<string, Set<string>>();
  for (const r of recRows) {
    if (!r.artist) continue;
    const s = artistUserSets.get(r.artist) ?? new Set<string>();
    s.add(r.user_id);
    artistUserSets.set(r.artist, s);
  }
  const artistFreq = new Map<string, number>();
  for (const [artist, users] of artistUserSets) artistFreq.set(artist, users.size);

  const viewerProfile = buildProfile(byUser.get(viewerId) ?? [], []);

  const scores = targetIds.map(id => {
    const targetProfile = buildProfile(byUser.get(id) ?? [], []);
    const styleScore = computeStyleScore(viewerProfile, targetProfile);
    // Use cached collection score if available; otherwise compute on-the-fly
    // from the user_records data already in memory. This ensures the All
    // Collectors list always shows a score even for pairs not yet in the cache.
    const cached = collectionScore.get(id);
    const liveScore = computeScore(viewerProfile, targetProfile, artistFreq);
    return {
      userId: id,
      collectionScore: cached ?? liveScore,
      styleScore,
    };
  });

  return Response.json({ scores });
}
