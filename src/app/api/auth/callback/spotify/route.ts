import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileTokenDb } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore  = await cookies();
  const storedState  = cookieStore.get("spotify_oauth_state")?.value;
  cookieStore.delete("spotify_oauth_state");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const username   = profile?.username ?? "";
  const profileUrl = username ? `/p/${username}` : "/";
  const failUrl    = username ? `/p/${username}?spotify_error=true` : "/?spotify_error=true";

  if (error || !code || !state || state !== storedState || !user) {
    return NextResponse.redirect(new URL(failUrl, request.url));
  }

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) return NextResponse.redirect(new URL(failUrl, request.url));

    const tokens = await tokenRes.json() as {
      access_token:  string;
      refresh_token: string;
      expires_in:    number;
    };

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!meRes.ok) return NextResponse.redirect(new URL(failUrl, request.url));

    const me = await meRes.json() as { display_name: string; product: string };

    // Token columns are column-privilege-revoked from anon/authenticated
    // (see migration 20260622000007) — writing them requires the service
    // role. Safe here because user.id comes from the caller's own verified
    // session above, never a client-supplied value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getProfileTokenDb() as any).from("profiles").update({
      spotify_access_token:  tokens.access_token,
      spotify_refresh_token: tokens.refresh_token,
      spotify_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      spotify_connected:     true,
      spotify_display_name:  me.display_name,
      spotify_product:       me.product,
    }).eq("id", user.id);

    return NextResponse.redirect(new URL(profileUrl, request.url));
  } catch {
    return NextResponse.redirect(new URL(failUrl, request.url));
  }
}
