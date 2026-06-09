import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PROMPTS: Record<string, (artist: string) => string> = {
  rankings: (artist) =>
    `You are a knowledgeable music critic writing for serious vinyl collectors. Rank ${artist}'s studio albums from best to worst. For each album include a 2–3 sentence critical review (specific, opinionated, no generic praise) and a collector note about pressings or editions worth seeking.
Return ONLY valid JSON, no markdown, no backticks:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"...","collectorNote":"..."}]}`,

  podcasts: (artist) =>
    `You are a music research assistant helping a vinyl collector. List notable podcast episodes that feature or deeply discuss ${artist}. Focus on episodes where the artist is a main subject or guest.
Return ONLY valid JSON, no markdown, no backticks:
{"episodes":[{"show":"Show Name","episode":"Episode title","year":2021,"type":"interview","note":"Why worth listening"}]}`,

  books: (artist) =>
    `You are a music research assistant helping a vinyl collector deepen their knowledge. List books and audiobooks about or significantly featuring ${artist}. Include biographies, memoirs, critical studies, and essential books about their era or scene.
Return ONLY valid JSON, no markdown, no backticks:
{"items":[{"title":"Book Title","author":"Author","year":2003,"type":"biography","format":"book","note":"Why essential"}]}`,

  interviews: (artist) =>
    `You are a music research assistant. List the most significant interviews given by ${artist} — print, video, or audio. Focus on interviews that reveal something meaningful about their creative process, influences, or philosophy.
Return ONLY valid JSON, no markdown, no backticks:
{"interviews":[{"publication":"Publication","title":"Interview title","year":1982,"format":"print","note":"What makes it essential"}]}`,
};

export async function POST(request: NextRequest) {
  try {
    const { artist, section } = (await request.json()) as {
      artist?: string;
      section?: string;
    };

    if (!artist || !section || !PROMPTS[section]) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: PROMPTS[section](artist) }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const clean = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let data: unknown;
    try {
      data = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Parse error", raw: clean },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Deep Dive API error:", error);
    return NextResponse.json({ error: "Claude API error" }, { status: 500 });
  }
}
