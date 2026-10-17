import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SpotifyTrackJson = {
  spotify_uri: string;
  title: string;
  track_number: number;
  duration_ms: number;
  preview_url: string | null;
};

const ID_BATCH = 400;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  if (query.length < 2) return NextResponse.json({ tracks: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Collect all record IDs owned by this user
  const userRecordLinks: Array<{ record_id: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("user_records")
      .select("record_id")
      .eq("user_id", user.id)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    userRecordLinks.push(...data);
    if (data.length < 1000) break;
  }

  const recordIds = userRecordLinks.map((r) => r.record_id);
  if (recordIds.length === 0) return NextResponse.json({ tracks: [] });

  type TrackResult = {
    id: string;
    spotify_uri: string;
    artist: string;
    title: string;
    album: string;
    year: number | null;
    cover_url: string | null;
    duration_ms: number;
  };

  const tracks: TrackResult[] = [];

  for (let i = 0; i < recordIds.length; i += ID_BATCH) {
    const batch = recordIds.slice(i, i + ID_BATCH);
    const { data } = await db
      .from("records")
      .select("id, artist, album, year, cover_url, spotify_tracks")
      .in("id", batch)
      .eq("spotify_matched", true)
      .or(`artist.ilike.%${query}%,album.ilike.%${query}%`)
      .limit(25);

    for (const r of data ?? []) {
      for (const t of (r.spotify_tracks ?? []) as SpotifyTrackJson[]) {
        if (
          t.title.toLowerCase().includes(query) ||
          r.artist.toLowerCase().includes(query) ||
          r.album.toLowerCase().includes(query)
        ) {
          tracks.push({
            id: t.spotify_uri,
            spotify_uri: t.spotify_uri,
            artist: r.artist,
            title: t.title,
            album: r.album,
            year: r.year,
            cover_url: r.cover_url,
            duration_ms: t.duration_ms,
          });
          if (tracks.length >= 40) break;
        }
      }
      if (tracks.length >= 40) break;
    }
    if (tracks.length >= 40) break;
  }

  // Title matches ranked first, then artist
  tracks.sort((a, b) => {
    const aScore =
      (a.title.toLowerCase().includes(query) ? 0 : 2) +
      (a.artist.toLowerCase().includes(query) ? 0 : 1);
    const bScore =
      (b.title.toLowerCase().includes(query) ? 0 : 2) +
      (b.artist.toLowerCase().includes(query) ? 0 : 1);
    return aScore - bScore;
  });

  return NextResponse.json({ tracks: tracks.slice(0, 30) });
}
