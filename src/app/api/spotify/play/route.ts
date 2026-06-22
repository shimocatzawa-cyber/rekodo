import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileTokenDb } from "@/lib/spotify";

export const dynamic = "force-dynamic";

type SpotifyProfile = {
  spotify_access_token:  string | null;
  spotify_refresh_token: string | null;
  spotify_token_expiry:  string | null;
  spotify_product:       string | null;
};

// Token columns are column-privilege-revoked from anon/authenticated (see
// migration 20260622000007) — reading/writing them requires the service
// role. Safe here because userId always comes from the caller's own
// verified session, never a client-supplied value.
async function getValidToken(
  userId: string
): Promise<{ token: string | null; status: number }> {
  const tokenDb = getProfileTokenDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (tokenDb as any)
    .from("profiles")
    .select("spotify_access_token, spotify_refresh_token, spotify_token_expiry, spotify_product")
    .eq("id", userId)
    .maybeSingle() as { data: SpotifyProfile | null };

  if (!profile?.spotify_access_token) return { token: null, status: 401 };

  const expiry = profile.spotify_token_expiry
    ? new Date(profile.spotify_token_expiry).getTime()
    : 0;

  // Token still valid
  if (Date.now() + 60_000 < expiry) {
    return { token: profile.spotify_access_token, status: 200 };
  }

  // Refresh
  if (!profile.spotify_refresh_token) return { token: null, status: 401 };

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

  if (!res.ok) return { token: null, status: 401 };

  const data = await res.json() as { access_token: string; expires_in: number; refresh_token?: string };
  const newExpiry = Date.now() + data.expires_in * 1000;

  const patch: Record<string, string> = {
    spotify_access_token: data.access_token,
    spotify_token_expiry: new Date(newExpiry).toISOString(),
  };
  if (data.refresh_token) patch.spotify_refresh_token = data.refresh_token;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (tokenDb as any).from("profiles").update(patch).eq("id", userId);

  return { token: data.access_token, status: 200 };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId, body } = await request.json() as {
    deviceId: string;
    body: Record<string, unknown>;
  };

  if (!deviceId || !body) {
    return NextResponse.json({ error: "Missing deviceId or body" }, { status: 400 });
  }

  const { token, status: tokenStatus } = await getValidToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "No Spotify token", spotifyStatus: tokenStatus }, { status: 401 });
  }

  const headers = {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Step 1: Transfer playback to the Web Playback SDK device.
  // This forces Spotify's backend to register the device before we play.
  try {
    await fetch("https://api.spotify.com/v1/me/player", {
      method:  "PUT",
      headers,
      body:    JSON.stringify({ device_ids: [deviceId], play: false }),
    });
  } catch { /* non-fatal — continue to play attempt */ }

  // Give Spotify's backend a moment to register the device transfer.
  await new Promise(r => setTimeout(r, 500));

  // Step 2: Send the play command, retrying on 404 with back-off.
  for (let attempt = 0; attempt < 5; attempt++) {
    let spotifyRes: Response;
    try {
      spotifyRes = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        { method: "PUT", headers, body: JSON.stringify(body) }
      );
    } catch (err) {
      return NextResponse.json({ error: "Network error", detail: String(err) }, { status: 502 });
    }

    if (spotifyRes.status === 204 || spotifyRes.ok) {
      return NextResponse.json({ ok: true });
    }

    // 404 = device not yet registered; 500 = Spotify backend conflict (e.g.
    // pause/play race when switching artists). Both resolve on retry.
    if ((spotifyRes.status === 404 || spotifyRes.status === 500) && attempt < 4) {
      await new Promise(r => setTimeout(r, 500 + attempt * 500));
      continue;
    }

    let detail = "";
    try { detail = await spotifyRes.text(); } catch { /* ignore */ }

    return NextResponse.json(
      { error: "Spotify error", spotifyStatus: spotifyRes.status, detail },
      { status: spotifyRes.status }
    );
  }

  return NextResponse.json({ error: "Max retries exceeded" }, { status: 502 });
}
