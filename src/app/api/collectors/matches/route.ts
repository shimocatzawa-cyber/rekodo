import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ─── Scoring helpers ──────────────────────────────────────────────────────────

type UserProfile = {
  artistSet:    Set<string>;
  genreVector:  Map<string, number>;   // genre  → proportion 0-1
  decadeVector: Map<string, number>;   // decade → proportion 0-1
  countries:    Set<string>;
  listArtists:  Set<string>;
};

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { dot += v * (b.get(k) ?? 0); na += v * v; }
  for (const [, v] of b) nb += v * v;
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// IDF-weighted Jaccard: rare shared artists score higher than common ones
function weightedArtistJaccard(a: Set<string>, b: Set<string>, freq: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let num = 0, den = 0;
  const all = new Set([...a, ...b]);
  for (const artist of all) {
    const w   = 1 / Math.log2((freq.get(artist) ?? 1) + 2); // rarer → higher weight
    const inA = a.has(artist) ? 1 : 0;
    const inB = b.has(artist) ? 1 : 0;
    num += w * inA * inB;
    den += w * Math.max(inA, inB);
  }
  return den > 0 ? num / den : 0;
}

// List overlap with 3× weight (same artist in both Top 5 lists is a strong signal)
function listOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const maxPossible = Math.min(a.size, b.size);
  return maxPossible > 0 ? Math.min(1, (shared * 3) / (maxPossible * 3)) : 0;
}

function computeScore(a: UserProfile, b: UserProfile, freq: Map<string, number>): number {
  const artist  = weightedArtistJaccard(a.artistSet,    b.artistSet,    freq) * 40;
  const genre   = cosineSimilarity(      a.genreVector,  b.genreVector)        * 20;
  const decade  = cosineSimilarity(      a.decadeVector, b.decadeVector)        * 15;
  const country = jaccardSimilarity(     a.countries,    b.countries)           *  5;
  const list    = listOverlapScore(      a.listArtists,  b.listArtists)         * 20;
  return Math.min(100, Math.round(artist + genre + decade + country + list));
}

function buildSharedTags(a: UserProfile, b: UserProfile, freq: Map<string, number>): string[] {
  const tags: string[] = [];

  // Top shared genres (by combined weight in both collections)
  const sharedGenres = [...a.genreVector.keys()]
    .filter(g => b.genreVector.has(g))
    .sort((x, y) =>
      ((b.genreVector.get(y) ?? 0) + (a.genreVector.get(y) ?? 0)) -
      ((b.genreVector.get(x) ?? 0) + (a.genreVector.get(x) ?? 0))
    );
  tags.push(...sharedGenres.slice(0, 2));

  // Rarest shared artist (if room for a third tag)
  if (tags.length < 3) {
    const sharedArtists = [...a.artistSet].filter(x => b.artistSet.has(x));
    if (sharedArtists.length > 0) {
      const rarest = sharedArtists.sort((x, y) => (freq.get(x) ?? 1) - (freq.get(y) ?? 1))[0];
      if (!tags.includes(rarest)) tags.push(rarest);
    }
  }

  return tags.slice(0, 3);
}

function compatibilityLabel(score: number): { label: string; description: string } {
  if (score >= 95) return { label: "Twins",                         description: "One of you is the other's alt account. Uncanny." };
  if (score >= 86) return { label: "Same Record, Different Pressing", description: "Same music. Different origin story." };
  if (score >= 76) return { label: "Bandmates",                     description: "You're making the same music, just in different rooms." };
  if (score >= 61) return { label: "Label Mate",                    description: "Same label, different artist. You get it." };
  if (score >= 46) return { label: "The A Side to my B",            description: "Different but part of the same record." };
  if (score >= 31) return { label: "Regular at the Same Shop",      description: "You've definitely flipped through the same crates." };
  if (score >= 16) return { label: "Passing Acquaintance",          description: "You'd nod at each other in a record shop." };
  return              { label: "Complete Stranger",                  description: "Your collections have almost nothing in common. Interesting." };
}

// ─── Build per-user profile from flat record rows ─────────────────────────────

type RecRow  = { user_id: string; artist: string; genre: string | null; year: number | null; country: string | null };
type ListRow = { user_id: string; artist: string };

function buildProfile(records: RecRow[], listRows: ListRow[]): UserProfile {
  const artistSet  = new Set(records.map(r => r.artist));
  const countries  = new Set(records.map(r => r.country).filter((c): c is string => c !== null));
  const listArtists = new Set(listRows.map(r => r.artist));

  const genreCount = new Map<string, number>();
  for (const r of records) if (r.genre) genreCount.set(r.genre, (genreCount.get(r.genre) ?? 0) + 1);
  const genreTotal  = [...genreCount.values()].reduce((a, b) => a + b, 0) || 1;
  const genreVector = new Map([...genreCount.entries()].map(([g, c]) => [g, c / genreTotal]));

  const decadeCount = new Map<string, number>();
  for (const r of records) {
    if (!r.year) continue;
    const d = r.year < 1960 ? "Pre-1960" : `${Math.floor(r.year / 10) * 10}s`;
    decadeCount.set(d, (decadeCount.get(d) ?? 0) + 1);
  }
  const decadeTotal  = [...decadeCount.values()].reduce((a, b) => a + b, 0) || 1;
  const decadeVector = new Map([...decadeCount.entries()].map(([d, c]) => [d, c / decadeTotal]));

  return { artistSet, genreVector, decadeVector, countries, listArtists };
}

