// Server-side Spotify access token helper. Mirrors the refresh logic in
// src/app/api/spotify/token/route.ts so worker routes (which don't have a
// browser to round-trip through that route) can get a valid token directly.

type SpotifyProfile = {
  spotify_access_token:  string | null;
  spotify_refresh_token: string | null;
  spotify_token_expiry:  string | null;
};

// Generic over any Supabase client (cookie-based server client or a direct
// JWT-forwarded client built in a worker route) — both expose .from().
export async function getSpotifyAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("spotify_access_token, spotify_refresh_token, spotify_token_expiry")
    .eq("id", userId)
    .maybeSingle() as { data: SpotifyProfile | null };

  if (!profile?.spotify_access_token) return null;

  const expiry = profile.spotify_token_expiry ? new Date(profile.spotify_token_expiry).getTime() : 0;
  if (Date.now() + 60_000 < expiry) return profile.spotify_access_token;

  if (!profile.spotify_refresh_token) return null;

  try {
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
    const patch: Record<string, string> = {
      spotify_access_token: data.access_token,
      spotify_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
    if (data.refresh_token) patch.spotify_refresh_token = data.refresh_token;

    await supabase.from("profiles").update(patch).eq("id", userId);
    return data.access_token;
  } catch {
    return null;
  }
}
