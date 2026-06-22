import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createDirectClient } from "@supabase/supabase-js";
import {
  getSpotifyAccessToken,
  getSpotifySearchCooldownUntil,
  SPOTIFY_MATCH_LOCK_TTL_MS,
} from "@/lib/spotify";
import { searchAlbum, fetchAlbumTracks } from "@/lib/spotifyMatch";

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
const TIME_BUDGET_MS = 40_000; // well under maxDuration
const FETCH_LIMIT = 100;
// Supabase/PostgREST caps unfiltered reads at 1000 rows, and a `.in()` filter
// with thousands of ids crammed into one request URL can fail outright (URL
// too long) — both silently look like "0 rows" if the error isn't checked.
// Page past the row cap, and batch large id lists into chunks.
const PAGE_SIZE = 1000;
const ID_BATCH = 400;

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

  // The "internal" header above is a static string, not a real secret — it's
  // visible to anyone who opens devtools, so it can't be trusted as the only
  // gate. The legitimate caller (match-spotify/route.ts) always forwards the
  // calling user's own session token AND sets body.userId to that same id —
  // derive the authoritative id from the verified token instead of trusting
  // the body, so a forged request can't target an arbitrary user's id.
  const authHeader = request.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const supabase = jwt
    ? createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      )
    : await createClient();
  const { data: { user: callingUser } } = await supabase.auth.getUser();
  if (!callingUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = callingUser.id;
  if (body.userId && body.userId !== userId) {
    return NextResponse.json({ error: "userId mismatch" }, { status: 403 });
  }

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
    const ownedLinks: Array<{ record_id: string }> = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data } = await db.from("user_records").select("record_id").eq("user_id", userId)
        .range(from, from + PAGE_SIZE - 1);
      if (!data || data.length === 0) break;
      ownedLinks.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    const ownedRecordIds: string[] = [...new Set<string>(ownedLinks.map((r) => r.record_id))];

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

    const pendingRecords: Array<{ id: string; artist: string; album: string }> = [];
    for (let i = 0; i < allRecordIds.length && pendingRecords.length < FETCH_LIMIT; i += ID_BATCH) {
      const { data } = await db.from("records")
        .select("id, artist, album")
        .in("id", allRecordIds.slice(i, i + ID_BATCH))
        .is("spotify_matched_at", null)
        .limit(FETCH_LIMIT - pendingRecords.length);
      if (data) pendingRecords.push(...data);
    }

    const { data: pendingSongItems } = wantlist?.id
      ? await db.from("list_items")
          .select("id, song_artist, song_album")
          .eq("list_id", wantlist.id).eq("item_type", "song")
          .is("spotify_matched_at", null)
          .limit(FETCH_LIMIT)
      : { data: [] };

    const recordJobs = pendingRecords;
    const songJobs    = (pendingSongItems ?? []) as Array<{ id: string; song_artist: string; song_album: string }>;

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
