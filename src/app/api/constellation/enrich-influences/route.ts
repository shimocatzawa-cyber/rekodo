import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/app/admin/lib";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface InfluenceEntry { name: string; note: string }
interface ArtistResult   { artist: string; influenced_by: InfluenceEntry[]; influenced: InfluenceEntry[] }

async function claudeBatch(artists: string[]): Promise<ArtistResult[]> {
  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools: [{
      name: "record_influences",
      description: "Record well-documented musical influence relationships for a batch of artists",
      input_schema: {
        type: "object" as const,
        properties: {
          artists: {
            type: "array",
            items: {
              type: "object",
              properties: {
                artist:        { type: "string" },
                influenced_by: { type: "array", items: { type: "object", properties: { name: { type: "string" }, note: { type: "string" } }, required: ["name","note"] } },
                influenced:    { type: "array", items: { type: "object", properties: { name: { type: "string" }, note: { type: "string" } }, required: ["name","note"] } },
              },
              required: ["artist","influenced_by","influenced"],
            },
          },
        },
        required: ["artists"],
      },
    }],
    tool_choice: { type: "any" },
    messages: [{
      role: "user",
      content: `For each artist below, list up to 5 artists who directly influenced them (influenced_by) and up to 5 artists they are documented to have directly influenced (influenced). Only well-documented, verifiable relationships — omit rather than guess.\n\nArtists: ${artists.join(", ")}`,
    }],
  });
  const tool = response.content.find(b => b.type === "tool_use");
  return (tool?.type === "tool_use" ? (tool.input as { artists: ArtistResult[] }).artists : []) ?? [];
}

async function upsertRows(db: ReturnType<typeof getAdminDb>, rows: object[]) {
  for (const row of rows) {
    await db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("artist_influences" as any)
      .upsert(row, { onConflict: "source_artist,target_artist,type", ignoreDuplicates: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { artists?: string[] };
  const artists = Array.isArray(body.artists) ? body.artists.filter(Boolean).slice(0, 300) : [];
  if (artists.length === 0) return NextResponse.json({ processed: 0, skipped: 0 });

  const db = getAdminDb();

  // Find which artists already have data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (db as any)
    .from("artist_influences")
    .select("source_artist")
    .in("source_artist", artists);

  const done       = new Set<string>((existing ?? []).map((r: { source_artist: string }) => r.source_artist.toLowerCase()));
  const toProcess  = artists.filter(a => !done.has(a.toLowerCase()));

  if (toProcess.length === 0) return NextResponse.json({ processed: 0, skipped: artists.length });

  const BATCH = 10;
  let processed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch   = toProcess.slice(i, i + BATCH);
    const results = await claudeBatch(batch).catch(() => []);
    const rows: object[] = [];
    for (const r of results) {
      for (const inf of r.influenced_by ?? []) {
        rows.push({ source_artist: r.artist, target_artist: inf.name, type: "influenced_by", note: inf.note, via: "claude", confidence: 75 });
      }
      for (const inf of r.influenced ?? []) {
        rows.push({ source_artist: r.artist, target_artist: inf.name, type: "influenced", note: inf.note, via: "claude", confidence: 75 });
      }
    }
    await upsertRows(db, rows);
    processed += batch.length;
    if (i + BATCH < toProcess.length) await new Promise(r => setTimeout(r, 800));
  }

  return NextResponse.json({ processed, skipped: artists.length - toProcess.length });
}
