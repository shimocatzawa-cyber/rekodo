import { type NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!key || !secret) {
    return Response.json({ error: "Discogs not configured" }, { status: 500 });
  }

  const url = `https://api.discogs.com/releases/${encodeURIComponent(id)}?key=${key}&secret=${secret}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "rekodo/1.0" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return Response.json({ error: "Discogs release not found" }, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}
