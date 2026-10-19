import { type NextRequest, NextResponse } from "next/server";

const UA = "rekodo/1.0 (shimocatzawa@gmail.com)";

function isPlaceholder(url: string): boolean {
  return url.includes("spacer.gif") || url.includes("image/spacer") || url.length < 30;
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) return NextResponse.json({ url: null });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers: Record<string, string> = { "User-Agent": UA };
  if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

  try {
    // Step 1: search Discogs for exact artist name match
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artist)}&type=artist&per_page=5`,
      { headers, signal: AbortSignal.timeout(5000) }
    );

    if (searchRes.ok) {
      const { results = [] } = await searchRes.json() as {
        results?: { id: number; type: string; title?: string; cover_image?: string; thumb?: string }[];
      };

      const norm = artist.toLowerCase().trim();
      const hit =
        results.find(r => r.type === "artist" && r.title?.toLowerCase().trim() === norm) ??
        results.find(r => r.type === "artist");

      if (hit) {
        // Step 2: fetch full artist record for images array (higher quality + correct artist)
        try {
          const detailRes = await fetch(
            `https://api.discogs.com/artists/${hit.id}`,
            { headers, signal: AbortSignal.timeout(5000) }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json() as {
              images?: { type: string; uri: string; uri150: string }[];
            };
            const img =
              detail.images?.find(i => i.type === "primary")?.uri150 ??
              detail.images?.[0]?.uri150 ??
              null;
            if (img && !isPlaceholder(img)) {
              return NextResponse.json(
                { url: img },
                { headers: { "Cache-Control": "public, max-age=86400" } }
              );
            }
          }
        } catch { /* fall through to search thumb */ }

        // Fall back to search result thumbnail if artist detail has no image
        const thumb = hit.cover_image ?? hit.thumb ?? null;
        if (thumb && !isPlaceholder(thumb)) {
          return NextResponse.json(
            { url: thumb },
            { headers: { "Cache-Control": "public, max-age=86400" } }
          );
        }
      }
    }

    // No image found — return null rather than falling back to Wikipedia
    // (Wikipedia often returns a photo of a different artist with the same name)
    return NextResponse.json({ url: null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ url: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
