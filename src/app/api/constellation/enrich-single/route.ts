import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/app/admin/lib";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { artist?: string };
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  if (!artist) return NextResponse.json({ rows: [] });

  const db = getAdminDb();

  // Return cached data immediately if we have it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cached } = await (db as any)
    .from("artist_influences")
    .select("source_artist, target_artist, type, note, via")
    .eq("source_artist", artist)
    .limit(20);

  if (cached && cached.length > 0) return NextResponse.json({ rows: cached });

  // Not in DB yet — call Claude in real time
  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    tools: [{
      name: "record_influences",
      description: "Record well-documented musical influence relationships for a single artist",
      input_schema: {
        type: "object" as const,
        properties: {
          influenced_by: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, note: { type: "string" } }, required: ["name","note"] },
          },
          influenced: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, note: { type: "string" } }, required: ["name","note"] },
          },
        },
        required: ["influenced_by","influenced"],
      },
    }],
    tool_choice: { type: "any" },
    messages: [{
      role: "user",
      content: `For the artist "${artist}", list up to 5 artists who directly influenced them (influenced_by) and up to 5 artists they are documented to have directly influenced (influenced). Only well-documented, verifiable relationships — omit rather than guess.`,
    }],
  });

  const tool = response.content.find(b => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") return NextResponse.json({ rows: [] });

  const input = tool.input as { influenced_by: { name: string; note: string }[]; influenced: { name: string; note: string }[] };
  const rows: { source_artist: string; target_artist: string; type: string; note: string; via: string; confidence: number }[] = [];

  for (const inf of input.influenced_by ?? []) {
    rows.push({ source_artist: artist, target_artist: inf.name, type: "influenced_by", note: inf.note, via: "claude", confidence: 75 });
  }
  for (const inf of input.influenced ?? []) {
    rows.push({ source_artist: artist, target_artist: inf.name, type: "influenced", note: inf.note, via: "claude", confidence: 75 });
  }

  // Store for next time
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from("artist_influences")
      .upsert(row, { onConflict: "source_artist,target_artist,type", ignoreDuplicates: true });
  }

  return NextResponse.json({ rows });
}
