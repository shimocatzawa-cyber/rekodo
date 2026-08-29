import { type NextRequest, NextResponse } from "next/server";

const HIT_CACHE = { headers: { "Cache-Control": "public, max-age=86400" } };
const NO_STORE  = { headers: { "Cache-Control": "no-store" } };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Last.fm returns this MD5 hash as a placeholder when it has no real artwork.
// Treat any URL containing it as a miss.
const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

// Bandcamp fallback — extracts art_id via data-tralbum JSON, TralbumData inline,
// then og:image URL pattern. Returns the high-res _10.jpg CDN URL.
async function fromBandcamp(itemUrl: string): Promise<string | null> {
  if (!itemUrl.match(/^https?:\/\/[^/]*\.?bandcamp\.com\//)) return null;
  try {
    const res = await fetch(itemUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 1. data-tralbum attribute — parsed JSON, most reliable
    const dataTralbum = html.match(/data-tralbum="([^"]+)"/);
    if (dataTralbum) {
      try {
        const raw = dataTralbum[1]
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
        const parsed = JSON.parse(raw) as { art_id?: number };
        if (parsed.art_id) return `https://f4.bcbits.com/img/a${parsed.art_id}_10.jpg`;
      } catch { /* continue */ }
    }

    // 2. Inline TralbumData — large window to handle varying page layouts
    const tralbumIdx = html.indexOf("TralbumData");
    if (tralbumIdx !== -1) {
      const chunk = html.slice(tralbumIdx, tralbumIdx + 60_000);
      const artMatch = chunk.match(/"art_id"\s*:\s*(\d+)/);
      if (artMatch) return `https://f4.bcbits.com/img/a${artMatch[1]}_10.jpg`;
    }

    // 3. og:image — always present; upgrade to _10.jpg for best resolution
    const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i)
                 ?? html.match(/content="([^"]+)"\s+property="og:image"/i);
    if (ogImage?.[1]?.startsWith("https://")) {
      return ogImage[1].replace(/_\d+\.jpg$/, "_10.jpg");
    }

    return null;
  } catch {
    return null;
  }
}

// Last.fm album.getInfo — exact artist+album match, most reliable source.
// Cached 24h in Next.js data cache so repeated lookups avoid hitting Last.fm.
async function fromLastFm(artist: string, album: string): Promise<string | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&api_key=${key}&format=json&autocorrect=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = await res.json() as {
      album?: { image?: { "#text": string; size: string }[] };
      error?: number;
    };
    if (json.error || !json.album?.image) return null;
    // Prefer extralarge → large → medium; reject the known placeholder hash
    const sizes = ["extralarge", "large", "medium"];
    for (const size of sizes) {
      const img = json.album.image.find(i => i.size === size);
      if (img?.["#text"] && !img["#text"].includes(LASTFM_PLACEHOLDER)) {
        return img["#text"];
      }
    }
    return null;
  } catch {
    return null;
  }
}

// iTunes fallback — fuzzy but covers gaps where Last.fm has no artwork.
// Validates that at least the artist name appears in the result to reduce false matches.
// Cached 24h in Next.js data cache.
async function fromItunes(artist: string, album: string): Promise<string | null> {
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const res  = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&entity=album&limit=5`,
      { headers: { "User-Agent": "rekodo/1.0 (rekodo.co)" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      results?: { artworkUrl100?: string; artistName?: string; collectionName?: string }[]
    };
    const normArtist = artist.toLowerCase();
    const normAlbum  = album.toLowerCase();
    // Prefer a result where both artist and album name match
    const best = (data.results ?? []).find(r =>
      r.artistName?.toLowerCase().includes(normArtist) &&
      r.collectionName?.toLowerCase().includes(normAlbum)
    ) ?? (data.results ?? []).find(r =>
      r.collectionName?.toLowerCase().includes(normAlbum)
    );
    const raw = best?.artworkUrl100 ?? null;
    return raw ? raw.replace("100x100bb", "400x400bb") : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const artist      = request.nextUrl.searchParams.get("artist");
  const album       = request.nextUrl.searchParams.get("album");
  const bandcampUrl = request.nextUrl.searchParams.get("bandcampUrl");
  if (!artist || !album) return NextResponse.json({ url: null });

  // When a bandcampUrl is provided, run Bandcamp in parallel with Last.fm.
  // Bandcamp is authoritative for Bandcamp-sourced albums — many indie artists
  // have no Last.fm/iTunes artwork at all. Then fall back to iTunes if needed.
  if (bandcampUrl) {
    const [lastfm, bandcamp] = await Promise.all([
      fromLastFm(artist, album),
      fromBandcamp(bandcampUrl),
    ]);
    const url = lastfm ?? bandcamp ?? (await fromItunes(artist, album));
    return NextResponse.json({ url }, url ? HIT_CACHE : NO_STORE);
  }

  const url =
    (await fromLastFm(artist, album)) ??
    (await fromItunes(artist, album));

  return NextResponse.json({ url }, url ? HIT_CACHE : NO_STORE);
}
