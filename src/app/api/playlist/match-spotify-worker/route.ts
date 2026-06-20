import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createDirectClient } from "@supabase/supabase-js";
import { getSpotifyAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runtime logs showed this function actually getting killed by Vercel's
// platform timeout well before the previous 250s budget — whatever the real
// enforced ceiling is here, it's much lower than the declared maxDuration.
// Keep each invocation short and let the client (which polls/re-triggers
// every few seconds and has no "frozen after response" failure mode) drive
// continuation instead of relying on long single passes or server self-chains.
const SPOTIFY_DELAY_MS = 200; // small gap between calls to avoid bursting
const TIME_BUDGET_MS = 40_000; // well under maxDuration, even with 429 backoffs
const FETCH_LIMIT = 100; // a chunk comfortably larger than what 40s can process

type SpotifyTrackJson = {
  spotify_uri: string;
  title: string;
  track_number: number;
  duration_ms: number;
  preview_url: string | null;
};

// null id + transient=false  -> Spotify genuinely has no match (terminal failure)
// null id + transient=true   -> request failed/rate-limited — leave unattempted, retry later
type SearchResult = { id: string | null; transient: boolean };

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// Retries once on 429, honoring Retry-After. Anything still not-OK after that
// is treated as a transient failure rather than a confident "no match".
async function spotifyFetch(url: string, token: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status !== 429) return res;
  const retryAfterSec = Number(res.headers.get("Retry-After")) || 1;
  console.warn(`[match-spotify-worker] 429 rate limited — backing off ${retryAfterSec}s`);
  await sleep((retryAfterSec + 0.5) * 1000);
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function searchAlbum(token: string, artist: string, album: string): Promise<SearchResult> {
  const q1 = encodeURIComponent(`album:"${album}" artist:"${artist}"`);
  const r1 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q1}&type=album&limit=1`, token);
  if (!r1.ok) return { id: null, transient: true };
  const d1 = await r1.json().catch(() => null) as { albums?: { items?: Array<{ id: string }> } } | null;
  const id1 = d1?.albums?.items?.[0]?.id ?? null;
  if (id1) return { id: id1, transient: false };

  const q2 = encodeURIComponent(`${artist} ${album}`);
  const r2 = await spotifyFetch(`https://api.spotify.com/v1/search?q=${q2}&type=album&limit=1`, token);
  if (!r2.ok) return { id: null, transient: true };
  const d2 = await r2.json().catch(() => null) as { albums?: { items?: Array<{ id: string }> } } | null;
  return { id: d2?.albums?.items?.[0]?.id ?? null, transient: false };
}

async function fetchAlbumTracks(token: string, albumId: string): Promise<SpotifyTrackJson[]> {
  const tracks: SpotifyTrackJson[] = [];
  let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
  while (url) {
    const res = await spotifyFetch(url, token);
    if (!res.ok) break;
    const data = await res.json() as {
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

  let matched = 0, failed = 0, transientSkipped = 0, processed = 0, calls = 0;
  let timeBudgetExceeded = false;

  function timeLeft() {
    return Date.now() - startedAt < TIME_BUDGET_MS;
  }

  for (const job of recordJobs) {
    if (!timeLeft()) { timeBudgetExceeded = true; break; }
    if (calls++ > 0) await sleep(SPOTIFY_DELAY_MS);
    processed++;
    try {
      const { id: albumId, transient } = await searchAlbum(token, job.artist, job.album);
      if (transient) { transientSkipped++; continue; } // leave spotify_matched_at null — retried later
      if (!albumId) {
        await db.from("records").update({ spotify_matched: false, spotify_matched_at: new Date().toISOString() }).eq("id", job.id);
        failed++; continue;
      }
      const tracks = await fetchAlbumTracks(token, albumId);
      await db.from("records").update({
        spotify_album_id: albumId, spotify_matched: true,
        spotify_tracks: tracks, spotify_matched_at: new Date().toISOString(),
      }).eq("id", job.id);
      matched++;
    } catch (err) {
      console.error(`[match-spotify-worker] error matching record ${job.id}:`, err);
      transientSkipped++; // unexpected error — don't mark permanently unmatched
    }
  }

  if (!timeBudgetExceeded) {
    for (const job of songJobs) {
      if (!timeLeft()) { timeBudgetExceeded = true; break; }
      if (calls++ > 0) await sleep(SPOTIFY_DELAY_MS);
      processed++;
      try {
        const { id: albumId, transient } = await searchAlbum(token, job.song_artist, job.song_album);
        if (transient) { transientSkipped++; continue; }
        if (!albumId) {
          await db.from("list_items").update({ spotify_matched: false, spotify_matched_at: new Date().toISOString() }).eq("id", job.id);
          failed++; continue;
        }
        const tracks = await fetchAlbumTracks(token, albumId);
        await db.from("list_items").update({
          spotify_album_id: albumId, spotify_matched: true,
          spotify_tracks: tracks, spotify_matched_at: new Date().toISOString(),
        }).eq("id", job.id);
        matched++;
      } catch (err) {
        console.error(`[match-spotify-worker] error matching wantlist item ${job.id}:`, err);
        transientSkipped++;
      }
    }
  }

  console.log(`[match-spotify-worker] user ${userId}: processed=${processed} matched=${matched} failed=${failed} transientSkipped=${transientSkipped} timeBudgetExceeded=${timeBudgetExceeded} elapsedMs=${Date.now() - startedAt}`);

  // Only self-trigger if we genuinely ran out of time with more candidates queued —
  // most collections finish in this single pass and never need this.
  if (timeBudgetExceeded) {
    const selfUrl = new URL("/api/playlist/match-spotify-worker", request.url).toString();
    after(async () => {
      try {
        const res = await fetch(selfUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-rekodo-internal": "true",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify({ userId }),
        });
        console.log(`[match-spotify-worker] self-trigger response status=${res.status} for user ${userId}`);
      } catch (err) {
        console.error(`[match-spotify-worker] self-trigger failed for user ${userId}:`, err);
      }
    });
  }

  return NextResponse.json({ processed, matched, failed, transientSkipped, timeBudgetExceeded });
}
