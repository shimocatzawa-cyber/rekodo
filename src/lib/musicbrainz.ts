const MB_API   = "https://musicbrainz.org/ws/2";
const UA       = "rekodo/1.0 (shimocatzawa@gmail.com)";
const CACHE_KEY = "rekodo_mb_v3";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_MS  = 1200; // MusicBrainz allows 1 req/sec; 1.2s is safe

export interface MBRelation {
  type:       string;
  direction:  "forward" | "backward";
  targetName: string;
  targetMbid: string;
}

export interface MBArtistData {
  mbid:      string;
  tags:      string[];
  relations: MBRelation[];
  fetchedAt: number;
}

// ── Rate limiter ───────────────────────────────────────────────────────────────

let _lastCall = 0;

async function mbFetch(url: string): Promise<Response> {
  const wait = Math.max(0, RATE_MS - (Date.now() - _lastCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCall = Date.now();
  return fetch(url, { headers: { "User-Agent": UA } });
}

// ── localStorage cache ─────────────────────────────────────────────────────────

let _cache: Record<string, MBArtistData> | null = null;

function loadCache(): Record<string, MBArtistData> {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch {
    _cache = {};
  }
  return _cache!;
}

function saveEntry(key: string, data: MBArtistData) {
  const c = loadCache();
  c[key] = data;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function fetchMBArtist(artistName: string): Promise<MBArtistData | null> {
  const cacheKey = artistName.toLowerCase();
  const cached   = loadCache()[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;

  try {
    // 1. Search for artist MBID
    const searchRes  = await mbFetch(
      `${MB_API}/artist/?query=artist:${encodeURIComponent(`"${artistName}"`)}&limit=1&fmt=json`
    );
    const searchData = await searchRes.json();
    if (!searchData.artists?.length) return null;
    const mbid: string = searchData.artists[0].id;

    // 2. Fetch detail — tags + artist relationships
    const detailRes  = await mbFetch(`${MB_API}/artist/${mbid}?inc=tags+artist-rels&fmt=json`);
    const detail     = await detailRes.json();

    const tags: string[] = (detail.tags ?? [])
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .map((t: { name: string }) => t.name.toLowerCase());

    const relations: MBRelation[] = (detail.relations ?? [])
      .filter((r: { "target-type": string; artist?: { name: string; id: string } }) =>
        r["target-type"] === "artist" && r.artist)
      .map((r: {
        type: string;
        direction: string;
        artist: { name: string; id: string };
      }) => ({
        type:       r.type,
        direction:  r.direction as "forward" | "backward",
        targetName: r.artist.name,
        targetMbid: r.artist.id,
      }));

    const data: MBArtistData = { mbid, tags, relations, fetchedAt: Date.now() };
    saveEntry(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

// ── Genre zone mapping ─────────────────────────────────────────────────────────
// Keywords are matched against MB tags (lowercase). First matching zone wins
// in priority order, so put more specific zones earlier.

// Zones checked in order — more specific first, broad last.
// Keywords use t.includes(kw), so short keywords match substrings.
// xRange/yRange are PRE-SHIFT values; X_SHIFT 0.04 is applied in ConstellationPOC.
// New layout: rock/folk = LEFT, electronic/ambient = RIGHT, jazz/gothic = CENTER.
export const MB_GENRE_ZONES: Array<{
  keywords: string[];
  xRange:   [number, number];
  yRange:   [number, number];
}> = [
  // Electronic / ambient — RIGHT
  { keywords: ["krautrock", "kosmische", "kraut"],                                    xRange: [0.50, 0.62], yRange: [0.16, 0.36] },
  { keywords: ["ambient", "drone", "minimalism", "modern classical", "contemporary"], xRange: [0.70, 0.90], yRange: [0.54, 0.92] },
  { keywords: ["electronic", "techno", "house", "minimal", "idm", "electronica", "club", "synth"], xRange: [0.64, 0.88], yRange: [0.18, 0.58] },
  // Gothic / dark — bottom center
  { keywords: ["post-punk", "gothic", "dark wave", "industrial", "coldwave"],         xRange: [0.32, 0.54], yRange: [0.70, 0.94] },
  // Rock / psych — LEFT
  { keywords: ["heavy metal", "doom", "stoner", "garage rock"],                       xRange: [0.06, 0.26], yRange: [0.20, 0.52] },
  { keywords: ["psych rock", "psychedelic rock", "acid rock"],                        xRange: [0.08, 0.28], yRange: [0.18, 0.48] },
  { keywords: ["psychedelic", "acid folk"],                                            xRange: [0.08, 0.28], yRange: [0.22, 0.54] },
  { keywords: ["noise rock", "noise pop"],                                             xRange: [0.16, 0.34], yRange: [0.44, 0.66] },
  { keywords: ["noise", "experimental", "avant-garde", "free improvisation"],         xRange: [0.28, 0.52], yRange: [0.46, 0.72] },
  // Blues / Jazz — center-bottom / center
  { keywords: ["delta blues", "electric blues", "chicago blues", "country blues"],    xRange: [0.42, 0.58], yRange: [0.66, 0.92] },
  { keywords: ["blues"],                                                               xRange: [0.44, 0.60], yRange: [0.64, 0.92] },
  { keywords: ["jazz", "bebop", "free jazz", "fusion", "cool jazz", "soul jazz"],     xRange: [0.46, 0.62], yRange: [0.50, 0.72] },
  // Post-rock / shoegaze / slowcore — LEFT
  { keywords: ["post-rock", "shoegaze", "dream pop", "slowcore", "space rock"],       xRange: [0.14, 0.36], yRange: [0.48, 0.74] },
  // Rock — LEFT
  { keywords: ["alternative rock", "indie rock", "lo-fi", "indie pop"],               xRange: [0.12, 0.40], yRange: [0.28, 0.68] },
  { keywords: ["rock", "hard rock", "punk"],                                           xRange: [0.06, 0.38], yRange: [0.24, 0.62] },
  // Country / folk roots — far LEFT
  { keywords: ["country", "bluegrass", "outlaw", "alt-country", "country rock",
               "honky tonk", "western", "appalachian"],                               xRange: [0.04, 0.22], yRange: [0.54, 0.92] },
  // Singer-Songwriter — upper-left, between folk and americana (closer to folk cluster)
  { keywords: ["singer/songwriter", "singer-songwriter", "singer songwriter"],        xRange: [0.16, 0.36], yRange: [0.12, 0.40] },
  // Folk — LEFT, spanning full height (broad catch-all after singer-songwriter)
  { keywords: ["folk", "americana", "acoustic", "neofolk",
               "traditional", "british folk", "indie folk", "world"],                 xRange: [0.04, 0.36], yRange: [0.16, 0.78] },
  // Soul / R&B / hip-hop — center
  { keywords: ["soul", "r&b", "gospel", "funk", "rhythm"],                            xRange: [0.46, 0.62], yRange: [0.60, 0.86] },
  { keywords: ["hip-hop", "hip hop", "rap"],                                           xRange: [0.36, 0.54], yRange: [0.54, 0.76] },
];

export function zoneForTags(tags: string[]): (typeof MB_GENRE_ZONES)[number] | null {
  for (const zone of MB_GENRE_ZONES) {
    if (zone.keywords.some(kw => tags.some(t => t.includes(kw)))) return zone;
  }
  return null;
}

// ── Relationship type → our RelType ───────────────────────────────────────────
// Returns null for relationship types we don't map.

export type ConstellationRelType = "splinter" | "collaboration" | "influence" | "scene" | "label" | "production";

export function mbRelToConstellation(
  rel: MBRelation,
  fetchedArtistName: string,
): { source: string; target: string; type: ConstellationRelType } | null {
  // "influenced by" forward: fetchedArtist was influenced by target
  //   → edge: target → fetchedArtist (target influenced fetchedArtist)
  // "influenced by" backward: target was influenced by fetchedArtist
  //   → edge: fetchedArtist → target
  if (rel.type === "influenced by") {
    return rel.direction === "forward"
      ? { source: rel.targetName, target: fetchedArtistName, type: "influence" }
      : { source: fetchedArtistName, target: rel.targetName, type: "influence" };
  }

  if (rel.type === "member of band" || rel.type === "subgroup") {
    return { source: rel.targetName, target: fetchedArtistName, type: "splinter" };
  }

  if (rel.type === "collaboration" || rel.type === "supporting musician") {
    return { source: fetchedArtistName, target: rel.targetName, type: "collaboration" };
  }

  if (rel.type === "is person") return null;

  return null;
}
