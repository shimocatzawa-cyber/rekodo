import { type NextRequest, NextResponse } from "next/server";

const UA = "rekodo/1.0 (rekodo.co)";
const CACHE_SECONDS = 60 * 60 * 24; // 24 hours

function isPlaceholder(url: string): boolean {
  return url.includes("spacer.gif") || url.includes("image/spacer") || url.length < 30;
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type"); // "artist" | "label"
  const id   = request.nextUrl.searchParams.get("id");

  if (!id || (type !== "artist" && type !== "label")) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ url: null });
  }

  const endpoint = type === "artist"
    ? `https://api.discogs.com/artists/${id}`
    : `https://api.discogs.com/labels/${id}`;

  const discogsUrl = new URL(endpoint);
  discogsUrl.searchParams.set("key", key);
  discogsUrl.searchParams.set("secret", secret);

  try {
    const res = await fetch(discogsUrl.toString(), {
      headers: { "User-Agent": UA },
      next: { revalidate: CACHE_SECONDS },
    });

    if (!res.ok) return NextResponse.json({ url: null });

    const data = (await res.json()) as { images?: { uri?: string }[] };
    const uri = data.images?.[0]?.uri ?? null;
    const imageUrl = uri && !isPlaceholder(uri) ? uri : null;

    return NextResponse.json(
      { url: imageUrl },
      { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=604800` } }
    );
  } catch {
    return NextResponse.json({ url: null });
  }
}
