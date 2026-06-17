import { type NextRequest, NextResponse } from "next/server";

// Returns Spotify episode URLs for a list of podcast episodes.
// Uses Client Credentials flow — no user token required.
export async function POST(request: NextRequest) {
  const { episodes } = (await request.json()) as {
    episodes: { show: string; episode: string }[];
  };

  if (!Array.isArray(episodes) || episodes.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ urls: {} });
  }

  // Get an app-level access token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!tokenRes.ok) return NextResponse.json({ urls: {} });
    const tokenData = await tokenRes.json() as { access_token: string };
    accessToken = tokenData.access_token;
  } catch {
    return NextResponse.json({ urls: {} });
  }

  // Search for each episode in parallel
  const results = await Promise.all(
    episodes.map(async (ep, i) => {
      try {
        const q = encodeURIComponent(`${ep.show} ${ep.episode}`);
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${q}&type=episode&limit=3&market=US`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return [i, null] as const;
        const data = await res.json() as {
          episodes?: { items?: { name?: string; external_urls?: { spotify?: string } }[] };
        };
        const items = data.episodes?.items ?? [];
        // Prefer an item whose name contains part of the episode title
        const slug = ep.episode.toLowerCase().slice(0, 25);
        const match = items.find((r) => r.name?.toLowerCase().includes(slug));
        const url = (match ?? items[0])?.external_urls?.spotify ?? null;
        return [i, url] as const;
      } catch {
        return [i, null] as const;
      }
    })
  );

  const urls: Record<number, string> = {};
  for (const [i, url] of results) {
    if (url) urls[i] = url;
  }

  return NextResponse.json({ urls });
}
