import { type NextRequest, NextResponse } from "next/server";
import { reserveSpotifySearchSlot, recordSpotifySearchRateLimit, getSpotifySearchCooldownUntil } from "@/lib/spotify";

// Returns Spotify episode URLs for a list of podcast episodes.
// Uses Client Credentials flow — no user token required.
//
// Two-step lookup (same approach as the Apple Podcasts client-side logic):
//   1. Resolve each unique show name → Spotify show ID
//   2. Fetch up to 100 episodes per show, fuzzy-match the episode title
//   3. Fall back to a search-results URL (never the bare show page) if no
//      confident episode match is found — a search link is honestly labeled;
//      a show-page link looks like the episode and isn't.
//
// This prevents cross-show mismatches (e.g. a "Rick Rubin" search returning
// an Earth Wind & Fire episode instead of the correct Broken Record episode).
//
// Runs on the same /v1/search-bucket as the playlist matcher, and fires on
// every Deep Dive page view (not a user-gated action) — so it shares the
// global pacing slot and reports 429s back to it, same as the matcher does.
// Without this it can independently keep tripping (and re-extending) a
// Spotify ban the matcher's own circuit breaker already backed off from.

type EpItem = { name: string; external_urls: { spotify: string } };

async function spFetch<T>(url: string, token: string): Promise<T | null> {
  const wait = await reserveSpotifySearchSlot();
  if (wait === null) return null; // global cooldown active — don't call at all
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429) {
      const retryAfter = parseInt(r.headers.get("retry-after") ?? "30", 10);
      await recordSpotifySearchRateLimit(retryAfter);
      return null;
    }
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const { episodes } = (await request.json()) as {
    episodes: { show: string; episode: string }[];
  };

  if (!Array.isArray(episodes) || episodes.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  if (await getSpotifySearchCooldownUntil()) {
    return NextResponse.json({ urls: {} });
  }

  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ urls: {} });

  // ── Auth ──────────────────────────────────────────────────────────────────
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
    const td = await tokenRes.json() as { access_token: string };
    accessToken = td.access_token;
  } catch { return NextResponse.json({ urls: {} }); }

  const auth = accessToken;

  // ── Step 1: resolve unique shows → show id ────────────────────────────────
  const uniqueShows = [...new Set(episodes.map((e) => e.show))];
  type ShowMeta = { id: string };
  const showMeta: Record<string, ShowMeta> = {};

  await Promise.all(uniqueShows.map(async (show) => {
    const data = await spFetch<{
      shows?: { items?: { id?: string }[] };
    }>(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(show)}&type=show&limit=1&market=US`,
      auth
    );
    const item = data?.shows?.items?.[0];
    if (item?.id) {
      showMeta[show] = { id: item.id };
    }
  }));

  // ── Step 2: fetch episodes for each resolved show (2 pages = 100 eps) ────
  const showEps: Record<string, EpItem[]> = {};

  await Promise.all(Object.entries(showMeta).map(async ([show, { id }]) => {
    const pages = await Promise.all([0, 50].map((offset) =>
      spFetch<{ items?: EpItem[] }>(
        `https://api.spotify.com/v1/shows/${id}/episodes?limit=50&offset=${offset}&market=US`,
        auth
      )
    ));
    showEps[show] = pages.flatMap((p) => p?.items ?? []);
  }));

  // ── Step 3: fuzzy-match each episode within its own show ─────────────────
  const urls: Record<number, string> = {};

  for (const [i, ep] of episodes.entries()) {
    const candidates = showEps[ep.show] ?? [];
    const target = ep.episode.toLowerCase();

    // Score each candidate: count how many words from the target appear in the name
    let best: EpItem | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      const name = c.name.toLowerCase();
      // Exact substring match (40 chars) wins immediately
      if (name.includes(target.slice(0, 40)) || target.includes(name.slice(0, 40))) {
        best = c;
        break;
      }
      // Word-overlap score as fallback
      const targetWords = target.split(/\W+/).filter((w) => w.length > 3);
      const score = targetWords.filter((w) => name.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = c; }
    }

    // Require at least 2 overlapping words to avoid false positives
    if (best && (target.includes(best.name.toLowerCase().slice(0, 40)) || best.name.toLowerCase().includes(target.slice(0, 40)) || bestScore >= 2)) {
      urls[i] = best.external_urls.spotify;
    } else {
      // No confident episode match — point to a search results page instead of
      // the show's own page. A search link is honestly labeled as "search"; a
      // bare show-page link looks like it should be the episode and isn't.
      urls[i] = `https://open.spotify.com/search/${encodeURIComponent(`${ep.show} ${ep.episode}`)}`;
    }
  }

  return NextResponse.json({ urls });
}
