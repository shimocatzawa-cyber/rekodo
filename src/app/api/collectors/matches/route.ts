import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import {
  type RecRow,
  type ListRow,
  buildProfile,
  computeScore,
  computeStyleScore,
  buildSharedTags,
  compatibilityLabel,
  CACHE_TTL_MS,
} from "@/lib/compatibility";

export const dynamic = "force-dynamic";

// ─── Route ────────────────────────────────────────────────────────────────────

const PAGE = 1000;
const DISPLAY_COUNT = 6; // how many top matches are shown on the page

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // Requires login (not ownership — viewing matches on any public profile is
  // intended) so the expensive scoring computation below can't be triggered
  // by anonymous, unauthenticated traffic.
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // ── Check cache ───────────────────────────────────────────────────────────
  const cacheExpiry = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data: cachedRows } = await supabase
    .from("compatibility_scores")
    .select("user_id_b, score, shared_tags")
    .eq("user_id_a", userId)
    .gt("calculated_at", cacheExpiry)
    .order("score", { ascending: false })
    .limit(1000);

  // ── Helpers used by both cache and fresh paths ────────────────────────────
  async function enrichMatches(rows: { user_id_b: string; score: number; style_score?: number; shared_tags: string[] }[]) {
    const ids = rows.map(r => r.user_id_b);
    if (ids.length === 0) return [];

    // recCounts is paginated below (not part of this Promise.all) since a
    // single .in() select can silently truncate at PostgREST's default row
    // cap when the matched users have large collections.
    const [profilesRes, followerRes, followingRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, city, country, is_donor, is_test").in("id", ids),
      supabase.from("follows").select("following_id").in("following_id", ids),
      viewer
        ? supabase.from("follows").select("following_id").eq("follower_id", viewer.id).in("following_id", ids)
        : Promise.resolve({ data: [] }),
    ]);

    const recCounts = new Map<string, number>();
    for (let from = 0; ; from += PAGE) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("public_collection_summary")
        .select("user_id")
        .in("user_id", ids)
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      for (const r of data) recCounts.set(r.user_id, (recCounts.get(r.user_id) ?? 0) + 1);
      if (data.length < PAGE) break;
    }

    const profileMap      = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
    const followerCounts  = new Map<string, number>();
    const viewerFollowing = new Set((followingRes.data ?? []).map((f: { following_id: string }) => f.following_id));

    for (const f of followerRes.data ?? [])  followerCounts.set(f.following_id, (followerCounts.get(f.following_id) ?? 0) + 1);

    return rows.map(row => {
      const p = profileMap.get(row.user_id_b);
      // Covers rows already cached before test accounts were excluded from
      // candidacy — never surface one even if it's still sitting in the cache.
      if (!p || p.is_test) return null;
      const { label, description } = compatibilityLabel(row.score);
      return {
        userId:        p.id,
        username:      p.username,
        displayName:   p.display_name,
        avatarUrl:     p.avatar_url ?? null,
        location:      p.city && p.country ? `${p.city}, ${p.country}` : (p.city ?? null),
        recordCount:   recCounts.get(p.id) ?? 0,
        followerCount: followerCounts.get(p.id) ?? 0,
        score:         row.score,
        styleScore:    row.style_score ?? 0,
        label,
        description,
        sharedTags:    row.shared_tags ?? [],
        isFollowing:   viewerFollowing.has(p.id),
        isDonor:       p.is_donor ?? false,
      };
    }).filter(Boolean);
  }

  if (cachedRows && cachedRows.length >= 1) {
    const topRows = cachedRows.slice(0, DISPLAY_COUNT);
    const matches = await enrichMatches(topRows as { user_id_b: string; score: number; style_score?: number; shared_tags: string[] }[]);
    // Only trust the cache if it returned a full display set — fewer means
    // either stale entries were filtered out or new users have joined since
    // the cache was built, so fall through to a fresh computation.
    if (matches.length >= DISPLAY_COUNT) {
      const allScores = cachedRows.map(r => ({ userId: r.user_id_b, score: r.score, sharedTags: r.shared_tags ?? [] }));
      return Response.json({ matches, allScores, cached: true });
    }
  }

  // ── Fresh computation ─────────────────────────────────────────────────────

  // 1. Find eligible users (any collection, not the target, not a test account)
  // A single .limit(200000) call here used to look like it fetched
  // everything, but PostgREST's db-max-rows server config (1000) silently
  // caps any client-requested limit above that — so it only ever saw the
  // first 1000 rows. Once total rows across users passed that, smaller
  // collectors (e.g. a 33-record collection sorted behind two collectors
  // with 1000+ rows between them) were missing from candidacy entirely,
  // before scoring ever ran. Paginate past the cap instead.
  async function fetchAllEligibleLinks(): Promise<{ user_id: string }[]> {
    const rows: { user_id: string }[] = [];
    for (let from = 0; ; from += PAGE) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("public_collection_summary")
        .select("user_id")
        .neq("user_id", userId)
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    return rows;
  }

  const [eligibleLinks, { data: testRows }] = await Promise.all([
    fetchAllEligibleLinks(),
    supabase.from("profiles").select("id").eq("is_test", true),
  ]);

  const testIds = new Set((testRows ?? []).map(r => r.id));

  const countPerUser = new Map<string, number>();
  for (const l of eligibleLinks) {
    if (testIds.has(l.user_id)) continue;
    countPerUser.set(l.user_id, (countPerUser.get(l.user_id) ?? 0) + 1);
  }

  const eligibleIds = [...countPerUser.entries()]
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)                 // cap at 50 candidates for performance
    .map(([id]) => id);

  if (eligibleIds.length === 0) return Response.json({ matches: [] });

  const allUserIds = [userId, ...eligibleIds];

  // 2. Fetch all user_records for relevant users (paginated to handle large datasets)
  const urData: { user_id: string; record_id: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("public_collection_summary")
      .select("user_id, record_id")
      .in("user_id", allUserIds)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    urData.push(...data);
    if (data.length < PAGE) break;
  }

  // Build record_id → set of user_ids mapping, and per-user record_ids
  const recordUserSets  = new Map<string, Set<string>>();   // record_id → user_ids
  const userRecordIds   = new Map<string, string[]>();       // user_id → record_ids
  for (const { user_id, record_id } of urData) {
    if (!recordUserSets.has(record_id)) recordUserSets.set(record_id, new Set());
    recordUserSets.get(record_id)!.add(user_id);
    if (!userRecordIds.has(user_id)) userRecordIds.set(user_id, []);
    userRecordIds.get(user_id)!.push(record_id);
  }

  // 3. Fetch record details (artist, genre, year, country) in batches
  const allRecordIds = [...recordUserSets.keys()];
  const recordDetail  = new Map<string, { artist: string; genre: string | null; year: number | null; country: string | null }>();
  const BATCH = 400;
  for (let i = 0; i < allRecordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, artist, genre, year, country")
      .in("id", allRecordIds.slice(i, i + BATCH));
    for (const r of data ?? []) recordDetail.set(r.id, r);
  }

  // 4. Build per-user flat record rows
  const recordsByUser = new Map<string, RecRow[]>();
  for (const uid of allUserIds) recordsByUser.set(uid, []);
  for (const [recordId, userIds] of recordUserSets) {
    const d = recordDetail.get(recordId);
    if (!d) continue;
    for (const uid of userIds) {
      recordsByUser.get(uid)?.push({ user_id: uid, ...d });
    }
  }

  // 5. Fetch list artists for all users
  const { data: listsData } = await supabase
    .from("lists")
    .select("id, user_id")
    .in("user_id", allUserIds)
    .eq("is_public", true);

  const listIds    = (listsData ?? []).map(l => l.id);
  const listOwner  = new Map((listsData ?? []).map(l => [l.id, l.user_id]));
  const listRowsByUser = new Map<string, ListRow[]>();
  for (const uid of allUserIds) listRowsByUser.set(uid, []);

  if (listIds.length > 0) {
    const { data: liData } = await supabase
      .from("list_items")
      .select("list_id, record_id")
      .in("list_id", listIds)
      .not("record_id", "is", null);

    const liRecordIds = [...new Set((liData ?? []).map(i => i.record_id!))];
    const { data: liRecords } = liRecordIds.length
      ? await supabase.from("records").select("id, artist").in("id", liRecordIds.slice(0, 2000))
      : { data: [] };
    const liArtistMap = new Map((liRecords ?? []).map(r => [r.id, r.artist]));

    for (const item of liData ?? []) {
      const uid    = listOwner.get(item.list_id);
      const artist = item.record_id ? liArtistMap.get(item.record_id) : undefined;
      if (uid && artist) listRowsByUser.get(uid)?.push({ user_id: uid, artist });
    }
  }

  // 6. Build user profiles
  const targetProfile = buildProfile(recordsByUser.get(userId) ?? [], listRowsByUser.get(userId) ?? []);

  // Artist frequency map (how many users own each artist)
  const artistFreq = new Map<string, number>();
  for (const [recordId, userIds] of recordUserSets) {
    const artist = recordDetail.get(recordId)?.artist;
    if (!artist) continue;
    // Sum up unique users per artist
    const existing = artistFreq.get(artist) ?? 0;
    artistFreq.set(artist, Math.max(existing, userIds.size)); // upper bound
  }

  // 7. Score all candidates
  type ScoredUser = { userId: string; score: number; styleScore: number; sharedTags: string[] };
  const scored: ScoredUser[] = [];

  for (const otherId of eligibleIds) {
    const otherProfile = buildProfile(recordsByUser.get(otherId) ?? [], listRowsByUser.get(otherId) ?? []);
    const score      = computeScore(targetProfile, otherProfile, artistFreq);
    const styleScore = computeStyleScore(targetProfile, otherProfile);
    const sharedTags = buildSharedTags(targetProfile, otherProfile, artistFreq);
    scored.push({ userId: otherId, score, styleScore, sharedTags });
  }

  scored.sort((a, b) => b.score - a.score);

  // 8. Cache results (delete-then-insert pattern per project convention).
  // Uses the service role client since these rows are a shared cache keyed by
  // the profile being viewed (user_id_a), not by the viewer — the server
  // computes and writes them on the viewer's behalf rather than the viewer
  // writing their own rows, so this can't go through the viewer's RLS-scoped session.
  if (scored.length > 0) {
    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    await adminDb.from("compatibility_scores").delete().eq("user_id_a", userId);
    const toInsert = scored.slice(0, 50).map(s => ({
      user_id_a:    userId,
      user_id_b:    s.userId,
      score:        s.score,
      shared_tags:  s.sharedTags,
      calculated_at: new Date().toISOString(),
    }));
    // Insert in chunks to avoid request size limits
    for (let i = 0; i < toInsert.length; i += 20) {
      await adminDb.from("compatibility_scores").insert(toInsert.slice(i, i + 20));
    }
  }

  const topMatches = scored.slice(0, DISPLAY_COUNT).map(s => ({
    user_id_b:   s.userId,
    score:       s.score,
    style_score: s.styleScore,
    shared_tags: s.sharedTags,
  }));

  const matches   = await enrichMatches(topMatches);
  const allScores = scored.map(s => ({ userId: s.userId, score: s.score, sharedTags: s.sharedTags }));
  return Response.json({ matches, allScores, cached: false });
}
