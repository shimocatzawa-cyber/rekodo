import { type NextRequest, NextResponse } from "next/server";

const CACHE = { headers: { "Cache-Control": "public, max-age=86400" } };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Bandcamp fallback — uses og:image (always present) then art_id from TralbumData
async function fromBandcamp(itemUrl: string): Promise<string | null> {
  if (!itemUrl.match(/^https?:\/\/[^/]*\.?bandcamp\.com\//)) return null;
  try {
    const res = await fetch(itemUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // og:image is always present and is the most reliable source
    const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i)
                 ?? html.match(/content="([^"]+)"\s+property="og:image"/i);
    if (ogImage?.[1] && ogImage[1].includes("bcbits.com")) {
      // Upgrade to _10.jpg (1200×1200) — og:image is usually _5.jpg (700×700)
      return ogImage[1].replace(/_\d+\.jpg$/, "_10.jpg");
    }

    // Fallback: art_id in TralbumData
    const tralbumIdx = html.indexOf("TralbumData");
    if (tralbumIdx !== -1) {
      const chunk = html.slice(tralbumIdx, tralbumIdx + 1000);
      const artMatch = chunk.match(/"art_id"\s*:\s*(\d+)/);
      if (artMatch) return `https://f4.bcbits.com/img/a${artMatch[1]}_10.jpg`;
    }

    return null;
  } catch {
    return null;
  }
}

// Last.fm album.getInfo — exact artist+album match, most reliable source
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
    // Prefer extralarge → large → medium
    const sizes = ["extralarge", "large", "medium"];
    for (const size of sizes) {
      const img = json.album.image.find(i => i.size === size);
      if (img?.["#text"]) return img["#text"];
    }
    return null;
  } catch {
    return null;
  }
}

// iTunes fallback — fuzzy but covers gaps where Last.fm has no artwork
// Validates that at least the artist name appears in the result to reduce false matches
async function fromItunes(artist: string, album: string): Promise<string | null> {
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const res  = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&entity=album&limit=5`,
      { headers: { "User-Agent": "rekodo/1.0 (rekodo.co)" } }
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

  const url =
    (await fromLastFm(artist, album)) ??
    (await fromItunes(artist, album)) ??
    (bandcampUrl ? await fromBandcamp(bandcampUrl) : null);

  return NextResponse.json({ url }, CACHE);
}
