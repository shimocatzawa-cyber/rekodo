import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { positionMs, deviceId } = await request.json() as {
    positionMs: number;
    deviceId?: string | null;
  };

  type SpotifyProfile = {
    spotify_access_token: string | null;
    spotify_refresh_token: string | null;
    spotify_token_expiry: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("spotify_access_token, spotify_refresh_token, spotify_token_expiry")
    .eq("id", user.id)
    .maybeSingle() as { data: SpotifyProfile | null };

  if (!profile?.spotify_access_token) {
    return NextResponse.json({ error: "No Spotify token" }, { status: 401 });
  }

  let token = profile.spotify_access_token;
  const expiry = profile.spotify_token_expiry
    ? new Date(profile.spotify_token_expiry).getTime()
    : 0;

  if (Date.now() + 60_000 >= expiry && profile.spotify_refresh_token) {
    const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
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
    if (refreshRes.ok) {
      const data = await refreshRes.json() as { access_token: string; expires_in: number; refresh_token?: string };
      const newExpiry = Date.now() + data.expires_in * 1000;
      const patch: Record<string, string> = {
        spotify_access_token: data.access_token,
        spotify_token_expiry: new Date(newExpiry).toISOString(),
      };
      if (data.refresh_token) patch.spotify_refresh_token = data.refresh_token;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("profiles").update(patch).eq("id", user.id);
      token = data.access_token;
    }
  }

  const params = new URLSearchParams({ position_ms: String(Math.round(positionMs)) });
  if (deviceId) params.set("device_id", deviceId);

  const spotifyRes = await fetch(
    `https://api.spotify.com/v1/me/player/seek?${params.toString()}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
  );

  if (spotifyRes.status === 204 || spotifyRes.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: "Spotify seek failed", status: spotifyRes.status }, { status: spotifyRes.status });
}
