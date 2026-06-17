import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

const client = new Anthropic();

const CACHE_TTL_DAYS = 30;

const PROMPTS: Record<string, (artist: string, ownedAlbums?: string[]) => string> = {
  rankings: (artist, ownedAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `\nALBUMS THIS COLLECTOR OWNS — you must include ALL of these in the ranking:\n${ownedAlbums.map(a => `- ${a}`).join("\n")}\n`
      : "";
    return `You are a music critic writing for serious vinyl collectors. Rank ${artist}'s most essential studio albums from best to worst.

CRITICAL ACCURACY RULES:
- Only include albums you are certain exist. If unsure, omit it.
- Do not confuse ${artist} with any other artist.
- Studio albums only — no compilations, live records, or EPs unless universally regarded as a major work.
- Return EXACTLY 6 albums maximum — choose the most essential, even for prolific artists. Do not exceed 6.
- Keep each review to 2 sentences. Keep each collectorNote to 1 sentence.
${ownedBlock}
COLLECTOR NOTE RULES:
- Never name a specific label or pressing plant unless you are absolutely certain. Fabricated label claims are worse than no information.
- Focus on: original vs reissue, country of pressing, decade, or known sonic characteristics.
- If no reliable pressing info is known, note the album's sonic character instead.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2 sentence critical review.","collectorNote":"1 sentence pressing note."}]}`;
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
    `You are a music research assistant helping a vinyl collector. List books and audiobooks by or about ${artist}.

ORDER — strictly follow this:
1. Books or audiobooks WRITTEN OR NARRATED BY ${artist} themselves (memoirs, essays, spoken word) — list these first
2. Books significantly about ${artist} — biographies, critical studies, authorised accounts
3. Essential books about the scene, era, or movement ${artist} defined — only include if genuinely illuminating for a fan

RULES:
- Only include titles you are confident exist. Do not fabricate.
- Return up to 10 items total, sorted by year ascending within each group.
- For the "format" field: use "audiobook" if only available as audio. Use "both" if it exists as both print and audiobook. Use "book" if no audiobook edition is known. This field controls which store links appear — be accurate.
- For the "isbn13" field: include the ISBN-13 if you are confident (13 digits, starts with 978 or 979). Omit if uncertain — a wrong ISBN is worse than none.
- For the "written_by_artist" field: set true if ${artist} is the author or primary narrator. Set false for all other items.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"items":[{"title":"Book Title","author":"Author Name","year":2003,"type":"memoir","format":"both","isbn13":"9780571234567","written_by_artist":true,"note":"One sentence on why essential"}]}
type must be one of: "biography", "memoir", "criticism", "history", "fiction", "reference". Do not fabricate titles.`,

  interviews: (artist) =>
    `You are a music research assistant. List print interviews given by ${artist}.

SCOPE — print and text only:
- Magazine features: Pitchfork, The Wire, The Guardian, NME, MOJO, Rolling Stone, The Face, Uncut, Q, Loud And Quiet, etc.
- Online publications: Bandcamp Daily, Fact Magazine, Resident Advisor, XLR8R, The Quietus, Stereogum, etc.
- Substack newsletters — search for artist interviews published on Substack
- Label or artist website features and press materials
- Any documented print/text interview that reveals something about creative process or influences

DO NOT include: YouTube videos, podcast appearances, radio sessions, or any audio/video content. Print text only.

URL FIELD RULES — read carefully:
- For each interview, include a "url" field with the direct article URL.
- Only include a URL if you are certain it is correct and live. A real URL looks like: https://pitchfork.com/features/interview/... or https://artistname.substack.com/p/post-slug
- If you cannot recall the exact URL, omit the field entirely — do not guess or construct a plausible-looking URL. A missing URL is far better than a wrong one.
- The "domain" field should be just the bare domain (e.g. "pitchfork.com", "thewire.co.uk", "substack.com") — used as a fallback if URL is absent.

Return up to 10 results, sorted by publication date descending (most recent first).
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"interviews":[{"publication":"Pitchfork","domain":"pitchfork.com","title":"Interview title or description","year":2019,"date":"2019-03","url":"https://pitchfork.com/features/interview/...","note":"What makes it worth reading"}]}
"date" is optional — include it as YYYY-MM or YYYY-MM-DD when you know the month or day. "year" is always required.
Only include interviews you are confident exist. Return an empty array if you genuinely cannot identify any — do not fabricate.`,

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

    // ── Cache check for rankings + podcasts + books + interviews ─────────────
    if (section === "rankings" || section === "podcasts" || section === "books" || section === "interviews") {
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
    // Rankings + podcasts + books + interviews use Sonnet; everything else uses Haiku for cost.
    const model = (section === "rankings" || section === "podcasts" || section === "books" || section === "interviews") ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    const maxTokens = section === "blindspot" ? 2048 : 1500;

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

    // ── Cache write for rankings + podcasts + books + interviews ─────────────
    if (section === "rankings" || section === "podcasts" || section === "books" || section === "interviews") {
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
