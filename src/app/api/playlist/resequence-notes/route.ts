import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type TrackInput = { spotify_uri: string; artist: string; title: string; album: string };

// Cheap rationale-only regeneration after a manual drag-reorder — does not
// re-run candidate selection, just asks for fresh one-liners for the new order.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Cheap per call, but still unbounded — debounced client-side, not server-side.
  const FREE_RESEQUENCE_LIMIT = 100;
  if (!(await isSupporter(supabase, user.id))) {
    const { allowed, used, limit } = await checkDailyLimit(supabase, user.id, "playlist_resequence", FREE_RESEQUENCE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: "daily_limit_reached", used, limit }, { status: 429 });
    }
  }

  const body = await request.json().catch(() => ({})) as { mood?: string; tracks?: TrackInput[] };
  const mood = (body.mood ?? "").toLowerCase().trim();
  const tracks = body.tracks ?? [];
  if (!tracks.length) return NextResponse.json({ error: "tracks required" }, { status: 400 });

  const trackListText = tracks
    .map((t, i) => `${i + 1}. ${t.artist} — ${t.title} (album: ${t.album})`)
    .join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: [{
        type: "text",
        text: `You write one-line DJ-style transition notes for a sequenced tracklist. Given an ordered list of tracks and a mood, return ONE short rationale per track (max 20 words) explaining why it sits at that point in the sequence (the transition in/out, energy shift, opening/building/peak/resolving, etc). Respond with raw JSON only: {"rationales": [string, ...]} with exactly one entry per input track, in the same order — no markdown, no code block.`,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: `Mood: ${mood}\n\nSequence:\n${trackListText}` }],
    });

    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    const raw = block.text.trim().replace(/^```(?:json)?\n?|\n?```$/g, "");
    const parsed = JSON.parse(raw) as { rationales: string[] };

    if (!Array.isArray(parsed.rationales) || parsed.rationales.length !== tracks.length) {
      return NextResponse.json({ error: "Resequencing failed — mismatched response." }, { status: 502 });
    }

    return NextResponse.json({ rationales: parsed.rationales });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resequence." },
      { status: 502 },
    );
  }
}
