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

// Server-side in-memory cache — survives across requests on the same instance.
// Prevents hammering Discogs when the CDN has no entry (cold-start, v= bust).
const memCache = new Map<string, { data: DiscographyResponse; expiresAt: number }>();
const MEM_TTL  = 4 * 60 * 60 * 1000; // 4 hours

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ albums: [], artistId: null });

  // Serve from in-memory cache if available and fresh
  const mem = memCache.get(artist);
  if (mem && mem.expiresAt > Date.now()) {
    return NextResponse.json(mem.data, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    });
  }

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
  if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

  const NO_STORE = { headers: { "Cache-Control": "no-store" } };

  try {
    // Resolve artist ID — revalidate every 24h so Next.js data cache persists
    // across serverless instances. This is critical on Vercel where each instance
    // has an empty in-memory cache on cold start; without data-cache the route
    // hits Discogs on every cold request and quickly exhausts the 60 req/min limit.
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artist)}&type=artist&per_page=10`,
      { headers, next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) }
    );
    if (!searchRes.ok) {
      // On rate-limit: serve stale in-memory entry rather than returning empty
      const stale = memCache.get(artist);
      if (stale) return NextResponse.json(stale.data, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ albums: [], artistId: null }, NO_STORE);
    }

    const { results = [] } = await searchRes.json() as { results?: { id: number; type: string }[] };
    const artistId = results.find(r => r.type === "artist")?.id ?? null;
    console.log(`[discography] ${artist}: search returned ${results.length} results, artistId=${artistId}`);
    if (!artistId) return NextResponse.json({ albums: [], artistId: null }, NO_STORE);

    // Fetch all releases (masters only, sorted chronologically)
    const relRes = await fetch(
      `https://api.discogs.com/artists/${artistId}/releases?per_page=500&sort=year&sort_order=asc&type=master`,
      { headers, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }
    );
    if (!relRes.ok) {
      const stale = memCache.get(artist);
      if (stale) return NextResponse.json(stale.data, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ albums: [], artistId }, NO_STORE);
    }

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

    console.log(`[discography] ${artist}: releases endpoint returned ${releases.length} items`);

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

    console.log(`[discography] ${artist}: ${albums.length} albums passed filtering`);

    const result: DiscographyResponse = { albums, artistId };
    if (albums.length > 0) {
      memCache.set(artist, { data: result, expiresAt: Date.now() + MEM_TTL });
    }

    return NextResponse.json(result satisfies DiscographyResponse, {
      headers: albums.length > 0
        ? { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" }
        : { "Cache-Control": "no-store" },
    });
  } catch {
    const stale = memCache.get(artist);
    if (stale) return NextResponse.json(stale.data, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ albums: [], artistId: null }, NO_STORE);
  }
}
