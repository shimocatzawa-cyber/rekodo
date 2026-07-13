import { type NextRequest, NextResponse } from "next/server";

export interface LfmSimilar {
  name:  string;
  match: number; // 0–1
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ similar: [] });

  const key = process.env.LASTFM_API_KEY;
  if (!key) return NextResponse.json({ similar: [] });

  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(artist)}&limit=50&api_key=${key}&format=json&autocorrect=1`;

  try {
    const res = await fetch(url, { next: { revalidate: 604800 } }); // cache 7 days
    if (!res.ok) return NextResponse.json({ similar: [] });

    const json = await res.json() as {
      similarartists?: { artist?: { name: string; match: string }[] };
      error?: number;
    };

    if (json.error || !json.similarartists?.artist) return NextResponse.json({ similar: [] });

    const similar: LfmSimilar[] = json.similarartists.artist
      .map(a => ({ name: a.name, match: parseFloat(a.match) || 0 }))
      .filter(a => a.match > 0.05); // drop near-zero matches

    return NextResponse.json({ similar }, {
      headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ similar: [] });
  }
}
