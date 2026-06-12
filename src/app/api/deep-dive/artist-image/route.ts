import { type NextRequest, NextResponse } from "next/server";

const UA = "rekodo/1.0 (rekodo.co)";

type DiscogsSearchResult = {
  results?: { cover_image?: string; thumb?: string; title?: string }[];
};

type WPSummary = {
  thumbnail?: { source?: string };
};

// Discogs serves a placeholder grey image for missing artist photos — skip it.
function isPlaceholder(url: string): boolean {
  return url.includes("spacer.gif") || url.includes("image/spacer") || url.length < 30;
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) return NextResponse.json({ url: null });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  try {
    let imageUrl: string | null = null;

    // ── Step 1: Discogs artist search ────────────────────────────────────────
    if (key && secret) {
      try {
        const discogsUrl = new URL("https://api.discogs.com/database/search");
        discogsUrl.searchParams.set("q", artist);
        discogsUrl.searchParams.set("type", "artist");
        discogsUrl.searchParams.set("per_page", "3");
        discogsUrl.searchParams.set("key", key);
        discogsUrl.searchParams.set("secret", secret);

        const res = await fetch(discogsUrl.toString(), {
          headers: { "User-Agent": UA },
        });

        if (res.ok) {
          const data = (await res.json()) as DiscogsSearchResult;
          const result = data.results?.[0];
          const candidate = result?.cover_image ?? result?.thumb ?? null;
          if (candidate && !isPlaceholder(candidate)) {
            imageUrl = candidate;
          }
        }
      } catch { /* non-fatal */ }
    }

    // ── Step 2: Wikipedia fallback ────────────────────────────────────────────
    if (!imageUrl) {
      const wpRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}`,
        { headers: { "User-Agent": UA } }
      );
      if (wpRes.ok) {
        const wpData = (await wpRes.json()) as WPSummary;
        imageUrl = wpData.thumbnail?.source ?? null;
      }
    }

    return NextResponse.json(
      { url: imageUrl },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch {
    return NextResponse.json({ url: null });
  }
}
