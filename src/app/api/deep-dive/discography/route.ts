import { type NextRequest, NextResponse } from "next/server";

export interface DiscographyAlbum {
  id:     number;
  title:  string;
  year:   number;
  thumb:  string | null;
  label:  string | null;
  format: string | null;
  url:    string | null;
}

export interface DiscographyResponse {
  albums:    DiscographyAlbum[];
  artistId:  number | null;
}

const LIVE_PAT         = /\blive\b|\blive at\b|\bconcert\b|\bacoustic session\b/i;
const SINGLE_PAT       = /\bb\/w\b/i;
const REMIX_PAT        = /\bremix(es)?\b|\bdub\b|\bedit\b|\breworked?\b/i;
const FORMAT_EXCL_PAT  = /\b(7"|ep|45\s*rpm|single|dvd|vhs|blu-?ray)\b/i;

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ albums: [], artistId: null });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
  if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

  try {
    // Resolve artist ID
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artist)}&type=artist&per_page=5`,
      { headers, next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) }
    );
    if (!searchRes.ok) return NextResponse.json({ albums: [], artistId: null });

    const { results = [] } = await searchRes.json() as { results?: { id: number; type: string }[] };
    const artistId = results.find(r => r.type === "artist")?.id ?? null;
    if (!artistId) return NextResponse.json({ albums: [], artistId: null });

    // Fetch all releases (masters only, sorted chronologically)
    const relRes = await fetch(
      `https://api.discogs.com/artists/${artistId}/releases?per_page=500&sort=year&sort_order=asc&type=master`,
      { headers, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }
    );
    if (!relRes.ok) return NextResponse.json({ albums: [], artistId });

    const { releases = [] } = await relRes.json() as {
      releases?: {
        id:      number;
        type:    string;
        role:    string;
        title:   string;
        year:    number;
        thumb?:  string;
        label?:  string;
        format?: string;
        resource_url?: string;
      }[];
    };

    const seen = new Set<string>();
    const albums: DiscographyAlbum[] = [];

    for (const r of releases) {
      if (r.role !== "Main" || r.type !== "master") continue;
      if (!r.year || r.year < 1900) continue;
      if (LIVE_PAT.test(r.title) || SINGLE_PAT.test(r.title) || REMIX_PAT.test(r.title)) continue;

      // Exclude formats that are clearly not studio albums (7", EP, Single, etc.).
      // Don't require a positive LP/Album signal — master releases from the
      // Discogs artist endpoint often have format="Vinyl" or no format at all,
      // and the positive check was filtering out valid albums like Townes Van Zandt.
      const fmt = (r.format ?? "").toLowerCase();
      if (fmt && (fmt.includes("live") || FORMAT_EXCL_PAT.test(fmt))) continue;

      const norm = r.title.toLowerCase().trim();
      if (seen.has(norm)) continue;
      seen.add(norm);

      albums.push({
        id:     r.id,
        title:  r.title,
        year:   r.year,
        thumb:  r.thumb ?? null,
        label:  r.label ?? null,
        format: r.format ?? null,
        url:    r.resource_url ? `https://www.discogs.com/master/${r.id}` : null,
      });
    }

    return NextResponse.json({ albums, artistId } satisfies DiscographyResponse, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ albums: [], artistId: null });
  }
}
