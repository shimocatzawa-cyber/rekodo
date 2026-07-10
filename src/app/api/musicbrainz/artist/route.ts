import { type NextRequest } from "next/server";

const MB_API = "https://musicbrainz.org/ws/2";
const UA     = "rekodo/1.0 (shimocatzawa@gmail.com)";
const SCORE_THRESHOLD = 70;

export interface MBArtistRelation {
  type:       string;
  direction:  "forward" | "backward";
  targetName: string;
  targetMbid: string;
}

export interface MBArtistPayload {
  mbid:      string;
  name:      string;
  tags:      string[];
  relations: MBArtistRelation[];
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name || name.trim().length === 0) {
    return Response.json({ error: "Missing name" }, { status: 400 });
  }

  const headers = { "User-Agent": UA };

  try {
    // 1. Search for MBID
    const searchRes = await fetch(
      `${MB_API}/artist/?query=artist:${encodeURIComponent(`"${name}"`)}&limit=3&fmt=json`,
      { headers },
    );
    if (!searchRes.ok) return Response.json({ error: `MB search ${searchRes.status}` }, { status: searchRes.status });

    const searchData = await searchRes.json() as { artists?: { id: string; name: string; score: number }[] };
    const top = searchData.artists?.[0];
    console.log(`[mb-proxy] "${name}" → top="${top?.name}" score=${top?.score ?? "n/a"}`);
    if (!top || (top.score ?? 0) < SCORE_THRESHOLD) {
      console.log(`[mb-proxy] 404 for "${name}": score=${top?.score ?? "no match"} (threshold ${SCORE_THRESHOLD})`);
      return Response.json({ error: "No match" }, { status: 404 });
    }
    const mbid = top.id;

    // Gap between search and detail calls to respect MB rate limit
    await new Promise(r => setTimeout(r, 300));

    // 2. Fetch tags + artist relations
    const detailRes = await fetch(
      `${MB_API}/artist/${mbid}?inc=tags+artist-rels&fmt=json`,
      { headers },
    );
    if (!detailRes.ok) return Response.json({ error: `MB detail ${detailRes.status}` }, { status: detailRes.status });

    const detail = await detailRes.json() as {
      tags?: { name: string; count: number }[];
      relations?: {
        type: string;
        direction: string;
        "target-type": string;
        artist?: { name: string; id: string };
      }[];
    };

    const tags = (detail.tags ?? [])
      .sort((a, b) => b.count - a.count)
      .map(t => t.name.toLowerCase());

    const relations: MBArtistRelation[] = (detail.relations ?? [])
      .filter(r => r["target-type"] === "artist" && r.artist)
      .map(r => ({
        type:       r.type,
        direction:  r.direction as "forward" | "backward",
        targetName: r.artist!.name,
        targetMbid: r.artist!.id,
      }));

    const payload: MBArtistPayload = { mbid, name: top.name, tags, relations };
    console.log(`[mb-proxy] OK "${name}" → ${relations.length} relations: ${relations.map(r => `${r.type}→${r.targetName}`).join(", ") || "none"}`);

    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return Response.json({ error: "Fetch failed" }, { status: 502 });
  }
}
