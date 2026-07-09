import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ARTIST_BATCH = 10; // how many artists per Claude call

interface InfluenceEntry {
  name: string;
  note: string;
}
interface ArtistInfluences {
  artist: string;
  influenced_by: InfluenceEntry[];
  influenced: InfluenceEntry[];
}
interface ClaudeOutput {
  artists: ArtistInfluences[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as {
    batchSize?: number;
    offset?: number;
    forceAll?: boolean;
  };
  const batchSize = Math.min(typeof body.batchSize === "number" ? body.batchSize : ARTIST_BATCH, 20);
  const offset    = typeof body.offset === "number" ? body.offset : 0;
  const forceAll  = body.forceAll === true;

  const db = getAdminDb();

  // Get distinct artists from the full records table
  const { data: recordRows, error: recErr } = await db
    .from("records")
    .select("artist")
    .not("artist", "is", null)
    .order("artist")
    .range(offset, offset + batchSize - 1);

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
  if (!recordRows || recordRows.length === 0) {
    return NextResponse.json({ processed: 0, total: 0, done: true });
  }

  // Deduplicate artist names within this page
  const artistNames: string[] = [...new Set(
    (recordRows as { artist: string }[]).map(r => r.artist).filter(Boolean)
  )];

  // Skip artists already in the table unless forceAll
  let toProcess = artistNames;
  if (!forceAll) {
    const { data: existing } = await db
      .from("artist_influences")
      .select("source_artist")
      .in("source_artist", artistNames);
    const done = new Set((existing ?? []).map((e: { source_artist: string }) => e.source_artist.toLowerCase()));
    toProcess = artistNames.filter(n => !done.has(n.toLowerCase()));
  }

  if (toProcess.length === 0) {
    return NextResponse.json({ processed: 0, skipped: artistNames.length, done: false });
  }

  // Claude call — structured tool use for reliable JSON
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools: [
      {
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
                  influenced_by: {
                    type:  "array",
                    items: {
                      type:       "object",
                      properties: {
                        name: { type: "string" },
                        note: { type: "string", description: "One sentence why this influence matters" },
                      },
                      required: ["name", "note"],
                    },
                  },
                  influenced: {
                    type:  "array",
                    items: {
                      type:       "object",
                      properties: {
                        name: { type: "string" },
                        note: { type: "string", description: "One sentence on the influence" },
                      },
                      required: ["name", "note"],
                    },
                  },
                },
                required: ["artist", "influenced_by", "influenced"],
              },
            },
          },
          required: ["artists"],
        },
      },
    ],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `For each artist below, list up to 5 artists who directly influenced them (influenced_by) and up to 5 artists they are documented to have directly influenced (influenced). Only include well-documented, verifiable relationships. If you're uncertain, omit rather than guess.

Artists: ${toProcess.join(", ")}`,
      },
    ],
  });

  // Extract tool result
  const toolBlock = response.content.find(b => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json({ error: "Claude returned no tool call" }, { status: 500 });
  }

  const output = toolBlock.input as ClaudeOutput;
  const rows: {
    source_artist: string;
    target_artist: string;
    type:          string;
    note:          string;
    via:           string;
    confidence:    number;
  }[] = [];

  for (const entry of output.artists ?? []) {
    for (const inf of entry.influenced_by ?? []) {
      rows.push({ source_artist: entry.artist, target_artist: inf.name,  type: "influenced_by", note: inf.note, via: "claude", confidence: 75 });
    }
    for (const inf of entry.influenced ?? []) {
      rows.push({ source_artist: entry.artist, target_artist: inf.name, type: "influenced",    note: inf.note, via: "claude", confidence: 75 });
    }
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await db
      .from("artist_influences")
      .upsert(rows, { onConflict: "source_artist,target_artist,type", ignoreDuplicates: true });
    if (upsertErr) {
      console.error("[build-influences] upsert error", upsertErr);
    }
  }

  return NextResponse.json({
    processed: toProcess.length,
    skipped:   artistNames.length - toProcess.length,
    inserted:  rows.length,
    done:      artistNames.length < batchSize,
    nextOffset: offset + batchSize,
  });
}
