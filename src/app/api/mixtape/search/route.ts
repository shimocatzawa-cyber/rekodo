import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ID_BATCH = 400;

// Returns albums (not individual tracks) — the client expands to a tracklist
// using spotify_tracks if available, otherwise fetches from Discogs on demand.
// No spotify_matched requirement — searches the full collection.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  if (query.length < 2) return NextResponse.json({ albums: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

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
  if (recordIds.length === 0) return NextResponse.json({ albums: [] });

  type DiscogsTrackJson = { position: string; title: string; duration: string; type_: string };

  type AlbumResult = {
    id: string;
    artist: string;
    album: string;
    year: number | null;
    cover_url: string | null;
    discogs_id: string | null;
    discogs_tracks: DiscogsTrackJson[] | null;
  };

  const albums: AlbumResult[] = [];

  for (let i = 0; i < recordIds.length; i += ID_BATCH) {
    const batch = recordIds.slice(i, i + ID_BATCH);
    const { data } = await db
      .from("records")
      .select("id, artist, album, year, cover_url, discogs_id, discogs_tracks")
      .in("id", batch)
      .or(`artist.ilike.%${query}%,album.ilike.%${query}%`)
      .limit(30);

    for (const r of data ?? []) {
      albums.push({
        id: r.id,
        artist: r.artist,
        album: r.album,
        year: r.year ?? null,
        cover_url: r.cover_url ?? null,
        discogs_id: r.discogs_id ?? null,
        discogs_tracks: r.discogs_tracks ?? null,
      });
      if (albums.length >= 20) break;
    }
    if (albums.length >= 20) break;
  }

  // Artist name matches ranked above album-only matches
  albums.sort((a, b) => {
    const aArtist = a.artist.toLowerCase().includes(query) ? 0 : 1;
    const bArtist = b.artist.toLowerCase().includes(query) ? 0 : 1;
    return aArtist - bArtist;
  });

  return NextResponse.json({ albums: albums.slice(0, 15) });
}
