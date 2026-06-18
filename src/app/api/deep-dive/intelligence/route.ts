import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const client = new Anthropic();

// Per-section cache TTL in days. "related" uses 365 days (effectively indefinite —
// artist relationships don't change). 0 = no expiry check (cache forever).
const CACHE_TTL_DAYS: Record<string, number> = {
  rankings:   30,
  podcasts:   30,
  books:      30,
  interviews: 30,
  related:    365,
};

// Hard timeout on every Supabase operation — a hanging DB call (slow connection,
// missing table, cold pool) would otherwise consume the entire Vercel budget
// before Claude is ever called.
const DB_TIMEOUT_MS = 3000;

const CACHED_SECTIONS = new Set(["rankings", "podcasts", "books", "interviews", "related"]);

const SONNET_SECTIONS = new Set(["rankings", "podcasts", "books", "interviews"]);

const MAX_TOKENS: Record<string, number> = {
  rankings:   2000,
  podcasts:   2000,
  books:      2000,
  interviews: 2000,
  blindspot:  2048,
  related:    1500,
};

// Race an async callback against a timeout — returns null on timeout instead of hanging.
// Accepts a callback (not a raw Promise) so callers can pass Supabase query builders,
// which are thenable but not full Promises and confuse Promise.race's type inference.
async function withDbTimeout<T>(fn: () => PromiseLike<T>): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), DB_TIMEOUT_MS)
  );
  return Promise.race([Promise.resolve(fn()), timeout]);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function readCache(artist: string, section: string): Promise<unknown | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const ttlDays = CACHE_TTL_DAYS[section] ?? 30;
    const staleAfter = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const result = await withDbTimeout(() =>
      supabase
        .from("deep_dive_cache")
        .select("data")
        .eq("artist", artist)
        .eq("section", section)
        .gt("refreshed_at", staleAfter)
        .maybeSingle()
    );
    if (result === null) {
      console.warn(`[deep-dive] cache read timed out — ${artist}/${section}`);
      return null;
    }
    if (result.error) {
      console.warn(`[deep-dive] cache read error — ${artist}/${section}:`, result.error.message);
      return null;
    }
    return result.data?.data ?? null;
  } catch (e) {
    console.warn(`[deep-dive] cache read threw — ${artist}/${section}:`, e);
    return null;
  }
}

async function writeCache(artist: string, section: string, data: unknown): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    const result = await withDbTimeout(() =>
      supabase
        .from("deep_dive_cache")
        .upsert(
          { artist, section, data, refreshed_at: new Date().toISOString() },
          { onConflict: "artist,section" }
        )
    );
    if (result === null) {
      console.warn(`[deep-dive] cache write timed out — ${artist}/${section}`);
    } else if (result.error) {
      console.warn(`[deep-dive] cache write error — ${artist}/${section}:`, result.error.message);
    }
  } catch (e) {
    console.warn(`[deep-dive] cache write threw — ${artist}/${section}:`, e);
  }
}

