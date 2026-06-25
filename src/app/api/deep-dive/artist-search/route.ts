import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) return Response.json({ results: [] }, { status: 500 });

  try {
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=artist&per_page=10&key=${key}&secret=${secret}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "rekodo/1.0 (rekodo.co)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ results: [] });

    const data = await res.json() as {
      results?: Array<{ id: number; title: string; thumb?: string }>;
    };

    const results = (data.results ?? []).slice(0, 8).map((r) => ({
      id:    r.id,
      name:  r.title,
      thumb: r.thumb && !r.thumb.includes("spacer") ? r.thumb : null,
    }));

    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
