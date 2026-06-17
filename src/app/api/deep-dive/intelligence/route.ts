import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const client = new Anthropic();

const CACHE_TTL_DAYS = 30;

const PROMPTS: Record<string, (artist: string, ownedAlbums?: string[]) => string> = {
  rankings: (artist, ownedAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `\nALBUMS THIS COLLECTOR OWNS — include ALL of these in the ranking (they are confirmed to exist):\n${ownedAlbums.map(a => `- ${a}`).join("\n")}\nAlso include any other essential ${artist} albums you are confident about, up to 8 total.\n`
      : "";
    return `You are a music critic writing for serious vinyl collectors. Rank ${artist}'s most essential studio albums from best to worst.

CRITICAL ACCURACY RULES — read before answering:
- Only include albums you are certain exist. If you are not sure a title is correct, omit it.
- Do not confuse ${artist} with any other artist. Double-check every album title and year.
- "Studio albums" only — no compilations, live records, EPs, or demos unless they are widely regarded as major works.
- Aim for 5–8 albums. Include all confirmed essential records — do not artificially cut the list short.
${ownedBlock}
COLLECTOR NOTE RULES — strictly follow these:
- Never name a specific label, pressing plant, or distributor in collectorNote unless you are absolutely certain it released this exact album. Fabricated label claims are worse than no information.
- Focus on observable, generalisable advice: original pressing vs reissue, country of pressing, decade of manufacture, or known sonic characteristics (e.g. heavy mastering on reissues, original cuts preferred for dynamics).
- If you have no reliable pressing information, write a brief note about the album's sonic character instead. Do not guess at label details.

For each album: be specific and opinionated about what makes it succeed or fail, and include a collector note following the rules above.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2-3 sentence critical review","collectorNote":"Pressing note for collectors"}]}`;
  },

  podcasts: (artist) =>
    `You are a music research assistant. Find specific podcast episodes for a fan of ${artist}.

Priority order:
1. Dedicated podcast series about ${artist} or their albums — include the series itself as a named show with its best or most recent episode
2. Specific episodes where ${artist} is a main guest or interview subject — include the exact episode title
3. Specific episodes that do a deep review of a named ${artist} album — include the exact episode title and album name

RULES:
- Always provide a specific episode title. Never use "Various episodes" or vague placeholders — if you cannot name a specific episode, omit that show entirely.
- Do not fabricate episode titles. If you know the show covers ${artist} but cannot recall a specific episode title, omit it.
- Include the year of the specific episode, not the show's launch year.
- Aim for 8–10 results maximum. Quality over quantity — only include episodes you are confident exist.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"episodes":[{"show":"Show Name","episode":"Exact episode title","year":2021,"type":"interview","note":"One sentence on why worth listening"}]}
type must be one of: "interview", "review", "documentary", "discussion". Return an empty array only if you genuinely cannot identify any. Do not fabricate.`,

  books: (artist) =>
    `You are a music research assistant helping a vinyl collector. List books and audiobooks about or significantly featuring ${artist}. Include biographies, memoirs, critical studies, and essential books about the era or scene they defined.
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"items":[{"title":"Book Title","author":"Author Name","year":2003,"type":"biography","format":"book","note":"One sentence on why essential"}]}
format field must be one of: "book", "audiobook", "both". Do not fabricate titles.`,

  interviews: (artist) =>
    `You are a music research assistant. List interviews given by ${artist} — any format, any outlet. Include major publications, smaller music blogs, YouTube sessions, Bandcamp features, label interviews, radio sessions, or any documented conversation that reveals something about their creative process or influences.

For lesser-known or independent artists, smaller outlets (The Wire, Bandcamp Daily, local press, independent music blogs, YouTube live sessions) are entirely valid — include them.

URL FIELD RULES:
- Include a "url" field with the direct link to the interview if you are confident it is correct.
- For YouTube videos, provide the full youtube.com/watch?v= URL if you know it.
- For articles, provide the direct article URL if you are confident it is accurate.
- If you are not certain of the exact URL, omit the field or return an empty string — do not guess. A missing URL is better than a wrong one.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"interviews":[{"publication":"Publication or platform","title":"Interview title or description","year":1982,"format":"print","url":"https://example.com/article","note":"What makes it worth reading or watching"}]}
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

    // ── Cache check for rankings + podcasts ───────────────────────────────────
    if (section === "rankings" || section === "podcasts") {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const staleAfter = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from("deep_dive_cache")
        .select("data, refreshed_at")
        .eq("artist", artist)
        .eq("section", section)
        .gt("refreshed_at", staleAfter)
        .maybeSingle();

      if (cached) {
        return NextResponse.json({ data: cached.data, cached: true });
      }
    }

    // ── Model selection ────────────────────────────────────────────────────────
    // Rankings + podcasts use Sonnet for accuracy; everything else uses Haiku for cost.
    const model = (section === "rankings" || section === "podcasts") ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    const maxTokens = (section === "rankings" || section === "blindspot") ? 4096 : 1500;

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

    // ── Cache write for rankings + podcasts ───────────────────────────────────
    if (section === "rankings" || section === "podcasts") {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase
        .from("deep_dive_cache")
        .upsert(
          { artist, section, data, refreshed_at: new Date().toISOString() },
          { onConflict: "artist,section" }
        );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Deep Dive API error:", error);
    return NextResponse.json({ error: "Claude API error" }, { status: 500 });
  }
}
