import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createDirectClient } from "@supabase/supabase-js";
import {
  getSpotifyAccessToken,
  reserveSpotifySearchSlot,
  recordSpotifySearchRateLimit,
  getSpotifySearchCooldownUntil,
  SPOTIFY_MATCH_LOCK_TTL_MS,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The client (PlaylistTab.tsx) re-triggers this route every ~30s while work
// remains, since server-to-server self-triggering proved unreliable on
// Vercel (silently stalling, then hard-timing-out). That means multiple
// invocations for the same user can otherwise overlap and hammer Spotify
// simultaneously — a TTL lock on profiles.spotify_match_lock_at ensures
// only one invocation actually does work at a time. TTL (not a cleared-on-
// exit lock) so a killed/timed-out invocation can't wedge it open forever.
const LOCK_TTL_MS = SPOTIFY_MATCH_LOCK_TTL_MS;
const FETCH_TIMEOUT_MS = 6_000; // hard cap per Spotify request — nothing should hang silently
const MAX_TRACK_PAGES = 2; // 100 tracks covers nearly every release; bounds worst-case time
const SPOTIFY_PACING_MS = 200; // global, cross-user/cross-invocation pacing — see reserveSpotifySearchSlot
const TIME_BUDGET_MS = 40_000; // well under maxDuration
const FETCH_LIMIT = 100;
// If the shared pacing queue is this congested (many concurrent invocations
// across users), don't sit here waiting out someone else's turn — bail and
// let the next poll pick this job back up instead of burning this
// invocation's whole time budget queued behind other users.
const MAX_QUEUE_WAIT_MS = 5_000;

type SpotifyTrackJson = {
  spotify_uri: string;
  title: string;
  track_number: number;
  duration_ms: number;
  preview_url: string | null;
};

// "blocked" = a global rate-limit cooldown is active (just discovered, or
// already in effect) — stop this invocation entirely, right now, rather than
// continuing to the next job. Hammering Spotify through an active penalty is
// very likely what turns a few-second cooldown into a multi-hour one.
type FetchOutcome =
  | { kind: "ok"; res: Response }
  | { kind: "transient" }
  | { kind: "blocked" };

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function spotifyFetch(url: string, token: string): Promise<FetchOutcome> {
  const waitMs = await reserveSpotifySearchSlot(SPOTIFY_PACING_MS);
  if (waitMs === null) return { kind: "blocked" };
  if (waitMs > MAX_QUEUE_WAIT_MS) return { kind: "transient" };
  if (waitMs > 0) await sleep(waitMs);

  let res: Response;
  try {
    res = await fetchWithTimeout(url, token);
  } catch (err) {
    console.warn(`[match-spotify-worker] fetch threw (timeout/network): ${err instanceof Error ? err.message : err}`);
    return { kind: "transient" };
  }
  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("Retry-After")) || 1;
    console.warn(`[match-spotify-worker] 429 rate limited, Retry-After=${retryAfterSec}s — stopping this pass and blocking every other caller for ${retryAfterSec}s`);
    await recordSpotifySearchRateLimit(retryAfterSec);
    return { kind: "blocked" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[match-spotify-worker] non-ok response status=${res.status} body=${text.slice(0, 200)}`);
  }
  return { kind: "ok", res };
}

type SearchOutcome =
  | { kind: "found"; id: string }
  | { kind: "not_found" }
  | { kind: "transient" }
  | { kind: "blocked" };

async function searchAlbum(token: string, artist: string, album: string): Promise<SearchOutcome> {
  const q1 = encodeURIComponent(`album:"${album}" artist:"${artist}"`);
  const r1 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q1}&type=album&limit=1`, token);
  if (r1.kind !== "ok") return r1;
  const d1 = await r1.res.json().catch(() => null) as { albums?: { items?: Array<{ id: string }> } } | null;
  const id1 = d1?.albums?.items?.[0]?.id ?? null;
  if (id1) return { kind: "found", id: id1 };

  const q2 = encodeURIComponent(`${artist} ${album}`);
  const r2 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q2}&type=album&limit=1`, token);
  if (r2.kind !== "ok") return r2;
  const d2 = await r2.res.json().catch(() => null) as { albums?: { items?: Array<{ id: string }> } } | null;
  const id2 = d2?.albums?.items?.[0]?.id ?? null;
  return id2 ? { kind: "found", id: id2 } : { kind: "not_found" };
}

// Returns null (instead of a partial list) on any failure/timeout so the
// caller treats it as transient rather than saving an incomplete tracklist.
// Returns "blocked" the same way searchAlbum does, for the same reason.
async function fetchAlbumTracks(token: string, albumId: string): Promise<SpotifyTrackJson[] | null | "blocked"> {
  const tracks: SpotifyTrackJson[] = [];
  let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
  let pages = 0;
  while (url && pages < MAX_TRACK_PAGES) {
    pages++;
    const result = await spotifyFetch(url, token);
    if (result.kind === "blocked") return "blocked";
    if (result.kind === "transient" || !result.res.ok) return null;
    const data = await result.res.json() as {
      items: Array<{ uri: string; name: string; track_number: number; duration_ms: number; preview_url: string | null }>;
      next: string | null;
    };
    for (const t of data.items) {
      tracks.push({
        spotify_uri: t.uri,
        title: t.name,
        track_number: t.track_number,
        duration_ms: t.duration_ms,
        preview_url: t.preview_url ?? null,
      });
    }
    url = data.next ?? "";
  }
  return tracks;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  if (request.headers.get("x-rekodo-internal") !== "true") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const authHeader = request.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const supabase = jwt
    ? createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      )
    : await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── Global circuit breaker: skip entirely, before even touching the
  // per-user lock, if Spotify search is in an active rate-limit cooldown —
  // shared across every user, not just this one's previous attempts.
  const cooldownUntil = await getSpotifySearchCooldownUntil();
  if (cooldownUntil) {
    console.log(`[match-spotify-worker] user ${userId}: skipped — global Spotify search cooldown until ${cooldownUntil}`);
    return NextResponse.json({ skipped: true, reason: "global_cooldown", cooldownUntil });
  }

  // ── Lock: skip entirely if another invocation is already working ──────────
  const { data: profileLock } = await db.from("profiles").select("spotify_match_lock_at").eq("id", userId).maybeSingle();
  const lockAt = profileLock?.spotify_match_lock_at ? new Date(profileLock.spotify_match_lock_at).getTime() : 0;
  if (lockAt && Date.now() - lockAt < LOCK_TTL_MS) {
    console.log(`[match-spotify-worker] user ${userId}: skipped — another invocation is already running`);
    return NextResponse.json({ skipped: true, reason: "locked" });
  }
  await db.from("profiles").update({ spotify_match_lock_at: new Date().toISOString() }).eq("id", userId);

  try {
    const token = await getSpotifyAccessToken(db, userId);
    if (!token) {
      console.error(`[match-spotify-worker] no Spotify token for user ${userId}`);
      return NextResponse.json({ error: "No Spotify token" }, { status: 401 });
    }

    // ── Build the unmatched pool: owned records ∪ wantlist record_id items ∪ wantlist song items ──
    const { data: ownedLinks } = await db.from("user_records").select("record_id").eq("user_id", userId);
    const ownedRecordIds: string[] = [...new Set<string>((ownedLinks ?? []).map((r: { record_id: string }) => r.record_id))];

    const { data: wantlist } = await db
      .from("lists").select("id").eq("user_id", userId).eq("slug", "wantlist").maybeSingle();

    let wantlistRecordIds: string[] = [];
    if (wantlist?.id) {
      const { data: recordItems } = await db
        .from("list_items").select("record_id")
        .eq("list_id", wantlist.id).eq("item_type", "record").not("record_id", "is", null);
      wantlistRecordIds = (recordItems ?? []).map((r: { record_id: string }) => r.record_id);
    }

    const allRecordIds = [...new Set([...ownedRecordIds, ...wantlistRecordIds])];

    const { data: pendingRecords } = allRecordIds.length
      ? await db.from("records")
          .select("id, artist, album")
          .in("id", allRecordIds)
          .is("spotify_matched_at", null)
          .limit(FETCH_LIMIT)
      : { data: [] };

    const { data: pendingSongItems } = wantlist?.id
      ? await db.from("list_items")
          .select("id, song_artist, song_album")
          .eq("list_id", wantlist.id).eq("item_type", "song")
          .is("spotify_matched_at", null)
          .limit(FETCH_LIMIT)
      : { data: [] };

    const recordJobs = (pendingRecords ?? []) as Array<{ id: string; artist: string; album: string }>;
    const songJobs   = (pendingSongItems ?? []) as Array<{ id: string; song_artist: string; song_album: string }>;

    console.log(`[match-spotify-worker] user ${userId}: ${recordJobs.length} pending records, ${songJobs.length} pending wantlist songs`);

    let matched = 0, failed = 0, transientSkipped = 0, processed = 0;
    let timeBudgetExceeded = false;
    let blocked = false;

    function timeLeft() {
      return Date.now() - startedAt < TIME_BUDGET_MS;
    }

    for (const job of recordJobs) {
      if (!timeLeft()) { timeBudgetExceeded = true; break; }
      processed++;
      try {
        const result = await searchAlbum(token, job.artist, job.album);
        if (result.kind === "blocked") { blocked = true; break; }
        if (result.kind === "transient") { transientSkipped++; continue; }
        if (result.kind === "not_found") {
          await db.from("records").update({ spotify_matched: false, spotify_matched_at: new Date().toISOString() }).eq("id", job.id);
          failed++; continue;
        }
        const tracks = await fetchAlbumTracks(token, result.id);
        if (tracks === "blocked") { blocked = true; break; }
        if (tracks === null) { transientSkipped++; continue; }
        await db.from("records").update({
          spotify_album_id: result.id, spotify_matched: true,
          spotify_tracks: tracks, spotify_matched_at: new Date().toISOString(),
        }).eq("id", job.id);
        matched++;
      } catch (err) {
        console.error(`[match-spotify-worker] error matching record ${job.id}:`, err);
        transientSkipped++;
      }
    }

    if (!timeBudgetExceeded && !blocked) {
      for (const job of songJobs) {
        if (!timeLeft()) { timeBudgetExceeded = true; break; }
        processed++;
        try {
          const result = await searchAlbum(token, job.song_artist, job.song_album);
          if (result.kind === "blocked") { blocked = true; break; }
          if (result.kind === "transient") { transientSkipped++; continue; }
          if (result.kind === "not_found") {
            await db.from("list_items").update({ spotify_matched: false, spotify_matched_at: new Date().toISOString() }).eq("id", job.id);
            failed++; continue;
          }
          const tracks = await fetchAlbumTracks(token, result.id);
          if (tracks === "blocked") { blocked = true; break; }
          if (tracks === null) { transientSkipped++; continue; }
          await db.from("list_items").update({
            spotify_album_id: result.id, spotify_matched: true,
            spotify_tracks: tracks, spotify_matched_at: new Date().toISOString(),
          }).eq("id", job.id);
          matched++;
        } catch (err) {
          console.error(`[match-spotify-worker] error matching wantlist item ${job.id}:`, err);
          transientSkipped++;
        }
      }
    }

    console.log(`[match-spotify-worker] user ${userId}: processed=${processed} matched=${matched} failed=${failed} transientSkipped=${transientSkipped} timeBudgetExceeded=${timeBudgetExceeded} blocked=${blocked} elapsedMs=${Date.now() - startedAt}`);

    return NextResponse.json({ processed, matched, failed, transientSkipped, timeBudgetExceeded, blocked });
  } finally {
    await db.from("profiles").update({ spotify_match_lock_at: null }).eq("id", userId);
  }
}
