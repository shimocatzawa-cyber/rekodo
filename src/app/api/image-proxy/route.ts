import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "i.discogs.com",
  "img.discogs.com",
  "a.discogs.com",
  "f4.bcbits.com",
  "t4.bcbits.com",
  "i.scdn.co",       // Spotify CDN (album art for discover / top-up matched tracks)
  "mosaic.scdn.co",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; rekodo/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return new NextResponse("Upstream error", { status: resp.status });

    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": resp.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 500 });
  }
}