const PROMPTS: Record<string, (artist: string, ownedAlbums?: string[]) => string> = {
  rankings: (artist, ownedAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `\nALBUMS THIS COLLECTOR OWNS — include as many of these as possible in the ranking (they are confirmed to exist):\n${ownedAlbums.map(a => `- ${a}`).join("\n")}\n`
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
    `You are a music research assistant. Use web search to find print interviews given by ${artist} and their direct URLs.

SCOPE — print and text only:
- Magazine features: Pitchfork, The Wire, The Guardian, NME, MOJO, Rolling Stone, The Face, Uncut, Q, Loud And Quiet, etc.
- Online publications: Bandcamp Daily, Fact Magazine, Resident Advisor, XLR8R, The Quietus, Stereogum, etc.
- Substack newsletters
- Label or artist website features
DO NOT include: YouTube, podcast appearances, radio, or any audio/video content.

INSTRUCTIONS:
1. Search for "${artist} interview site:pitchfork.com" and similar queries for other publications.
2. For each interview found, include the exact URL from the search result.
3. Only include interviews with a confirmed direct URL — omit any you cannot find a URL for.
4. The "domain" field is the bare domain (e.g. "pitchfork.com") as a fallback display label.

Return up to 10 results, sorted by publication date descending (most recent first).
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"interviews":[{"publication":"Pitchfork","domain":"pitchfork.com","title":"Interview title or description","year":2019,"date":"2019-03","url":"https://pitchfork.com/features/interview/artist-name/","note":"What makes it worth reading"}]}
"date" is optional — YYYY-MM or YYYY-MM-DD when known. "year" is always required.
Do not fabricate URLs. Only include what you find via search.`,

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
  let artist = "";
  let section = "";
  try {
    const body = (await request.json()) as {
      artist?: string;
      section?: string;
      ownedAlbums?: string[];
    };
    artist  = body.artist  ?? "";
    section = body.section ?? "";
    const ownedAlbums = body.ownedAlbums;

    if (!artist || !section || !PROMPTS[section]) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // ── Cache read (3 s hard timeout — hangs must not block Claude) ────────────
    if (CACHED_SECTIONS.has(section)) {
      const cached = await readCache(artist, section);
      if (cached) return NextResponse.json({ data: cached, cached: true });
    }

    // ── Model + token budget ───────────────────────────────────────────────────
    const model     = SONNET_SECTIONS.has(section) ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
    const maxTokens = MAX_TOKENS[section] ?? 1500;

    // Pass up to 5 owned albums for sections that use them; keeps prompt concise.
    const promptAlbums = (section === "rankings" || section === "blindspot") && ownedAlbums?.length
      ? ownedAlbums.slice(0, 5)
      : ownedAlbums;

    console.log(`[deep-dive] calling ${model} — ${artist}/${section} max_tokens=${maxTokens}`);

    // Interviews use Anthropic's built-in web search tool so Claude can look up
    // real article URLs rather than relying on training-data recall.
    // The search runs server-side within the single API call — no loop needed.
    // Interviews use Anthropic's built-in web search tool (server-side, no extra API key).
    // The `as any` casts are needed because the SDK typings may not yet include this tool type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (await (client.messages.create as any)({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: PROMPTS[section](artist, promptAlbums) }],
      ...(section === "interviews" && {
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    })) as Anthropic.Message;

    console.log(`[deep-dive] done — ${artist}/${section} stop_reason=${message.stop_reason} tokens=${message.usage.output_tokens}`);

    const text  = message.content.find((b) => b.type === "text")?.text ?? "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let data: unknown;
    try {
      data = JSON.parse(clean);
    } catch {
      console.error(`[deep-dive] parse error — ${artist}/${section} stop=${message.stop_reason} raw=${clean.slice(0, 400)}`);
      return NextResponse.json({ error: "Parse error" }, { status: 500 });
    }

    // ── Cache write (fire-and-forget, 3 s hard timeout) ────────────────────────
    if (CACHED_SECTIONS.has(section)) {
      void writeCache(artist, section, data);
    }

    // ── Track per-user deep dive (fire-and-forget) ─────────────────────────────
    void (async () => {
      try {
        const authClient = await createAuthClient();
        const { data: { user } } = await authClient.auth.getUser();
        if (!user) return;
        const sb = getSupabase();
        if (!sb) return;
        await withDbTimeout(() =>
          sb.from("deep_dive_sessions").upsert(
            { user_id: user.id, artist, last_viewed_at: new Date().toISOString() },
            { onConflict: "user_id,artist" }
          )
        );
      } catch { /* non-critical */ }
    })();

    return NextResponse.json({ data });
  } catch (error) {
    console.error(`[deep-dive] unhandled error — ${artist}/${section}:`, error);
    return NextResponse.json({ error: "Claude API error" }, { status: 500 });
  }
}
