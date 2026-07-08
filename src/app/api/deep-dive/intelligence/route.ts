import { type NextRequest, NextResponse, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { checkDailyLimit, isSupporter } from "@/lib/rateLimit";

export const maxDuration = 120;

const client = new Anthropic();

// Per-section cache TTL in days. 0 = never expire. "rankings"/"books" are
// long-lived — an artist's essential albums and bibliography rarely change.
// "related" never expires — stylistic neighbors don't change at all.
// "podcasts"/"interviews" stay on a shorter cycle since new episodes and
// features genuinely keep appearing.
const CACHE_TTL_DAYS: Record<string, number> = {
  rankings:   180,
  podcasts:   60,
  books:      180,
  interviews: 60,
  related:    0,
  pressings:  180,
};

// The JSON field holding each section's primary result array.
const RESULT_ARRAY_KEY: Record<string, string> = {
  rankings:   "albums",
  podcasts:   "episodes",
  books:      "items",
  interviews: "interviews",
  related:    "artists",
  pressings:  "pressings",
};

// Don't cache a bad result — a transient parse/verification failure returning
// zero items, a null key, or a missing key would otherwise freeze "No information
// available" for the full TTL with no way for a client-side Retry to recover.
function isEmptyResult(section: string, data: unknown): boolean {
  const key = RESULT_ARRAY_KEY[section];
  if (!key || !data || typeof data !== "object") return false;
  const arr = (data as Record<string, unknown>)[key];
  if (!Array.isArray(arr)) return true; // missing or null key is also a bad result
  return arr.length === 0;
}

// Hard timeout on every Supabase operation — a hanging DB call (slow connection,
// missing table, cold pool) would otherwise consume the entire Vercel budget
// before Claude is ever called.
const DB_TIMEOUT_MS = 3000;

const CACHED_SECTIONS = new Set(["rankings", "podcasts", "books", "interviews", "related", "pressings"]);

const SONNET_SECTIONS = new Set(["rankings", "podcasts", "books", "interviews"]);

const MAX_TOKENS: Record<string, number> = {
  rankings:   2000,
  podcasts:   4096,
  books:      4096,
  interviews: 2000,
  blindspot:  2048,
  related:    1500,
  pressings:  0,
};

// Sections where Claude verifies results via Anthropic's server-side web search
// tool (runs within the same API call — no extra request loop needed) rather
// than relying solely on training-data recall.
const WEB_SEARCH_SECTIONS = new Set(["interviews", "podcasts", "books"]);

// Race an async callback against a timeout — returns null on timeout instead of hanging.
// Accepts a callback (not a raw Promise) so callers can pass Supabase query builders,
// which are thenable but not full Promises and confuse Promise.race's type inference.
async function withDbTimeout<T>(fn: () => PromiseLike<T>): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), DB_TIMEOUT_MS)
  );
  return Promise.race([Promise.resolve(fn()), timeout]);
}

// Deterministic backstop for the podcasts section: Claude is instructed to omit
// appleUrl/spotifyUrl rather than substitute a show-level URL, but model
// compliance isn't guaranteed — strip anything that doesn't actually match an
// episode-level URL pattern so a show link never slips through silently
// labeled as "verified" (the client's own fuzzy-match fallback gets a real
// shot at finding the episode instead).
function isAppleEpisodeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "podcasts.apple.com" && u.searchParams.has("i");
  } catch {
    return false;
  }
}

function isSpotifyEpisodeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "open.spotify.com" && u.pathname.startsWith("/episode/");
  } catch {
    return false;
  }
}

function stripUnverifiedPodcastUrls(data: unknown): void {
  if (!data || typeof data !== "object" || !Array.isArray((data as { episodes?: unknown }).episodes)) return;
  for (const ep of (data as { episodes: Record<string, unknown>[] }).episodes) {
    if (typeof ep.appleUrl === "string" && !isAppleEpisodeUrl(ep.appleUrl)) delete ep.appleUrl;
    if (typeof ep.spotifyUrl === "string" && !isSpotifyEpisodeUrl(ep.spotifyUrl)) delete ep.spotifyUrl;
  }
}

