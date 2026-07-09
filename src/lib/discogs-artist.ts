import type { DiscogsArtistPayload } from "@/app/api/discogs/artist/route";

export type { DiscogsArtistPayload };

const CACHE_KEY = "rekodo_discogs_artist_v2";
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days
const RATE_MS   = 1200; // stay under 60 req/min with buffer

let _lastCall = 0;
let _cache: Record<string, DiscogsArtistPayload & { fetchedAt: number }> | null = null;

function loadCache() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch {
    _cache = {};
  }
  return _cache!;
}

function saveEntry(key: string, data: DiscogsArtistPayload & { fetchedAt: number }) {
  const c = loadCache();
  c[key] = data;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

export async function fetchDiscogsArtist(
  discogsId: number,
): Promise<(DiscogsArtistPayload & { fetchedAt: number }) | null> {
  const cacheKey = String(discogsId);
  const cached   = loadCache()[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;

  // Rate limiting
  const wait = Math.max(0, RATE_MS - (Date.now() - _lastCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCall = Date.now();

  try {
    const res = await fetch(`/api/discogs/artist?id=${discogsId}`);
    if (!res.ok) return null;
    const data = await res.json() as DiscogsArtistPayload;
    const entry = { ...data, fetchedAt: Date.now() };
    saveEntry(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}
