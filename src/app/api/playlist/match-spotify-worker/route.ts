import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createDirectClient } from "@supabase/supabase-js";
import { getSpotifyAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SPOTIFY_DELAY_MS = 250; // Spotify's rate limit is generous; small delay avoids bursts
const BATCH_SIZE = 25; // 2 Spotify calls per item (search + tracks) — keep batches modest

type SpotifyTrackJson = {
  spotify_uri: string;
  title: string;
  track_number: number;
  duration_ms: number;
  preview_url: string | null;
};

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function searchAlbum(token: string, artist: string, album: string): Promise<string | null> {
  const q1 = encodeURIComponent(`album:"${album}" artist:"${artist}"`);
  const r1 = await fetch(`https://api.spotify.com/v1/search?q=${q1}&type=album&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d1 = await r1.json().catch(() => null) as { albums?: { items?: Array<{ id: string }> } } | null;
  const id1 = d1?.albums?.items?.[0]?.id ?? null;
  if (id1) return id1;

  const q2 = encodeURIComponent(`${artist} ${album}`);
  const r2 = await fetch(`https://api.spotify.com/v1/search?q=${q2}&type=album&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d2 = await r2.json().catch(() => null) as { albums?: { items?: Array<{ id: string }> } } | null;
  return d2?.albums?.items?.[0]?.id ?? null;
}

async function fetchAlbumTracks(token: string, albumId: string): Promise<SpotifyTrackJson[]> {
  const tracks: SpotifyTrackJson[] = [];
  let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
  if (!token) return NextResponse.json({ error: "No Spotify token" }, { status: 401 });

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
        .limit(BATCH_SIZE)
    : { data: [] };

  const remainingRecordSlots = BATCH_SIZE - (pendingRecords?.length ?? 0);
  const { data: pendingSongItems } = wantlist?.id && remainingRecordSlots > 0
    ? await db.from("list_items")
        .select("id, song_artist, song_album")
        .eq("list_id", wantlist.id).eq("item_type", "song")
        .is("spotify_matched_at", null)
        .limit(remainingRecordSlots)
    : { data: [] };

  const recordJobs = (pendingRecords ?? []) as Array<{ id: string; artist: string; album: string }>;
  const songJobs   = (pendingSongItems ?? []) as Array<{ id: string; song_artist: string; song_album: string }>;

  let matched = 0, failed = 0, calls = 0;

  for (const job of recordJobs) {
    if (calls++ > 0) await sleep(SPOTIFY_DELAY_MS);
    try {
      const albumId = await searchAlbum(token, job.artist, job.album);
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
    } catch {
      await db.from("records").update({ spotify_matched: false, spotify_matched_at: new Date().toISOString() }).eq("id", job.id);
      failed++;
    }
  }

  for (const job of songJobs) {
    if (calls++ > 0) await sleep(SPOTIFY_DELAY_MS);
    try {
      const albumId = await searchAlbum(token, job.song_artist, job.song_album);
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
    } catch {
      await db.from("list_items").update({ spotify_matched: false, spotify_matched_at: new Date().toISOString() }).eq("id", job.id);
      failed++;
    }
  }

  // Self-trigger if this batch was full — more may remain.
  const processedThisBatch = recordJobs.length + songJobs.length;
  if (processedThisBatch >= BATCH_SIZE) {
    const selfUrl = new URL("/api/playlist/match-spotify-worker", request.url).toString();
    // after() keeps this invocation alive until the self-trigger fetch actually
    // completes — without it, an unawaited fetch can get killed mid-flight the
    // moment the response below is sent, silently breaking the batch chain.
    after(() =>
      fetch(selfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rekodo-internal": "true",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ userId }),
      }).catch(() => {})
    );
  }

  return NextResponse.json({ processed: processedThisBatch, matched, failed });
}
