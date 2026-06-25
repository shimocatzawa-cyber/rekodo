// Generic fuzzy artist/album text matching — catches case, punctuation, and
// minor-formatting differences ("Boards Of Canada" vs "Boards of Canada")
// when comparing a query against a result from an external text search.
// Originally written for Spotify's album search, which is fuzzy and will
// happily return a completely different artist/album as the #1 hit when
// there's no real match (e.g. "Itasca - Morning Flower / Raindrops on the
// Balcony" → "Samplestar - Raindrops on Balcony") — also used for Discogs
// existence-checking (dig/route.ts) and anywhere else that needs to sanity-
// check a fuzzy text-search result before trusting it.

const STRIP_SUFFIXES = [
  "remastered", "deluxe edition", "expanded edition",
  "anniversary edition", "remaster", "reissue", "ep", "lp",
];

export function normalizeTitle(s: string): string {
  let n = s.toLowerCase().replace(/[^\w\s-]/g, " ").trim();
  for (const suffix of STRIP_SUFFIXES) {
    n = n.replace(new RegExp(`\\s+${suffix}\\s*$`, "i"), "").trim();
  }
  return n.replace(/\s+/g, " ").trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const longer  = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

// Word-overlap so a result whose title has extra/reordered words relative to
// the query isn't penalized as hard as plain Levenshtein similarity would.
function tokenOverlap(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared++;
  return shared / Math.max(setA.size, setB.size);
}

// Used standalone for artist-only lookups (e.g. Deep Dive's top-tracks
// search), and as the first gate of isPlausibleAlbumMatch below — a
// wrong-artist hit is the failure mode that actually burns users, so it's
// checked strictly everywhere a Spotify text search result gets trusted.
export function isPlausibleArtistMatch(queryArtist: string, resultArtist: string): boolean {
  const qArtist = normalizeTitle(queryArtist);
  const norm    = normalizeTitle(resultArtist);
  if (!norm || !qArtist) return false;
  return similarity(qArtist, norm) >= 0.6 || norm.includes(qArtist) || qArtist.includes(norm);
}

// Album title is checked looser than artist since formatting (slashes,
// "Various", suffixes) varies a lot between what's logged locally and what
// Spotify calls it.
export function isPlausibleAlbumMatch(
  queryArtist: string,
  queryAlbum: string,
  resultArtists: string[],
  resultAlbum: string,
): boolean {
  if (!resultArtists.some(ra => isPlausibleArtistMatch(queryArtist, ra))) return false;

  const qAlbum = normalizeTitle(queryAlbum);
  const rAlbum = normalizeTitle(resultAlbum);
  return similarity(qAlbum, rAlbum) >= 0.35 || tokenOverlap(qAlbum, rAlbum) >= 0.34;
}
