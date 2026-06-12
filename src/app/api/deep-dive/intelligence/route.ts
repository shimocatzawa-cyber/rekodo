import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PROMPTS: Record<string, (artist: string, ownedAlbums?: string[]) => string> = {
  rankings: (artist, ownedAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `\nCONFIRMED ALBUMS (the collector owns these — they definitely exist, include them):\n${ownedAlbums.map(a => `- ${a}`).join("\n")}\n`
      : "";
    return `You are a music critic writing for serious vinyl collectors. Rank ${artist}'s studio albums from best to worst.

CRITICAL ACCURACY RULES — read before answering:
- Only include albums you are certain exist. If you are not sure a title is correct, omit it.
- Do not confuse ${artist} with any other artist. Double-check every album title and year.
- It is far better to list 3 confirmed albums than 7 where one is fabricated.
- "Studio albums" only — no compilations, live records, EPs, or demos unless they are widely regarded as major works.
${ownedBlock}
For each confirmed album: be specific and opinionated about what makes it succeed or fail, and include a collector note about pressings worth seeking.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2-3 sentence critical review","collectorNote":"Pressing note for collectors"}]}`;
  },

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

  related: (artist) =>
    `You are a music expert guiding a vinyl collector. Based on ${artist}'s style, sound, and era, suggest 8 related artists worth exploring. Cover both the obvious (close contemporaries, same scene) and the less obvious (stylistic connections, cross-genre links).
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"artists":[{"name":"Artist Name","genre":"Style or genre","reason":"Why fans of ${artist} will connect with this artist","mustHear":"The one album to start with"}]}`,

  blindspot: (artist, ownedAlbums = []) => {
    const ownedList = ownedAlbums.length > 0
      ? `The collector already owns: ${ownedAlbums.join(", ")}.`
      : `The collector does not yet own any albums by ${artist}.`;
    return `You are a record collector's guide. A vinyl enthusiast collects ${artist}. ${ownedList} Identify the essential studio albums NOT in their collection that belong in any serious ${artist} library. Be selective — flag only genuine gaps, not completionist picks.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"title":"Album Title","year":1975,"why":"Why this album is essential and what the collector is missing","tip":"Edition or pressing worth seeking"}]}
List at most 8 albums. If no significant gaps exist, return {"albums":[]}.`;
  },
};

export async function POST(request: NextRequest) {
  try {
    const { artist, section, ownedAlbums } = (await request.json()) as {
      artist?: string;
      section?: string;
      ownedAlbums?: string[];
    };

    if (!artist || !section || !PROMPTS[section]) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const model = section === "rankings" ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    const message = await client.messages.create({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: PROMPTS[section](artist, ownedAlbums) }],
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
