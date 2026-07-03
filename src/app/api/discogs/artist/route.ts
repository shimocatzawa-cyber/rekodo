import { type NextRequest } from "next/server";

const UA = "rekodo/1.0 (shimocatzawa@gmail.com)";

export interface DiscogsArtistMember {
  id:     number;
  name:   string;
  active: boolean;
}

export interface DiscogsArtistGroup {
  id:   number;
  name: string;
}

export interface DiscogsArtistPayload {
  id:             number;
  name:           string;
  namevariations: string[];
  members:        DiscogsArtistMember[];
  groups:         DiscogsArtistGroup[];
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return Response.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  const headers: Record<string, string> = { "User-Agent": UA };
  if (key && secret) {
    headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;
  }

  try {
    const res = await fetch(`https://api.discogs.com/artists/${id}`, { headers });
    if (!res.ok) return Response.json({ error: `Discogs ${res.status}` }, { status: res.status });

    const raw = await res.json();

    const payload: DiscogsArtistPayload = {
      id:             raw.id,
      name:           raw.name,
      namevariations: raw.namevariations ?? [],
      members:        (raw.members ?? []).map((m: { id: number; name: string; active: boolean }) => ({
        id: m.id, name: m.name, active: m.active ?? true,
      })),
      groups:         (raw.groups ?? []).map((g: { id: number; name: string }) => ({
        id: g.id, name: g.name,
      })),
    };

    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return Response.json({ error: "Fetch failed" }, { status: 502 });
  }
}
