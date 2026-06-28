import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserProfile = {
  artistSet:    Set<string>;
  genreVector:  Map<string, number>;   // genre  → proportion 0-1
  decadeVector: Map<string, number>;   // decade → proportion 0-1
  countries:    Set<string>;
  listArtists:  Set<string>;
};

export type RecRow  = { user_id: string; artist: string; genre: string | null; year: number | null; country: string | null };
export type ListRow = { user_id: string; artist: string };

// ─── Scoring helpers ────────────────────────────────────────────────────────

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { dot += v * (b.get(k) ?? 0); na += v * v; }
  for (const [, v] of b) nb += v * v;
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// IDF-weighted Jaccard: rare shared artists score higher than common ones
export function weightedArtistJaccard(a: Set<string>, b: Set<string>, freq: Map<string, number>): number {
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
export function listOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const maxPossible = Math.min(a.size, b.size);
  return maxPossible > 0 ? Math.min(1, (shared * 3) / (maxPossible * 3)) : 0;
}

export function computeScore(a: UserProfile, b: UserProfile, freq: Map<string, number>): number {
  const artist = weightedArtistJaccard(a.artistSet,   b.artistSet,   freq) * 70;
  const genre  = cosineSimilarity(     a.genreVector, b.genreVector)       * 30;
  return Math.min(100, Math.round(artist + genre));
}

export function buildSharedTags(a: UserProfile, b: UserProfile, freq: Map<string, number>): string[] {
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

export function compatibilityLabel(score: number): { label: string; description: string } {
  if (score >= 70) return { label: "Twins",                         description: "One of you is the other's alt account. Uncanny." };
  if (score >= 55) return { label: "Same Record, Different Pressing", description: "Same music. Different origin story." };
  if (score >= 42) return { label: "Bandmates",                     description: "You're making the same music, just in different rooms." };
  if (score >= 30) return { label: "Label Mate",                    description: "Same label, different artist. You get it." };
  if (score >= 20) return { label: "The A Side to my B",            description: "Different but part of the same record." };
  if (score >= 12) return { label: "Regular at the Same Shop",      description: "You've definitely flipped through the same crates." };
  if (score >=  5) return { label: "Passing Acquaintance",          description: "You'd nod at each other in a record shop." };
  return              { label: "Complete Stranger",                  description: "Your collections have almost nothing in common. Interesting." };
}

// ─── Build per-user profile from flat record rows ──────────────────────────

export function buildProfile(records: RecRow[], listRows: ListRow[]): UserProfile {
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

// ─── On-demand single-pair scoring ─────────────────────────────────────────
// Used by the Collectors I Follow feed and the public profile page — any
// place that needs a compatibility score for one specific pair of users.
//
// /api/collectors/matches ranks a user against ~50 platform-wide candidates,
// which needs a platform-wide artist-frequency map for the IDF weighting.
// For a single known pair we skip that candidate scan entirely and scope the
// frequency map to just these two users' artist sets — a deliberate
// simplification that keeps this cheap enough to run per feed item. Scores
// computed this way are directionally consistent with Top Matches but not
// guaranteed bit-identical for the same pair.

// Shared by /api/collectors/matches too. Short enough that a newly-connected
// user (or a big collection sync) shows up in Top Matches within a reasonable
// wait rather than up to a day later, while still keeping most profile views
// served from a warm cache instead of re-running the full scoring pass.
export const CACHE_TTL_MS = 20 * 60 * 1000;

async function fetchUserProfile(supabase: SupabaseClient, userId: string): Promise<UserProfile> {
  const PAGE = 1000;
  const recordIds: string[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("public_collection_summary")
      .select("record_id")
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    recordIds.push(...data.map((r: { record_id: string }) => r.record_id));
    if (data.length < PAGE) break;
  }

  const records: RecRow[] = [];
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, artist, genre, year, country")
      .in("id", recordIds.slice(i, i + BATCH));
    for (const r of data ?? []) {
      records.push({ user_id: userId, artist: r.artist, genre: r.genre, year: r.year, country: r.country });
    }
  }

  const { data: listsData } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_public", true);

  const listArtists: ListRow[] = [];
  const listIds = (listsData ?? []).map(l => l.id);
  if (listIds.length > 0) {
    const { data: liData } = await supabase
      .from("list_items")
      .select("record_id")
      .in("list_id", listIds)
      .not("record_id", "is", null);

    const liRecordIds = [...new Set((liData ?? []).map(i => i.record_id!))].slice(0, 2000);
    if (liRecordIds.length > 0) {
      const { data: liRecords } = await supabase.from("records").select("id, artist").in("id", liRecordIds);
      const artistById = new Map((liRecords ?? []).map(r => [r.id, r.artist]));
      for (const item of liData ?? []) {
        const artist = item.record_id ? artistById.get(item.record_id) : undefined;
        if (artist) listArtists.push({ user_id: userId, artist });
      }
    }
  }

  return buildProfile(records, listArtists);
}

export type CompatibilityResult = { score: number; label: string; description: string; sharedTags: string[] };

export async function getOrComputeCompatibility(
  supabase: SupabaseClient,
  viewerId: string,
  otherUserId: string
): Promise<CompatibilityResult | null> {
  if (viewerId === otherUserId) return null;

  const cacheExpiry = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data: cached } = await supabase
    .from("compatibility_scores")
    .select("score, shared_tags")
    .eq("user_id_a", viewerId)
    .eq("user_id_b", otherUserId)
    .gt("calculated_at", cacheExpiry)
    .maybeSingle();

  if (cached) {
    const { label, description } = compatibilityLabel(cached.score);
    return { score: cached.score, label, description, sharedTags: cached.shared_tags ?? [] };
  }

  const [viewerProfile, otherProfile] = await Promise.all([
    fetchUserProfile(supabase, viewerId),
    fetchUserProfile(supabase, otherUserId),
  ]);

  if (viewerProfile.artistSet.size === 0 || otherProfile.artistSet.size === 0) return null;

  const artistFreq = new Map<string, number>();
  for (const artist of new Set([...viewerProfile.artistSet, ...otherProfile.artistSet])) {
    const inViewer = viewerProfile.artistSet.has(artist) ? 1 : 0;
    const inOther  = otherProfile.artistSet.has(artist) ? 1 : 0;
    artistFreq.set(artist, inViewer + inOther);
  }

  const score      = computeScore(viewerProfile, otherProfile, artistFreq);
  const sharedTags = buildSharedTags(viewerProfile, otherProfile, artistFreq);
  const { label, description } = compatibilityLabel(score);

  // Writes are service-role-only per 20260623000003_lock_down_compatibility_scores_writes.sql
  const serviceDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  await serviceDb.from("compatibility_scores").upsert(
    {
      user_id_a: viewerId,
      user_id_b: otherUserId,
      score,
      shared_tags: sharedTags,
      calculated_at: new Date().toISOString(),
    },
    { onConflict: "user_id_a,user_id_b" }
  );

  return { score, label, description, sharedTags };
}
