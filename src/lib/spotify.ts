// Server-side Spotify access token helper. Mirrors the refresh logic in
// src/app/api/spotify/token/route.ts so worker routes (which don't have a
// browser to round-trip through that route) can get a valid token directly.

import { createClient as createServiceClient } from "@supabase/supabase-js";

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

// Shared with match-spotify-worker (which owns the lock) and match-spotify
// (which checks it before triggering the worker at all) — one source of truth
// so the two can't drift out of sync.
export const SPOTIFY_MATCH_LOCK_TTL_MS = 70_000;

// ─── Global Spotify search rate limiting ──────────────────────────────────
// /v1/search calls happen from many independent places — one matcher
// invocation per active user, plus the Collection page's own live search
// from the browser. None of them know about each other. A single shared
// table lets every caller agree on one cooldown and one pacing clock instead
// of each only throttling itself, which is what let one bad pass earn the
// whole app a multi-hour Spotify ban instead of a few seconds.
//
// Always accessed via the service role: this needs to coordinate across
// every user, not just the caller's own row, so normal per-user RLS doesn't
// apply here.
function getRateLimitDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const DEFAULT_SEARCH_PACING_MS = 200;

// Call before every Spotify /v1/search (or any endpoint sharing its rate
// limit bucket) request. Returns null if a cooldown is active and the call
// should not be made at all; otherwise the number of ms to sleep first so
// concurrent callers — across every user — stay paced ~stepMs apart in
// aggregate, not just relative to their own previous call.
export async function reserveSpotifySearchSlot(stepMs = DEFAULT_SEARCH_PACING_MS): Promise<number | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getRateLimitDb() as any;

  const { data: state } = await db
    .from("spotify_search_rate_state")
    .select("cooldown_until")
    .eq("id", "singleton")
    .maybeSingle();

  if (state?.cooldown_until && new Date(state.cooldown_until).getTime() > Date.now()) {
    return null;
  }

  const { data: assigned } = await db.rpc("claim_spotify_search_slot", { step_ms: stepMs });
  if (!assigned) return 0;
  return Math.max(0, new Date(assigned).getTime() - Date.now());
}

// Call when a /v1/search request comes back 429. Persists the penalty
// globally so every other caller — any user, any invocation, the Collection
// page's browser-side search — backs off too, instead of each independently
// rediscovering the same ban one at a time.
export async function recordSpotifySearchRateLimit(retryAfterSec: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getRateLimitDb() as any;
  await db.rpc("set_spotify_search_cooldown", { retry_after_sec: retryAfterSec });
}

// Cheap read for callers that can't go through reserveSpotifySearchSlot's
// pacing (e.g. the Collection page just wants to know whether to bother
// searching at all before making its own direct-from-browser call).
export async function getSpotifySearchCooldownUntil(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getRateLimitDb() as any;
  const { data } = await db
    .from("spotify_search_rate_state")
    .select("cooldown_until")
    .eq("id", "singleton")
    .maybeSingle();
  if (!data?.cooldown_until) return null;
  return new Date(data.cooldown_until).getTime() > Date.now() ? data.cooldown_until : null;
}
