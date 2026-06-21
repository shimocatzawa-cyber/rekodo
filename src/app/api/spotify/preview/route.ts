import { NextRequest, NextResponse } from "next/server";
import { reserveSpotifySearchSlot, recordSpotifySearchRateLimit, getSpotifySearchCooldownUntil } from "@/lib/spotify";

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
    const q = encodeURIComponent(`album:${title} artist:${artist}`);
    const searchRes = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`,
      token
    );
    if (!searchRes?.ok) return NextResponse.json(empty);

    const searchData = await searchRes.json() as {
      albums: { items: Array<{ uri: string; id: string }> };
    };
    const album = searchData.albums?.items?.[0];
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
      preview_url: track?.preview_url ?? null,
      track_uri:   track?.uri        ?? null,
      album_uri:   album.uri,
    });
  } catch {
    return NextResponse.json(empty);
  }
}