// ─── Route ────────────────────────────────────────────────────────────────────

const PAGE = 1000;

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // ── Check cache (24h) ─────────────────────────────────────────────────────
  const cacheExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedRows } = await supabase
    .from("compatibility_scores")
    .select("user_id_b, score, shared_tags")
    .eq("user_id_a", userId)
    .gt("calculated_at", cacheExpiry)
    .order("score", { ascending: false })
    .limit(3);

  // ── Helpers used by both cache and fresh paths ────────────────────────────
  async function enrichMatches(rows: { user_id_b: string; score: number; shared_tags: string[] }[]) {
    const ids = rows.map(r => r.user_id_b);
    if (ids.length === 0) return [];

    const [profilesRes, followerRes, recCountRes, followingRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, location, is_donor").in("id", ids),
      supabase.from("follows").select("following_id").in("following_id", ids),
      supabase.from("user_records").select("user_id").in("user_id", ids),
      viewer
        ? supabase.from("follows").select("following_id").eq("follower_id", viewer.id).in("following_id", ids)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap      = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
    const followerCounts  = new Map<string, number>();
    const recCounts       = new Map<string, number>();
    const viewerFollowing = new Set((followingRes.data ?? []).map((f: { following_id: string }) => f.following_id));

    for (const f of followerRes.data ?? [])  followerCounts.set(f.following_id, (followerCounts.get(f.following_id) ?? 0) + 1);
    for (const r of recCountRes.data ?? [])  recCounts.set(r.user_id, (recCounts.get(r.user_id) ?? 0) + 1);

    return rows.map(row => {
      const p = profileMap.get(row.user_id_b);
      if (!p) return null;
      const { label, description } = compatibilityLabel(row.score);
      return {
        userId:        p.id,
        username:      p.username,
        displayName:   p.display_name,
        location:      p.location,
        recordCount:   recCounts.get(p.id) ?? 0,
        followerCount: followerCounts.get(p.id) ?? 0,
        score:         row.score,
        label,
        description,
        sharedTags:    row.shared_tags ?? [],
        isFollowing:   viewerFollowing.has(p.id),
        isDonor:       p.is_donor ?? false,
      };
    }).filter(Boolean);
  }

  if (cachedRows && cachedRows.length >= 1) {
    const matches = await enrichMatches(cachedRows as { user_id_b: string; score: number; shared_tags: string[] }[]);
    return Response.json({ matches, cached: true });
  }

  // ── Fresh computation ─────────────────────────────────────────────────────

  // 1. Find eligible users (≥20 records, not the target)
  const { data: eligibleLinks } = await supabase
    .from("user_records")
    .select("user_id")
    .neq("user_id", userId)
    .limit(200000);

  const countPerUser = new Map<string, number>();
  for (const l of eligibleLinks ?? []) countPerUser.set(l.user_id, (countPerUser.get(l.user_id) ?? 0) + 1);

  const eligibleIds = [...countPerUser.entries()]
    .filter(([, n]) => n >= 20)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)                 // cap at 50 candidates for performance
    .map(([id]) => id);

  if (eligibleIds.length === 0) return Response.json({ matches: [] });

  const allUserIds = [userId, ...eligibleIds];

  // 2. Fetch all user_records for relevant users (paginated to handle large datasets)
  const urData: { user_id: string; record_id: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("user_records")
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
  type ScoredUser = { userId: string; score: number; sharedTags: string[] };
  const scored: ScoredUser[] = [];

  for (const otherId of eligibleIds) {
    const otherProfile = buildProfile(recordsByUser.get(otherId) ?? [], listRowsByUser.get(otherId) ?? []);
    const score      = computeScore(targetProfile, otherProfile, artistFreq);
    const sharedTags = buildSharedTags(targetProfile, otherProfile, artistFreq);
    scored.push({ userId: otherId, score, sharedTags });
  }

  scored.sort((a, b) => b.score - a.score);

  // 8. Cache results if authenticated (delete-then-insert pattern per project convention)
  if (viewer && scored.length > 0) {
    await supabase.from("compatibility_scores").delete().eq("user_id_a", userId);
    const toInsert = scored.slice(0, 50).map(s => ({
      user_id_a:    userId,
      user_id_b:    s.userId,
      score:        s.score,
      shared_tags:  s.sharedTags,
      calculated_at: new Date().toISOString(),
    }));
    // Insert in chunks to avoid request size limits
    for (let i = 0; i < toInsert.length; i += 20) {
      await supabase.from("compatibility_scores").insert(toInsert.slice(i, i + 20));
    }
  }

  const top3 = scored.slice(0, 3).map(s => ({
    user_id_b:   s.userId,
    score:       s.score,
    shared_tags: s.sharedTags,
  }));

  const matches = await enrichMatches(top3);
  return Response.json({ matches, cached: false });
}
