import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileTokenDb } from "@/lib/spotify";
import { isPlausibleArtistMatch } from "@/lib/spotifyMatchValidation";

export const dynamic = "force-dynamic";

type SpotifyProfile = {
  spotify_access_token:  string | null;
  spotify_refresh_token: string | null;
  spotify_token_expiry:  string | null;
};

// Token columns are column-privilege-revoked from anon/authenticated (see
// migration 20260622000007) — reading/writing them requires the service
// role. Safe here because userId always comes from the caller's own
// verified session, never a client-supplied value.
async function getValidToken(
  userId: string
): Promise<string | null> {
  const tokenDb = getProfileTokenDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (tokenDb as any)
    .from("profiles")
    .select("spotify_access_token, spotify_refresh_token, spotify_token_expiry")
    .eq("id", userId)
    .maybeSingle() as { data: SpotifyProfile | null };

  if (!profile?.spotify_access_token) return null;

  const expiry = profile.spotify_token_expiry
    ? new Date(profile.spotify_token_expiry).getTime()
    : 0;

  if (Date.now() + 60_000 < expiry) return profile.spotify_access_token;

  if (!profile.spotify_refresh_token) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: profile.spotify_refresh_token,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json() as { access_token: string; expires_in: number; refresh_token?: string };
  const newExpiry = Date.now() + data.expires_in * 1000;

  const patch: Record<string, string> = {
    spotify_access_token: data.access_token,
    spotify_token_expiry: new Date(newExpiry).toISOString(),
  };
  if (data.refresh_token) patch.spotify_refresh_token = data.refresh_token;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (tokenDb as any).from("profiles").update(patch).eq("id", userId);

  return data.access_token;
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) return NextResponse.json({ error: "Missing artist" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(user.id);
  if (!token) return NextResponse.json({ error: "No Spotify token" }, { status: 401 });

  const headers = { Authorization: `Bearer ${token}` };

  // Search for artist using the artist: field filter so Spotify matches on
  // name exactly rather than ranking by personalised popularity (which can
  // return a solo artist like Thom Yorke instead of Radiohead).
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(artist)}&type=artist&limit=1`,
    { headers }
  );
  if (!searchRes.ok) {
    return NextResponse.json({ error: "Spotify search failed" }, { status: 502 });
  }
  const searchData = await searchRes.json() as {
    artists: { items: Array<{ id: string; name: string }> };
  };
  const artistItem = searchData.artists?.items?.[0];
  // The artist: field filter narrows results but doesn't guarantee an exact
  // name match — a typo'd or obscure artist can still come back as a
  // same-ish-named but wrong artist. Reject before fetching/playing their tracks.
  if (!artistItem || !isPlausibleArtistMatch(artist, artistItem.name)) return NextResponse.json({ tracks: [] });

  type RawTrack = { uri: string; name: string; album: { name: string }; preview_url: string | null; artists: Array<{ id: string }> };

  let rawTracks: RawTrack[] = [];

  // Try the native top-tracks endpoint first.
  // Since Nov 2024 Spotify restricts this to extended-quota apps — if we get
  // 403/401 fall back to a track search filtered to this artist.
  const topRes = await fetch(
    `https://api.spotify.com/v1/artists/${artistItem.id}/top-tracks`,
    { headers }
  );

  if (topRes.ok) {
    const topData = await topRes.json() as { tracks: RawTrack[] };
    rawTracks = topData.tracks ?? [];
  } else if (topRes.status === 403 || topRes.status === 401) {
    // Endpoint not available for this app tier — fall back to track search.
    // Results are sorted by Spotify relevance which surfaces popular tracks first.
    const fallbackRes = await fetch(
      `https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(artistItem.name)}&type=track&limit=10`,
      { headers }
    );
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json() as { tracks: { items: RawTrack[] } };
      // Keep only tracks where this artist is a credited artist
      rawTracks = (fallbackData.tracks?.items ?? [])
        .filter(t => t.artists.some(a => a.id === artistItem.id));
    } else {
      return NextResponse.json({ error: `Spotify search fallback failed (${fallbackRes.status})` }, { status: 502 });
    }
  } else {
    let detail = "";
    try { detail = await topRes.text(); } catch { /* ignore */ }
    console.error("[artist-top-tracks] Spotify error", topRes.status, detail);
    return NextResponse.json({ error: `Spotify top tracks failed (${topRes.status})` }, { status: 502 });
  }

  const tracks = rawTracks.map(t => ({
    uri:         t.uri,
    name:        t.name,
    album:       t.album?.name ?? "",
    preview_url: t.preview_url,
  }));

  return NextResponse.json({ tracks, artistName: artistItem.name });
}
