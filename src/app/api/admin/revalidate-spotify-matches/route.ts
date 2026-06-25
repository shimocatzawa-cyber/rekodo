import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { isPlausibleAlbumMatch } from "@/lib/textMatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-off cleanup route — safe to delete once run.
//
// Before this fix, searchAlbum()'s plain-text fallback (and the Collection
// page's identical inline client-side search) accepted Spotify's #1 search
// hit with no check that the artist/album actually matched — e.g. "Itasca -
// Morning Flower / Raindrops on the Balcony" got matched to "Samplestar -
// Raindrops on Balcony". Those wrong matches are permanently cached
// (spotify_matched: true) and won't get re-checked on their own. This walks
// every already-matched row, re-fetches the album Spotify actually matched
// it to, and re-runs the same validation the fixed matcher now uses up
// front — anything that fails gets reset to unmatched so it gets a clean
// re-match (or a correct "no match") next time it's viewed/generated.
//
// PostgREST caps unfiltered reads at 1000 rows — page past it instead of
// silently only checking the first 1000.
const PAGE_SIZE = 1000;
const ALBUM_BATCH = 20; // Spotify's GET /v1/albums?ids= cap

type Row = { id: string; artist: string; album: string; spotify_album_id: string | null };
type SpotifyAlbumsResponse = { albums: Array<{ id: string; name: string; artists: Array<{ name: string }> } | null> };

async function fetchAlbumsByIds(token: string, ids: string[]): Promise<Map<string, { name: string; artists: string[] }>> {
  const out = new Map<string, { name: string; artists: string[] }>();
  for (let i = 0; i < ids.length; i += ALBUM_BATCH) {
    const chunk = ids.slice(i, i + ALBUM_BATCH);
    const res = await fetch(`https://api.spotify.com/v1/albums?ids=${chunk.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue; // transient — leave these rows unchecked rather than treating as mismatches
    const data = await res.json().catch(() => null) as SpotifyAlbumsResponse | null;
    for (const a of data?.albums ?? []) {
      if (a) out.set(a.id, { name: a.name, artists: a.artists.map(x => x.name) });
    }
  }
  return out;
}

async function revalidateTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: "records" | "list_items",
  token: string,
): Promise<{ checked: number; reset: Array<{ id: string; artist: string; album: string; matchedTo: string }> }> {
  const reset: Array<{ id: string; artist: string; album: string; matchedTo: string }> = [];
  let checked = 0;
  let from = 0;

  const selectCols = table === "records"
    ? "id, artist, album, spotify_album_id"
    : "id, song_artist, song_album, spotify_album_id";

  for (;;) {
    let query = db.from(table).select(selectCols).eq("spotify_matched", true).not("spotify_album_id", "is", null);
    if (table === "list_items") query = query.eq("item_type", "song");
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;

    const rows: Row[] = (data as Array<Record<string, unknown>>).map(r => ({
      id: r.id as string,
      artist: (table === "records" ? r.artist : r.song_artist) as string,
      album: (table === "records" ? r.album : r.song_album) as string,
      spotify_album_id: r.spotify_album_id as string | null,
    }));
    checked += rows.length;

    const ids = [...new Set(rows.map(r => r.spotify_album_id).filter((x): x is string => !!x))];
    const albums = await fetchAlbumsByIds(token, ids);

    for (const row of rows) {
      const matched = row.spotify_album_id ? albums.get(row.spotify_album_id) : null;
      if (!matched) continue; // couldn't verify this round — leave it as-is rather than guessing
      if (!isPlausibleAlbumMatch(row.artist, row.album, matched.artists, matched.name)) {
        reset.push({ id: row.id, artist: row.artist, album: row.album, matchedTo: `${matched.artists.join(", ")} – ${matched.name}` });
      }
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (reset.length > 0) {
    const resetIds = reset.map(r => r.id);
    await db.from(table)
      .update({ spotify_matched: false, spotify_album_id: null, spotify_tracks: null, spotify_matched_at: null })
      .in("id", resetIds);
  }

  return { checked, reset };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = await getSpotifyAccessToken(supabase, user.id);
  if (!token) return NextResponse.json({ error: "Admin running this must have a connected Spotify account" }, { status: 400 });

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any;

  const [records, listItems] = await Promise.all([
    revalidateTable(db, "records", token),
    revalidateTable(db, "list_items", token),
  ]);

  return NextResponse.json({
    ok: true,
    recordsChecked: records.checked,
    recordsReset:   records.reset,
    listItemsChecked: listItems.checked,
    listItemsReset:   listItems.reset,
  });
}
