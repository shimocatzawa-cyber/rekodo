import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";

// Temporary diagnostic route — makes raw Spotify API calls (search + /v1/me)
// and returns the full, unfiltered response (status, every header, body) for
// each, so we can see ground truth directly instead of inferring from worker
// logs. Safe to delete once the matching stall is root-caused.

async function probe(url: string, token: string) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key] = value; });
    const bodyText = await res.text().catch(() => "<could not read body>");
    return { ok: res.ok, status: res.status, statusText: res.statusText, headers, body: bodyText.slice(0, 500), elapsedMs: Date.now() - startedAt };
  } catch (err) {
    return { ok: false, threw: true, error: err instanceof Error ? err.message : String(err), elapsedMs: Date.now() - startedAt };
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const token = await getSpotifyAccessToken(db, user.id);
  if (!token) {
    console.log("[debug-spotify-test] getSpotifyAccessToken returned null — no valid token/refresh available");
    return NextResponse.json({ error: "No Spotify token available" }, { status: 401 });
  }

  const searchUrl = "https://api.spotify.com/v1/search?q=" + encodeURIComponent('album:"Rumours" artist:"Fleetwood Mac"') + "&type=album&limit=1";
  const [searchResult, meResult] = await Promise.all([
    probe(searchUrl, token),
    probe("https://api.spotify.com/v1/me", token),
  ]);

  const result = {
    tokenPrefix: token.slice(0, 12),
    search: searchResult,
    me: meResult,
  };
  console.log("[debug-spotify-test] result:", JSON.stringify(result));

  return NextResponse.json(result);
}
