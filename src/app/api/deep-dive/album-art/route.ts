import { type NextRequest, NextResponse } from "next/server";

type ItunesResult = { artworkUrl100?: string };
type ItunesResponse = { results?: ItunesResult[] };

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  const album  = request.nextUrl.searchParams.get("album");
  if (!artist || !album) return NextResponse.json({ url: null });

  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const res  = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&entity=album&limit=3`,
      { headers: { "User-Agent": "rekodo/1.0 (rekodo.co)" } }
    );
    if (!res.ok) return NextResponse.json({ url: null });

    const data = (await res.json()) as ItunesResponse;
    const raw  = data.results?.[0]?.artworkUrl100 ?? null;
    const url  = raw ? raw.replace("100x100bb", "400x400bb") : null;

    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch {
    return NextResponse.json({ url: null });
  }
}
