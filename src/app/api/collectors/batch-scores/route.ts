import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { buildProfile, computeScore, computeStyleScore, type RecRow } from "@/lib/compatibility";

export const dynamic = "force-dynamic";
export const preferredRegion = "syd1";

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

  // Fetch genre/year for viewer + all targets to compute style similarity.
  // Uses get_user_collection_data (security definer) to bypass the RLS policy
  // on user_records that restricts SELECT to own rows only — without it, other
  // users' profiles come back empty and all scores compute as 0.
  const allIds = [viewerId, ...targetIds];
  const { data: rpcData } = await (supabase as any).rpc("get_user_collection_data", { user_ids: allIds });
  const recRows: RecRow[] = (rpcData ?? []).map((row: any) => ({
    user_id: row.user_id,
    artist:  row.artist,
    genre:   row.genre,
    year:    row.year,
    country: row.country,
  }));

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
