import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SpotifyProfile = {
  spotify_access_token:  string | null;
  spotify_refresh_token: string | null;
  spotify_token_expiry:  string | null;
};

async function getValidToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
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
  await (supabase as any).from("profiles").update(patch).eq("id", userId);

  return data.access_token;
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) return NextResponse.json({ error: "Missing artist" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(supabase, user.id);
  if (!token) return NextResponse.json({ error: "No Spotify token" }, { status: 401 });

  const headers = { Authorization: `Bearer ${token}` };

  // Search for artist
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=artist&limit=1`,
    { headers }
  );
  if (!searchRes.ok) {
    return NextResponse.json({ error: "Spotify search failed" }, { status: 502 });
  }
  const searchData = await searchRes.json() as {
    artists: { items: Array<{ id: string; name: string }> };
  };
  const artistItem = searchData.artists?.items?.[0];
  if (!artistItem) return NextResponse.json({ tracks: [] });

  // Get top tracks (market=from_token uses the user's account country,
  // which is the correct default and avoids a 400 on older API versions)
  const topRes = await fetch(
    `https://api.spotify.com/v1/artists/${artistItem.id}/top-tracks?market=from_token`,
    { headers }
  );
  if (!topRes.ok) {
    return NextResponse.json({ error: "Spotify top tracks failed" }, { status: 502 });
  }
  const topData = await topRes.json() as {
    tracks: Array<{ uri: string; name: string; album: { name: string }; preview_url: string | null }>;
  };

  const tracks = (topData.tracks ?? []).map(t => ({
    uri:         t.uri,
    name:        t.name,
    album:       t.album?.name ?? "",
    preview_url: t.preview_url,
  }));

  return NextResponse.json({ tracks, artistName: artistItem.name });
}
