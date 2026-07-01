import { NextRequest, NextResponse } from "next/server";
import { reserveSpotifySearchSlot, recordSpotifySearchRateLimit, getSpotifySearchCooldownUntil } from "@/lib/spotify";
import { isPlausibleAlbumMatch } from "@/lib/textMatch";

export const dynamic = "force-dynamic";

// Fires automatically on every Dig card shown — shares the matcher's
// /v1/search rate bucket, so it has to respect and feed the same global
// pacing/cooldown rather than calling Spotify on its own.
async function spotifyFetch(url: string, token: string): Promise<Response | null> {
  const wait = await reserveSpotifySearchSlot();
  if (wait === null) return null; // global cooldown active — don't call at all
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "30", 10);
    await recordSpotifySearchRateLimit(retryAfter);
    return null;
  }
  return res;
}

let _clientToken: { token: string; expiresAt: number } | null = null;
let _clientTokenPromise: Promise<string | null> | null = null;

async function getClientToken(): Promise<string | null> {
  if (_clientToken && Date.now() + 60_000 < _clientToken.expiresAt) {
    return _clientToken.token;
  }
  // Return the in-flight promise to all concurrent callers instead of
  // stampeding Spotify's token endpoint with parallel client-credential fetches.
  if (_clientTokenPromise) return _clientTokenPromise;
  _clientTokenPromise = (async () => {
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { access_token: string; expires_in: number };
      _clientToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
      return data.access_token;
    } catch {
      return null;
    } finally {
      _clientTokenPromise = null;
    }
  })();
  return _clientTokenPromise;
}

const empty = { preview_url: null, track_uri: null, album_uri: null };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist") ?? "";
  const title  = searchParams.get("title")  ?? "";
  if (!artist || !title) return NextResponse.json(empty);

  if (await getSpotifySearchCooldownUntil()) return NextResponse.json(empty);

  const token = await getClientToken();
  if (!token) return NextResponse.json(empty);

  try {
    // Quoted field-filter search first — same Tier 1/Tier 2 pattern as the
    // Collection page and the server-side matcher, so this card's preview
    // doesn't get the loosest possible match just because it's a different
    // call site.
    const q1 = encodeURIComponent(`album:"${title}" artist:"${artist}"`);
    const r1 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q1}&type=album&limit=1`, token);
    if (!r1?.ok) return NextResponse.json(empty); // blocked/rate-limited/transient

    type SpotifyImage = { url: string; width: number; height: number };
    type AlbumSearchResponse = { albums?: { items?: Array<{ uri: string; id: string; name: string; artists: Array<{ name: string }>; images: SpotifyImage[] }> } };
    let album: { uri: string; id: string } | null = null;

    const d1 = await r1.json() as AlbumSearchResponse;
    const item1 = d1.albums?.items?.[0] ?? null;
    let artUrl: string | null = null;
    if (item1 && isPlausibleAlbumMatch(artist, title, item1.artists.map(a => a.name), item1.name)) {
      album = { uri: item1.uri, id: item1.id };
      artUrl = item1.images?.[1]?.url ?? item1.images?.[0]?.url ?? null;
    }

    if (!album) {
      const q2 = encodeURIComponent(`${artist} ${title}`);
      const r2 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q2}&type=album&limit=1`, token);
      if (!r2?.ok) return NextResponse.json(empty);
      const d2 = await r2.json() as AlbumSearchResponse;
      const item2 = d2.albums?.items?.[0] ?? null;
      if (item2 && isPlausibleAlbumMatch(artist, title, item2.artists.map(a => a.name), item2.name)) {
        album = { uri: item2.uri, id: item2.id };
        artUrl = item2.images?.[1]?.url ?? item2.images?.[0]?.url ?? null;
      }
    }

    if (!album) return NextResponse.json(empty);

    const tracksRes = await spotifyFetch(
      `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=10`,
      token
    );
    if (!tracksRes?.ok) return NextResponse.json({ ...empty, album_uri: album.uri });

    const tracksData = await tracksRes.json() as {
      items: Array<{ uri: string; preview_url: string | null }>;
    };
    const items = tracksData.items ?? [];
    // Prefer the first track that has a 30s preview; fall back to first track
    const track = items.find(t => t.preview_url) ?? items[0] ?? null;

    return NextResponse.json({
      preview_url:   track?.preview_url ?? null,
      track_uri:     track?.uri         ?? null,
      album_uri:     album.uri,
      album_art_url: artUrl,
    });
  } catch {
    return NextResponse.json(empty);
  }
}
