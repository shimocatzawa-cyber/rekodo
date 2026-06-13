import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "edge";
export const maxDuration = 60;

const client = new Anthropic();

const PROMPTS: Record<string, (artist: string, ownedAlbums?: string[]) => string> = {
  rankings: (artist, ownedAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `\nCONFIRMED ALBUMS (the collector owns these — they definitely exist, include them):\n${ownedAlbums.map(a => `- ${a}`).join("\n")}\n`
      : "";
    return `You are a music critic writing for serious vinyl collectors. Rank ${artist}'s 5 most essential studio albums from best to worst — not an exhaustive survey, just the records that matter most.

CRITICAL ACCURACY RULES — read before answering:
- Only include albums you are certain exist. If you are not sure a title is correct, omit it.
- Do not confuse ${artist} with any other artist. Double-check every album title and year.
- It is far better to list 5 confirmed albums than 10 where one is fabricated.
- "Studio albums" only — no compilations, live records, EPs, or demos unless they are widely regarded as major works.
- Maximum 5 albums. Pick only the most essential — the records that define the artist's legacy above all others.
${ownedBlock}
For each album: be specific and opinionated about what makes it succeed or fail, and include a collector note about pressings worth seeking.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2-3 sentence critical review","collectorNote":"Pressing note for collectors"}]}`;
  },

  podcasts: (artist) =>
    `You are a music research assistant. Find podcast listening material for a fan of ${artist}.

Priority order — include whichever you can confirm:
1. Episodes where ${artist} is a main guest or subject
2. Episodes that review or significantly discuss a specific ${artist} album
3. Podcasts (any episode) that regularly cover the scene, genre, or era ${artist} belongs to — episodes a fan would genuinely enjoy

Do not fabricate specific episode titles or dates you are not certain of. For genre/scene shows it is fine to recommend the show generally without a specific episode.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"episodes":[{"show":"Show Name","episode":"Episode title, or 'Various episodes' for a recommended show","year":2021,"type":"interview","note":"One sentence on why worth listening"}]}
Return an empty array only if you genuinely cannot identify any relevant podcast. Do not fabricate.`,

  books: (artist) =>
    `You are a music research assistant helping a vinyl collector. List books and audiobooks about or significantly featuring ${artist}. Include biographies, memoirs, critical studies, and essential books about the era or scene they defined.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"items":[{"title":"Book Title","author":"Author Name","year":2003,"type":"biography","format":"book","note":"One sentence on why essential"}]}
format field must be one of: "book", "audiobook", "both". Do not fabricate titles.`,

  interviews: (artist) =>
    `You are a music research assistant. List interviews given by ${artist} — any format, any outlet. Include major publications, smaller music blogs, YouTube sessions, Bandcamp features, label interviews, radio sessions, or any documented conversation that reveals something about their creative process or influences.

For lesser-known or independent artists, smaller outlets (The Wire, Bandcamp Daily, local press, independent music blogs, YouTube live sessions) are entirely valid — include them.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"interviews":[{"publication":"Publication or platform","title":"Interview title or description","year":1982,"format":"print","note":"What makes it worth reading or watching"}]}
format must be one of: "print", "video", "audio". Only include interviews you are confident exist. Return an empty array if you genuinely cannot identify any — do not fabricate.`,

  related: (artist) =>
    `You are a music expert guiding a vinyl collector. Based on ${artist}'s style, sound, and era, suggest 8 related artists worth exploring. Cover both the obvious (close contemporaries, same scene) and the less obvious (stylistic connections, cross-genre links).
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"artists":[{"name":"Artist Name","genre":"Style or genre","reason":"Why fans of ${artist} will connect with this artist","mustHear":"The one album to start with"}]}`,

  blindspot: (artist, ownedAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `ALREADY OWNED — do NOT recommend any of these under any circumstances:\n${ownedAlbums.map(a => `  - ${a}`).join("\n")}`
      : `The collector does not yet own any albums by ${artist}.`;
    return `You are a record collector's guide helping a vinyl enthusiast identify genuine gaps in their ${artist} collection.

${ownedBlock}

CRITICAL RULES:
- NEVER recommend an album that appears in the ALREADY OWNED list above. If you are unsure whether an album matches one already owned, do not recommend it.
- Only recommend albums you are certain ${artist} actually released. Do not fabricate or guess titles.
- Studio albums only — no live albums, compilations, or EPs unless they are genuinely essential to the artist's legacy.
- Be selective: flag only albums a serious collector would consider essential gaps, not completionist picks.
- If the collection already covers the essential catalogue, return {"albums":[]}.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"title":"Album Title","year":1975,"why":"Why this album is essential and what the collector is missing","tip":"Edition or pressing worth seeking"}]}
List at most 6 albums.`;
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

    const model = (section === "rankings" || section === "blindspot") ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    const maxTokens = (section === "rankings" || section === "blindspot") ? 4096 : 1500;
    // For rankings, cap owned albums at 8 — enough to anchor factual accuracy
    // without making the prompt so long it slows the model down.
    const promptAlbums = section === "rankings" && ownedAlbums && ownedAlbums.length > 8
      ? ownedAlbums.slice(0, 8)
      : ownedAlbums;
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: PROMPTS[section](artist, promptAlbums) }],
    });

    if (message.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "Response too long — try a more specific artist" }, { status: 500 });
    }

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
