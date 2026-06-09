import { type NextRequest, NextResponse } from "next/server";

const UA = "rekodo/1.0 (rekodo.co)";

type MBRelation = {
  type: string;
  url?: { resource: string };
};

type MBSearchResult = {
  artists?: {
    id?: string;
    relations?: MBRelation[];
  }[];
};

type WPSummary = {
  thumbnail?: { source?: string };
};

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) return NextResponse.json({ url: null });

  try {
    // Step 1: MusicBrainz artist search
    const mbRes = await fetch(
      `https://musicbrainz.org/ws/2/artist?query=artist:"${encodeURIComponent(artist)}"&limit=1&fmt=json`,
      { headers: { "User-Agent": UA } }
    );
    const mbData = (await mbRes.json()) as MBSearchResult;
    const mbArtist = mbData.artists?.[0];

    let imageUrl: string | null = null;

    if (mbArtist?.id) {
      // Step 2: Look up MBID with url-rels to find Wikipedia link
      try {
        const mbLookupRes = await fetch(
          `https://musicbrainz.org/ws/2/artist/${mbArtist.id}?inc=url-rels&fmt=json`,
          { headers: { "User-Agent": UA } }
        );
        if (mbLookupRes.ok) {
          const mbDetail = (await mbLookupRes.json()) as { relations?: MBRelation[] };
          const wikiRelation = mbDetail.relations?.find(
            (r) => r.type === "wikipedia" && r.url?.resource
          );

          if (wikiRelation?.url?.resource) {
            const wikiTitle = wikiRelation.url.resource.split("/wiki/")[1];
            if (wikiTitle) {
              const wpRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
                { headers: { "User-Agent": UA } }
              );
              if (wpRes.ok) {
                const wpData = (await wpRes.json()) as WPSummary;
                imageUrl = wpData.thumbnail?.source ?? null;
              }
            }
          }
        }
      } catch { /* non-fatal */ }
    }

    // Fallback: try Wikipedia directly by artist name
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
