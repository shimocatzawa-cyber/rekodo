// Shared Spotify album-search + tracklist-fetch primitives. Used by both the
// background playlist matcher (match-spotify-worker) and the on-demand
// matcher invoked at playlist-generate time — one implementation so both
// stay compliant with the shared pacing/cooldown circuit breaker instead of
// drifting out of sync with each other.

import { reserveSpotifySearchSlot, recordSpotifySearchRateLimit } from "@/lib/spotify";
import { isPlausibleAlbumMatch } from "@/lib/textMatch";

export const FETCH_TIMEOUT_MS = 6_000; // hard cap per Spotify request — nothing should hang silently
export const MAX_TRACK_PAGES = 2; // 100 tracks covers nearly every release; bounds worst-case time
// If the shared pacing queue is this congested (many concurrent invocations
// across users), don't sit here waiting out someone else's turn — bail and
// let the caller treat this as transient rather than burning its own time
// budget queued behind other callers.
export const MAX_QUEUE_WAIT_MS = 5_000;

export type SpotifyTrackJson = {
  spotify_uri: string;
  title: string;
  track_number: number;
  duration_ms: number;
  preview_url: string | null;
};

// "blocked" = a global rate-limit cooldown is active (just discovered, or
// already in effect) — stop right now, rather than continuing to the next
// job. Hammering Spotify through an active penalty is very likely what turns
// a few-second cooldown into a multi-hour one.
type FetchOutcome =
  | { kind: "ok"; res: Response }
  | { kind: "transient" }
  | { kind: "blocked" };

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function spotifyFetch(url: string, token: string): Promise<FetchOutcome> {
  const waitMs = await reserveSpotifySearchSlot();
  if (waitMs === null) return { kind: "blocked" };
  if (waitMs > MAX_QUEUE_WAIT_MS) return { kind: "transient" };
  if (waitMs > 0) await sleep(waitMs);

  let res: Response;
  try {
    res = await fetchWithTimeout(url, token);
  } catch (err) {
    console.warn(`[spotifyMatch] fetch threw (timeout/network): ${err instanceof Error ? err.message : err}`);
    return { kind: "transient" };
  }
  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("Retry-After")) || 1;
    console.warn(`[spotifyMatch] 429 rate limited, Retry-After=${retryAfterSec}s — stopping and blocking every other caller for ${retryAfterSec}s`);
    await recordSpotifySearchRateLimit(retryAfterSec);
    return { kind: "blocked" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[spotifyMatch] non-ok response status=${res.status} body=${text.slice(0, 200)}`);
  }
  return { kind: "ok", res };
}

export type SearchOutcome =
  | { kind: "found"; id: string }
  | { kind: "not_found" }
  | { kind: "transient" }
  | { kind: "blocked" };

type AlbumSearchResponse = {
  albums?: { items?: Array<{ id: string; name: string; artists: Array<{ name: string }> }> };
};

export async function searchAlbum(token: string, artist: string, album: string): Promise<SearchOutcome> {
  const q1 = encodeURIComponent(`album:"${album}" artist:"${artist}"`);
  const r1 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q1}&type=album&limit=1`, token);
  if (r1.kind !== "ok") return r1;
  const d1 = await r1.res.json().catch(() => null) as AlbumSearchResponse | null;
  const item1 = d1?.albums?.items?.[0] ?? null;
  if (item1 && isPlausibleAlbumMatch(artist, album, item1.artists.map(a => a.name), item1.name)) {
    return { kind: "found", id: item1.id };
  }

  const q2 = encodeURIComponent(`${artist} ${album}`);
  const r2 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q2}&type=album&limit=1`, token);
  if (r2.kind !== "ok") return r2;
  const d2 = await r2.res.json().catch(() => null) as AlbumSearchResponse | null;
  const item2 = d2?.albums?.items?.[0] ?? null;
  if (item2 && isPlausibleAlbumMatch(artist, album, item2.artists.map(a => a.name), item2.name)) {
    return { kind: "found", id: item2.id };
  }
  return { kind: "not_found" };
}

// Returns null (instead of a partial list) on any failure/timeout so the
// caller treats it as transient rather than saving an incomplete tracklist.
// Returns "blocked" the same way searchAlbum does, for the same reason.
export async function fetchAlbumTracks(token: string, albumId: string): Promise<SpotifyTrackJson[] | null | "blocked"> {
  const tracks: SpotifyTrackJson[] = [];
  let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
  let pages = 0;
  while (url && pages < MAX_TRACK_PAGES) {
    pages++;
    const result = await spotifyFetch(url, token);
    if (result.kind === "blocked") return "blocked";
    if (result.kind === "transient" || !result.res.ok) return null;
    const data = await result.res.json() as {
      items: Array<{ uri: string; name: string; track_number: number; duration_ms: number; preview_url: string | null }>;
      next: string | null;
    };
    for (const t of data.items) {
      tracks.push({
        spotify_uri: t.uri,
        title: t.name,
        track_number: t.track_number,
        duration_ms: t.duration_ms,
        preview_url: t.preview_url ?? null,
      });
    }
    url = data.next ?? "";
  }
  return tracks;
}
