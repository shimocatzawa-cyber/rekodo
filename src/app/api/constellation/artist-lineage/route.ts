import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/app/admin/lib";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface LineageRow {
  query_artist: string;
  source: string;
  target: string;
  note: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSentinel(db: any, artist: string) {
  try {
    await db.from("artist_lineage").upsert(
      { query_artist: artist, source: "__none__", target: "__none__", note: "" },
      { onConflict: "query_artist,source,target", ignoreDuplicates: true },
    );
  } catch { /* ignore */ }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { artist?: string };
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  if (!artist) return NextResponse.json({ rows: [] });

  // Skip compound credits with 3+ parts (e.g. "A, B, C Orchestra, D Choir")
  if (artist.split(",").length > 2) {
    return NextResponse.json({ rows: [] });
  }

  const db = getAdminDb();

  // Return cached rows if we have them
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cached, error: cacheErr } = await (db as any)
    .from("artist_lineage")
    .select("query_artist, source, target, note")
    .eq("query_artist", artist)
    .limit(30);

  if (!cacheErr && cached && cached.length > 0) {
    const real = (cached as LineageRow[]).filter(r => r.source !== "__none__");
    return NextResponse.json({ rows: real });
  }

  // Table might not exist yet
  if (cacheErr && cacheErr.code === "42P01") {
    return NextResponse.json({ rows: [] });
  }

  // Call Claude for lineage data
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    tools: [{
      name: "record_lineage",
      description: "Record band membership and lineage relationships for a musical artist",
      input_schema: {
        type: "object" as const,
        properties: {
          edges: {
            type: "array",
            description: "List of band/member edges. source is always the group/band, target is always the individual member or smaller act.",
            items: {
              type: "object",
              properties: {
                source: { type: "string", description: "The band or group name" },
                target: { type: "string", description: "The member, solo act, or spinoff name" },
                note: { type: "string", description: "Brief description e.g. 'member of band', 'founded', 'side project'" },
              },
              required: ["source", "target", "note"],
            },
          },
        },
        required: ["edges"],
      },
    }],
    tool_choice: { type: "any" },
    messages: [{
      role: "user",
      content: `For the musical artist "${artist}", return all known band membership and lineage relationships:
- Every band or group they were a member of (include brief supergroups and collaborations)
- Every band or solo project that directly spun out from a group "${artist}" was in
- If "${artist}" is a band, include their members

Return as edges where source=band/group, target=member/solo/spinoff.
Only well-documented relationships. If you are not certain, omit it. If no relationships are known, return an empty edges array.`,
    }],
  });

  const tool = response.content.find(b => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    await upsertSentinel(db, artist);
    return NextResponse.json({ rows: [] });
  }

  const input = tool.input as { edges: { source: string; target: string; note: string }[] };
  const edges = input.edges ?? [];

  if (edges.length === 0) {
    await upsertSentinel(db, artist);
    return NextResponse.json({ rows: [] });
  }

  const rows: LineageRow[] = edges.map(e => ({
    query_artist: artist,
    source: e.source,
    target: e.target,
    note: e.note,
  }));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("artist_lineage").upsert(rows, {
      onConflict: "query_artist,source,target",
      ignoreDuplicates: true,
    });
  } catch { /* best-effort — still return the data */ }

  return NextResponse.json({ rows });
}
