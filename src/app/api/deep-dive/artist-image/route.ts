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
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artist)}&type=artist&per_page=5`,
      { headers, signal: AbortSignal.timeout(5000) }
    );

    if (searchRes.ok) {
      const { results = [] } = await searchRes.json() as {
        results?: { id: number; type: string; title?: string; cover_image?: string; thumb?: string }[];
      };

      // Prefer exact name match so "Maybel" doesn't resolve to "Mabel McVey" etc.
      const norm = artist.toLowerCase().trim();
      const hit =
        results.find(r => r.type === "artist" && r.title?.toLowerCase().trim() === norm) ??
        results.find(r => r.type === "artist");

      if (hit) {
        // Use the search result's cover_image/thumb — these are public Discogs CDN
        // URLs that don't require authentication, unlike artist detail images[]
        const url = hit.cover_image ?? hit.thumb ?? null;
        if (url && !isPlaceholder(url)) {
          return NextResponse.json(
            { url },
            { headers: { "Cache-Control": "public, max-age=86400" } }
          );
        }
      }
    }

    // No usable image found — return null rather than falling back to Wikipedia
    // (Wikipedia often returns a photo of a different artist with the same name)
    return NextResponse.json({ url: null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ url: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
