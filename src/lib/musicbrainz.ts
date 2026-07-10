import type { MBArtistPayload, MBArtistRelation } from "@/app/api/musicbrainz/artist/route";

export type { MBArtistPayload, MBArtistRelation };

// Re-export as MBRelation for backwards compat with ConstellationPOC
export type MBRelation = MBArtistRelation;

export interface MBArtistData {
  mbid:      string;
  name:      string;
  tags:      string[];
  relations: MBRelation[];
  fetchedAt: number;
}

const CACHE_KEY = "rekodo_mb_v4";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_MS   = 1500; // min gap between proxy calls — proxy itself calls MB twice

let _lastCall = 0;
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

export async function fetchMBArtist(artistName: string): Promise<MBArtistData | null> {
  const cacheKey = artistName.toLowerCase();
  const cached   = loadCache()[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;

  const wait = Math.max(0, RATE_MS - (Date.now() - _lastCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCall = Date.now();

  try {
    const res = await fetch(`/api/musicbrainz/artist?name=${encodeURIComponent(artistName)}`);
    if (!res.ok) return null;
    const payload = await res.json() as MBArtistPayload;
    const data: MBArtistData = { ...payload, fetchedAt: Date.now() };
    saveEntry(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

// ── Genre zone mapping ─────────────────────────────────────────────────────────

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
  // Singer-Songwriter — upper-left
  { keywords: ["singer/songwriter", "singer-songwriter", "singer songwriter"],        xRange: [0.16, 0.36], yRange: [0.12, 0.40] },
  // Folk — LEFT
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

export type ConstellationRelType = "splinter" | "collaboration" | "influence" | "scene" | "label" | "production";

export function mbRelToConstellation(
  rel: MBRelation,
  fetchedArtistName: string,
): { source: string; target: string; type: ConstellationRelType } | null {
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

  if (rel.type === "produced by" || rel.type === "producer") {
    return rel.direction === "forward"
      ? { source: rel.targetName, target: fetchedArtistName, type: "production" }
      : { source: fetchedArtistName, target: rel.targetName, type: "production" };
  }

  if (rel.type === "is person") return null;

  return null;
}
