import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false });

  type SpotifyProfile = {
    spotify_connected:    boolean | null;
    spotify_access_token: string | null;
    spotify_refresh_token: string | null;
    spotify_token_expiry:  string | null;
    spotify_product:       string | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("spotify_connected, spotify_access_token, spotify_refresh_token, spotify_token_expiry, spotify_product")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: SpotifyProfile | null };

  if (!profile?.spotify_connected || !profile.spotify_access_token) {
    return NextResponse.json({ connected: false });
  }

  const expiry = profile.spotify_token_expiry
    ? new Date(profile.spotify_token_expiry).getTime()
    : 0;

  // Token still valid (60s buffer)
  if (Date.now() + 60_000 < expiry) {
    return NextResponse.json({
      connected:    true,
      access_token: profile.spotify_access_token,
      product:      profile.spotify_product,
    });
  }

  // Refresh
  if (!profile.spotify_refresh_token) return NextResponse.json({ connected: false });

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

    if (!res.ok) return NextResponse.json({ connected: false });

    const data = await res.json() as { access_token: string; expires_in: number };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").update({
      spotify_access_token: data.access_token,
      spotify_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("id", user.id);

    return NextResponse.json({
      connected:    true,
      access_token: data.access_token,
      product:      profile.spotify_product,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