// Same backstop for the books section: a "verified" link must be the book's own
// product page, not a search/category page or some other Amazon/Audible URL.
function isAmazonProductUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)amazon\.com$/.test(u.hostname)) return false;
    return /\/dp\/[A-Z0-9]{10}(?:[/?]|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

function isAudibleProductUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)audible\.com$/.test(u.hostname)) return false;
    return u.pathname.startsWith("/pd/");
  } catch {
    return false;
  }
}

function stripUnverifiedBookUrls(data: unknown): void {
  if (!data || typeof data !== "object" || !Array.isArray((data as { items?: unknown }).items)) return;
  for (const item of (data as { items: Record<string, unknown>[] }).items) {
    if (typeof item.amazonUrl === "string" && !isAmazonProductUrl(item.amazonUrl)) delete item.amazonUrl;
    if (typeof item.audibleUrl === "string" && !isAudibleProductUrl(item.audibleUrl)) delete item.audibleUrl;
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Discogs discography groundtruth ───────────────────────────────────────────
// Fetched for rankings/blindspot so Claude has verified titles and years rather
// than relying on training-data recall, which produces wrong chronology and
// hallucinated "final album" claims (e.g. Kikagaku Moyo's Stone Garden ≠ their
// final LP — Kumoyo Island (2022) is, but Claude placed Stone Garden last).

type DiscogsAlbum = { title: string; year: number };

async function fetchDiscogsDiscography(artistName: string): Promise<DiscogsAlbum[]> {
  try {
    const key    = process.env.DISCOGS_CONSUMER_KEY;
    const secret = process.env.DISCOGS_CONSUMER_SECRET;
    const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
    if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

    // Find the artist ID — take the first "artist" type result
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return [];
    const { results = [] } = await searchRes.json() as { results?: { id: number; type: string }[] };
    const artistId = results.find(r => r.type === "artist")?.id;
    if (!artistId) return [];

    // Fetch releases sorted chronologically
    const relRes = await fetch(
      `https://api.discogs.com/artists/${artistId}/releases?per_page=100&sort=year&sort_order=asc`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!relRes.ok) return [];
    const { releases = [] } = await relRes.json() as {
      releases?: { type: string; role: string; title: string; year: number; format?: string }[];
    };

    // Masters where the artist is the primary act — exclude obvious live/single entries
    const LIVE_PAT   = /\blive\b|\blive at\b|\bconcert\b/i;
    const SINGLE_PAT = /\bb\/w\b/i;
    const seen = new Set<string>();
    const out: DiscogsAlbum[] = [];
    for (const r of releases) {
      if (r.role !== "Main" || r.type !== "master" || !r.year || r.year < 1900) continue;
      if (LIVE_PAT.test(r.title) || SINGLE_PAT.test(r.title)) continue;
      const fmt = (r.format ?? "").toLowerCase();
      if (fmt && (fmt.includes("live") || fmt.includes("single"))) continue;
      const norm = r.title.toLowerCase().trim();
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({ title: r.title, year: r.year });
    }
    return out;
  } catch {
    return [];
  }
}

// ── Discogs pressing data ─────────────────────────────────────────────────────
// Fetches real pressing variants from Discogs masters + marketplace stats.
// Returns structured data: per album, vinyl pressing variants sorted by
// wantlist count (popularity proxy for desirability).

type PressingVariant = {
  releaseId: number;
  country: string;
  year: string;
  label: string;
  catno: string;
  format: string;
  inCollection: number;
  inWantlist: number;
  wantHaveRatio: number;
};

type PressingsAlbum = {
  album: string;
  year: number;
  masterId: number;
  variants: PressingVariant[];
};

async function fetchPressingsData(artistName: string): Promise<{ pressings: PressingsAlbum[] }> {
  try {
    const key    = process.env.DISCOGS_CONSUMER_KEY;
    const secret = process.env.DISCOGS_CONSUMER_SECRET;
    const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
    if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

    // Artist search
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return { pressings: [] };
    const { results = [] } = await searchRes.json() as { results?: { id: number; type: string }[] };
    const artistId = results.find(r => r.type === "artist")?.id;
    if (!artistId) return { pressings: [] };

    // Artist releases — studio albums (Main role, master type)
    const relRes = await fetch(
      `https://api.discogs.com/artists/${artistId}/releases?per_page=100&sort=year&sort_order=asc`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!relRes.ok) return { pressings: [] };
    const { releases = [] } = await relRes.json() as {
      releases?: { type: string; role: string; title: string; year: number; id: number }[];
    };

    const LIVE_PAT   = /\blive\b|\blive at\b|\bconcert\b/i;
    const SINGLE_PAT = /\bb\/w\b/i;
    const seen = new Set<string>();
    const albums: { title: string; year: number; masterId: number }[] = [];
    for (const r of releases) {
      if (r.role !== "Main" || r.type !== "master" || !r.year || r.year < 1900) continue;
      if (LIVE_PAT.test(r.title) || SINGLE_PAT.test(r.title)) continue;
      const norm = r.title.toLowerCase().trim();
      if (seen.has(norm)) continue;
      seen.add(norm);
      albums.push({ title: r.title, year: r.year, masterId: r.id });
    }

    const topAlbums = albums.slice(0, 6);
    if (topAlbums.length === 0) return { pressings: [] };

    // Discogs versions endpoint returns label as a string (not array), and
    // year as a number that may be 0 when unknown — released has the full date.
    type DiscogsVersion = {
      id: number;
      country?: string;
      year?: number | string;
      released?: string;
      label?: string | string[];
      catno?: string;
      format?: string;
      stats?: { community?: { in_collection: number; in_wantlist: number } };
    };

    // Fetch vinyl versions for each album in parallel
    const versionsResults = await Promise.all(
      topAlbums.map(async (album) => {
        try {
          const res = await fetch(
            `https://api.discogs.com/masters/${album.masterId}/versions?format=Vinyl&per_page=100`,
            { headers, signal: AbortSignal.timeout(8000) }
          );
          if (!res.ok) return { ...album, versions: [] as DiscogsVersion[] };
          const json = await res.json() as { versions?: DiscogsVersion[] };
          return { ...album, versions: json.versions ?? [] };
        } catch {
          return { ...album, versions: [] as DiscogsVersion[] };
        }
      })
    );

    function extractYear(v: DiscogsVersion): string {
      const y = Number(v.year);
      if (y && y > 1900) return String(y);
      // Fall back to the released date string (e.g. "2013-05-21" → "2013")
      if (v.released) {
        const fromReleased = parseInt(v.released.slice(0, 4));
        if (fromReleased > 1900) return String(fromReleased);
      }
      return "";
    }

    function extractLabel(v: DiscogsVersion): string {
      if (Array.isArray(v.label)) return v.label[0] ?? "Unknown";
      return (v.label as string | undefined) ?? "Unknown";
    }

    // Sort each album's pressings by wantlist count, take top 5
    const processedAlbums = versionsResults.map(({ title, year, masterId, versions }) => {
      const vinyl = versions
        .filter(v => v.country && v.stats?.community)
        .map(v => {
          const inCollection = v.stats?.community?.in_collection ?? 0;
          const inWantlist   = v.stats?.community?.in_wantlist   ?? 0;
          return {
            releaseId: v.id,
            country:   v.country ?? "Unknown",
            year:      extractYear(v),
            label:     extractLabel(v),
            catno:     v.catno   ?? "",
            format:    v.format  ?? "Vinyl",
            inCollection,
            inWantlist,
            wantHaveRatio: Math.round((inWantlist / Math.max(inCollection, 1)) * 100) / 100,
          } satisfies PressingVariant;
        })
        .sort((a, b) => b.inWantlist - a.inWantlist)
        .slice(0, 5);
      return { album: title, year, masterId, variants: vinyl };
    });

    return { pressings: processedAlbums };
  } catch {
    return { pressings: [] };
  }
}

async function readCache(artist: string, section: string): Promise<unknown | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const ttlDays = CACHE_TTL_DAYS[section] ?? 30;
    // ttlDays === 0 means "never expire" — skip the staleness filter entirely
    // rather than computing a cutoff of "now", which would make every row
    // look stale (the opposite of permanent).
    let query = supabase
      .from("deep_dive_cache")
      .select("data")
      .eq("artist", artist)
      .eq("section", section);
    if (ttlDays > 0) {
      const staleAfter = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
      query = query.gt("refreshed_at", staleAfter);
    }
    const result = await withDbTimeout(() => query.maybeSingle());
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

const PROMPTS: Record<string, (artist: string, ownedAlbums?: string[], discogsAlbums?: DiscogsAlbum[]) => string> = {
  rankings: (artist, ownedAlbums = [], discogsAlbums = []) => {
    const verifiedBlock = discogsAlbums.length > 0
      ? `\nVERIFIED CATALOGUE from Discogs — accurate titles and release years. You MUST only rank albums present in this list:\n${discogsAlbums.map(a => `- ${a.year}: ${a.title}`).join("\n")}\n`
      : "";
    const ownedBlock = ownedAlbums.length > 0
      ? `\nALBUMS THIS COLLECTOR OWNS — include as many of these as possible in the ranking:\n${ownedAlbums.map(a => `- ${a}`).join("\n")}\n`
      : "";
    return `You are a music critic writing for serious vinyl collectors. Rank ${artist}'s most essential studio albums from best to worst.
${verifiedBlock}
CRITICAL ACCURACY RULES:
${discogsAlbums.length > 0
  ? `- You MUST only rank albums present in the VERIFIED CATALOGUE above. Never add an album not on that list.`
  : `- Only include albums you are certain exist. If unsure, omit it.`}
- Use the year from the VERIFIED CATALOGUE exactly — do not guess or alter release years.
- Do not confuse ${artist} with any other artist.
- Studio albums only — no compilations, live records, or EPs unless universally regarded as a major work.
- Return EXACTLY 6 albums maximum — choose the most essential, even for prolific artists. Do not exceed 6.
- Keep each review to 2 sentences.
${ownedBlock}
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2 sentence critical review."}]}`;
  },

  podcasts: (artist) =>
    `You are a music research assistant with web search access. Find specific podcast episodes for a fan of ${artist}.

Priority order:
1. Dedicated podcast series about ${artist} or their albums — include the series itself as a named show with its best or most recent episode
2. Specific episodes where ${artist} is a main guest or interview subject — include the exact episode title
3. Specific episodes that do a deep review of a named ${artist} album — include the exact episode title and album name

INSTRUCTIONS:
- For each candidate episode, use web search to confirm it actually exists and to find its real listen URL — e.g. search "<show> <episode title>" and look for a podcasts.apple.com or open.spotify.com result.
- "appleUrl" must be the EPISODE's own page — a real Apple Podcasts episode URL always has an "?i=" query parameter (e.g. https://podcasts.apple.com/us/podcast/show-name/id123456789?i=1000098765432). A URL without "?i=" is just the show page, not the episode.
- "spotifyUrl" must be the EPISODE's own page — a real Spotify episode URL always starts with https://open.spotify.com/episode/ (not /show/, which is the show page, not the episode).
- If search only turns up the show's page and not an episode-specific URL matching the patterns above, OMIT that URL field entirely — do NOT substitute the show URL. A downstream lookup will try harder to find the exact episode; a wrong-precision link is worse than none.
- Always provide a specific episode title. Never use "Various episodes" or vague placeholders — if you cannot name and verify a specific episode, omit that show entirely.
- Include the year of the specific episode, not the show's launch year.
- Aim for 5–6 results maximum. Quality over quantity — only include episodes you verified via search.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"episodes":[{"show":"Show Name","episode":"Exact episode title","year":2021,"type":"interview","note":"One sentence on why worth listening","appleUrl":"https://podcasts.apple.com/...","spotifyUrl":"https://open.spotify.com/..."}]}
type must be one of: "interview", "review", "documentary", "discussion". appleUrl and spotifyUrl are optional — omit whichever you could not verify. Return an empty array only if you genuinely cannot verify any. Do not fabricate.`,

  books: (artist) =>
    `You are a music research assistant with web search access, helping a vinyl collector. List books and audiobooks by or about ${artist}.

ORDER — strictly follow this:
1. Books or audiobooks WRITTEN OR NARRATED BY ${artist} themselves (memoirs, essays, spoken word) — list these first
2. Books significantly about ${artist} — biographies, critical studies, authorised accounts
3. Essential books about the scene, era, or movement ${artist} defined — only include if genuinely illuminating for a fan

INSTRUCTIONS:
- Use web search to confirm each title actually exists before including it — a title you can't verify is worse than no title.
- If the format includes print ("book" or "both"), search for the real Amazon product page (e.g. "<title> <author> site:amazon.com") and set "amazonUrl" to that book's own product page — it must contain "/dp/" followed by the ASIN (e.g. https://www.amazon.com/dp/0571234567). A search-results or category page is not a product page — omit the field instead of guessing.
- If the format includes audio ("audiobook" or "both"), search for the real Audible page (e.g. "<title> <author> site:audible.com") and set "audibleUrl" to that title's own product page — it must start with "/pd/" (e.g. https://www.audible.com/pd/Title-Audiobook/B0ABCDEFGH). Omit the field if you can't find that exact pattern.
- For the "format" field: use "audiobook" if only available as audio. Use "both" if it exists as both print and audiobook. Use "book" if no audiobook edition is known. This field controls which store links appear — be accurate.
- For the "isbn13" field: include the ISBN-13 if you are confident (13 digits, starts with 978 or 979). Omit if uncertain — a wrong ISBN is worse than none.
- For the "written_by_artist" field: set true if ${artist} is the author or primary narrator. Set false for all other items.
- Return up to 6 items total, sorted by year ascending within each group.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"items":[{"title":"Book Title","author":"Author Name","year":2003,"type":"memoir","format":"both","isbn13":"9780571234567","written_by_artist":true,"note":"One sentence on why essential","amazonUrl":"https://www.amazon.com/dp/...","audibleUrl":"https://www.audible.com/pd/..."}]}
type must be one of: "biography", "memoir", "criticism", "history", "fiction", "reference". amazonUrl and audibleUrl are optional — omit whichever you could not verify. Do not fabricate titles.`,

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

Return up to 6 results, sorted by publication date descending (most recent first).
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"interviews":[{"publication":"Pitchfork","domain":"pitchfork.com","title":"Interview title or description","year":2019,"date":"2019-03","url":"https://pitchfork.com/features/interview/artist-name/","note":"What makes it worth reading"}]}
"date" is optional — YYYY-MM or YYYY-MM-DD when known. "year" is always required.
Do not fabricate URLs. Only include what you find via search.`,

  related: (artist) =>
    `You are a music expert guiding a vinyl collector. Based on ${artist}'s style, sound, and era, suggest 8 related artists worth exploring. Cover both the obvious (close contemporaries, same scene) and the less obvious (stylistic connections, cross-genre links).
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"artists":[{"name":"Artist Name","genre":"Style or genre","reason":"Why fans of ${artist} will connect with this artist","mustHear":"The one album to start with"}]}`,

  blindspot: (artist, ownedAlbums = [], discogsAlbums = []) => {
    const ownedBlock = ownedAlbums.length > 0
      ? `ALREADY OWNED — do NOT recommend any of these under any circumstances:\n${ownedAlbums.map(a => `  - ${a}`).join("\n")}`
      : `The collector does not yet own any albums by ${artist}.`;
    const verifiedBlock = discogsAlbums.length > 0
      ? `\nCOMPLETE CATALOGUE from Discogs (verified titles and years — only recommend from this list):\n${discogsAlbums.map(a => `- ${a.year}: ${a.title}`).join("\n")}\n`
      : "";
    return `You are a record collector's guide helping a vinyl enthusiast identify genuine gaps in their ${artist} collection.

${ownedBlock}
${verifiedBlock}
CRITICAL RULES:
- NEVER recommend an album that appears in the ALREADY OWNED list above. If you are unsure whether an album matches one already owned, do not recommend it.
${discogsAlbums.length > 0
  ? `- Only recommend albums from the COMPLETE CATALOGUE list above. Do not fabricate or suggest albums not on that list.`
  : `- Only recommend albums you are certain ${artist} actually released. Do not fabricate or guess titles.`}
- Studio albums only — no live albums, compilations, or EPs unless they are genuinely essential to the artist's legacy.
- Be selective: flag only albums a serious collector would consider essential gaps, not completionist picks.
- If the collection already covers the essential catalogue, return {"albums":[]}.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"title":"Album Title","year":1975,"why":"Why this album is essential and what the collector is missing","tip":"Edition or pressing worth seeking"}]}
List at most 6 albums.`;
  },
};

// Shared by the live POST handler and the prewarm cron route: serves a fresh
// cache hit if one exists, otherwise calls Claude, parses/cleans the result,
// and writes it back to the shared cache (skipping empty results — see
// isEmptyResult). Throws on invalid input or a JSON parse failure.
export async function getOrGenerateSection(
  artist: string,
  section: string,
  ownedAlbums?: string[],
  force?: boolean
): Promise<{ data: unknown; cached: boolean }> {
  if (!artist || !section) throw new Error("Invalid request");

  // ── Pressings: pure Discogs data, no Claude ────────────────────────────────
  if (section === "pressings") {
    if (!force) {
      const cached = await readCache(artist, "pressings");
      if (cached) return { data: cached, cached: true };
    }
    const data = await fetchPressingsData(artist);
    if (!isEmptyResult("pressings", data)) {
      after(() => writeCache(artist, "pressings", data));
    }
    return { data, cached: false };
  }

  if (!PROMPTS[section]) throw new Error("Invalid request");

  // ── Cache read (3 s hard timeout — hangs must not block Claude) ────────────
  // Skip when force=true so a user-initiated Retry always gets a fresh generation
  // rather than the stale bad result that triggered the retry in the first place.
  if (CACHED_SECTIONS.has(section) && !force) {
    const cached = await readCache(artist, section);
    if (cached) {
      // Cached podcasts/books entries from before product-vs-page URL validation
      // existed may still have a non-product URL mislabeled as verified — strip
      // it on read so the client's fallback lookup gets a real shot, without
      // paying for regeneration.
      if (section === "podcasts") stripUnverifiedPodcastUrls(cached);
      if (section === "books") stripUnverifiedBookUrls(cached);
      return { data: cached, cached: true };
    }
  }

  // ── Model + token budget ───────────────────────────────────────────────────
  const model     = SONNET_SECTIONS.has(section) ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
  const maxTokens = MAX_TOKENS[section] ?? 1500;

  // Pass up to 5 owned albums for sections that use them; keeps prompt concise.
  const promptAlbums = (section === "rankings" || section === "blindspot") && ownedAlbums?.length
    ? ownedAlbums.slice(0, 5)
    : ownedAlbums;

  // ── Discogs discography fetch (rankings + blindspot only) ──────────────────
  // Fetch verified album titles and years before calling Claude so the model
  // cannot hallucinate albums that don't exist or assign wrong release years.
  let discogsAlbums: DiscogsAlbum[] = [];
  if (section === "rankings" || section === "blindspot") {
    discogsAlbums = await fetchDiscogsDiscography(artist);
    console.log(`[deep-dive] discogs — ${artist}: ${discogsAlbums.length > 0 ? `${discogsAlbums.length} albums` : "unavailable, proceeding without"}`);
  }

  console.log(`[deep-dive] calling ${model} — ${artist}/${section} max_tokens=${maxTokens}`);

  // Interviews, podcasts, and books use Anthropic's built-in web search tool
  // (server-side, no extra API key) so Claude verifies real URLs instead of
  // relying on training-data recall, which produces hallucinated episode
  // titles / ISBNs that never resolve on the actual platform.
  // The `as any` casts are needed because the SDK typings may not yet include this tool type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = (await (client.messages.create as any)({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: PROMPTS[section](artist, promptAlbums, discogsAlbums) }],
    ...(WEB_SEARCH_SECTIONS.has(section) && {
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  })) as Anthropic.Message;

  console.log(`[deep-dive] done — ${artist}/${section} stop_reason=${message.stop_reason} tokens=${message.usage.output_tokens}`);

  // Use the last text block, not the first — with web search enabled, Claude
  // sometimes prefaces the JSON with a text block discussing what it found
  // before settling on a final answer.
  const textBlocks = message.content.filter((b) => b.type === "text");
  const text  = textBlocks[textBlocks.length - 1]?.text ?? "";
  let clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Claude occasionally adds a disclaimer sentence before or after the JSON
  // despite "no preamble" instructions — fall back to extracting the
  // outermost {...} object rather than failing the whole section.
  if (!clean.startsWith("{")) {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start !== -1 && end > start) clean = clean.slice(start, end + 1);
  }

  let data: unknown;
  try {
    data = JSON.parse(clean);
  } catch {
    console.error(`[deep-dive] parse error — ${artist}/${section} stop=${message.stop_reason} raw=${clean.slice(0, 400)}`);
    throw new Error("Parse error");
  }

  if (section === "podcasts") stripUnverifiedPodcastUrls(data);
  if (section === "books") stripUnverifiedBookUrls(data);

  // ── Cache write (fire-and-forget via after(), 3 s hard timeout) ────────────
  // Same Vercel mid-flight-kill issue as the deep-dive-session tracking below —
  // a bare unawaited call was likely losing the write before it landed.
  // Skipped for empty results so a transient failure can't freeze "No
  // information available" in the shared cache for the full TTL.
  if (CACHED_SECTIONS.has(section) && !isEmptyResult(section, data)) {
    after(() => writeCache(artist, section, data));
  }

  return { data, cached: false };
}

export async function POST(request: NextRequest) {
  let artist = "";
  let section = "";
  try {
    // Deep Dive is a supporter-only feature (src/app/deep-dive/page.tsx gates
    // the page) — this route only used getUser() later for fire-and-forget
    // session tracking, never to actually require auth, so it was directly
    // callable by anyone, bypassing both the login wall and the paywall, with
    // no rate limit on Anthropic + web-search spend.
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await isSupporter(authClient, user.id))) {
      return NextResponse.json({ error: "Supporter access required" }, { status: 403 });
    }
    // Every caller here has already passed the supporter check above — this
    // route has no free tier — so this is really a supporter daily cap, not a
    // free-tier one. Sized generously (≈25 artists at all 6 tabs each) since
    // it exists to stop runaway/scripted spend, not to ration normal usage.
    const SUPPORTER_INTELLIGENCE_LIMIT = 150;
    const { allowed, used, limit } = await checkDailyLimit(authClient, user.id, "deep_dive_intelligence", SUPPORTER_INTELLIGENCE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: "daily_limit_reached", used, limit }, { status: 429 });
    }

    const body = (await request.json()) as {
      artist?: string;
      section?: string;
      ownedAlbums?: string[];
      force?: boolean;
    };
    artist  = body.artist  ?? "";
    section = body.section ?? "";
    const ownedAlbums = body.ownedAlbums;
    const force = body.force === true;

    const { data, cached } = await getOrGenerateSection(artist, section, ownedAlbums, force);

    // ── Track per-user deep dive (fire-and-forget, kept alive via after() —
    // a bare unawaited async IIFE gets killed mid-flight as soon as the
    // response below is sent, which is why deep dive sessions weren't landing) ──
    after(async () => {
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
    });

    return NextResponse.json({ data, cached });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Parse error") {
      return NextResponse.json({ error: "Parse error" }, { status: 500 });
    }
    console.error(`[deep-dive] unhandled error — ${artist}/${section}:`, error);
    return NextResponse.json({ error: "Claude API error" }, { status: 500 });
  }
}
