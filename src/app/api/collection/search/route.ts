import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = { id: string; artist: string; album: string; year: unknown; genre: unknown; cover_url: unknown; discogs_id: unknown; label: unknown };

function matchScore(row: Row, ql: string): number {
  const album  = row.album.toLowerCase();
  const artist = row.artist.toLowerCase();
  if (album === ql)              return 0; // exact title
  if (artist === ql)             return 1; // exact artist
  if (album.startsWith(ql))      return 2; // title prefix
  if (artist.startsWith(ql))     return 3; // artist prefix
  if (artist.includes(ql))       return 4; // artist partial
  return 5;                                // album partial (catch-all)
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ results: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ results: [] });

  // Inner-join records→user_records to avoid a large IN clause.
  const { data, error } = await supabase
    .from("records")
    .select("id, discogs_id, artist, album, year, genre, cover_url, label, user_records!inner(user_id)")
    .eq("user_records.user_id", user.id)
    .or(`artist.ilike.%${q}%,album.ilike.%${q}%`)
    .limit(80);

  if (error) return Response.json({ results: [] });

  const ql = q.toLowerCase();
  const rows = (data ?? []) as unknown as Row[];

  rows.sort((a, b) => {
    const scoreDiff = matchScore(a, ql) - matchScore(b, ql);
    if (scoreDiff !== 0) return scoreDiff;
    const artistDiff = a.artist.localeCompare(b.artist, "en", { sensitivity: "base" });
    if (artistDiff !== 0) return artistDiff;
    return a.album.localeCompare(b.album, "en", { sensitivity: "base" });
  });

  const results = rows.slice(0, 60).map(row => ({
    id:        row.id,
    discogs_id: (row.discogs_id as string | null) ?? null,
    artist:    row.artist,
    album:     row.album,
    year:      (row.year as number | null) ?? null,
    genre:     (row.genre as string | null) ?? null,
    cover_url: (row.cover_url as string | null) ?? null,
    label:     (row.label as string | null) ?? null,
    format:    null,
    country:   null,
    value:     null,
  }));

  return Response.json({ results });
}
