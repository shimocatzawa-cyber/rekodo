import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PROMPTS: Record<string, (artist: string) => string> = {
  rankings: (artist) =>
    `You are a music critic writing for serious vinyl collectors. Rank ${artist}'s studio albums from best to worst. Be specific and opinionated — name what makes each album succeed or fail. For each include a collector note about pressings worth seeking.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2-3 sentence critical review","collectorNote":"Pressing note for collectors"}]}`,

  podcasts: (artist) =>
    `You are a music research assistant. List notable podcast episodes that feature or deeply discuss ${artist}. Only include episodes where ${artist} is a main subject or guest — not passing mentions.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"episodes":[{"show":"Show Name","episode":"Episode title or description","year":2021,"type":"interview","note":"One sentence on why worth listening"}]}
If fewer than 3 genuinely exist, return what you know — do not fabricate.`,

  books: (artist) =>
    `You are a music research assistant helping a vinyl collector. List books and audiobooks about or significantly featuring ${artist}. Include biographies, memoirs, critical studies, and essential books about the era or scene they defined.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"items":[{"title":"Book Title","author":"Author Name","year":2003,"type":"biography","format":"book","note":"One sentence on why essential"}]}
format field must be one of: "book", "audiobook", "both". Do not fabricate titles.`,

  interviews: (artist) =>
    `You are a music research assistant. List the most significant interviews given by ${artist} — print, video, or audio. Focus on interviews that reveal something meaningful about their creative process, influences, or philosophy.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"interviews":[{"publication":"Publication or platform","title":"Interview title or description","year":1982,"format":"print","note":"What makes it essential"}]}
format must be one of: "print", "video", "audio". Do not fabricate.`,
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
