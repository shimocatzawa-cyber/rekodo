import { type NextRequest, NextResponse, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { checkDailyLimit, isSupporter } from "@/lib/rateLimit";

export const maxDuration = 120;

const client = new Anthropic();

const CACHE_TTL_DAYS: Record<string, number> = {
  rankings:  180,
  podcasts:  60,
  print:     90,
  related:   0,
  pressings: 1,
};

const RESULT_ARRAY_KEY: Record<string, string> = {
  rankings:  "albums",
  podcasts:  "episodes",
  related:   "artists",
  pressings: "pressings",
};

function isEmptyResult(section: string, data: unknown): boolean {
  if (section === "print") {
    if (!data || typeof data !== "object") return true;
    const d = data as { books?: unknown[]; interviews?: unknown[] };
    return (d.books?.length ?? 0) === 0 && (d.interviews?.length ?? 0) === 0;
  }
  const key = RESULT_ARRAY_KEY[section];
  if (!key || !data || typeof data !== "object") return false;
  const arr = (data as Record<string, unknown>)[key];
  if (!Array.isArray(arr)) return true;
  return arr.length === 0;
}

// Hard timeout on every Supabase operation — a hanging DB call (slow connection,
// missing table, cold pool) would otherwise consume the entire Vercel budget
// before Claude is ever called.
const DB_TIMEOUT_MS = 3000;

const CACHED_SECTIONS = new Set(["rankings", "podcasts", "print", "related", "pressings"]);


const MAX_TOKENS: Record<string, number> = {
  rankings:  1500,
  podcasts:  1000,
  print:     2048,
  blindspot: 2048,
  related:   1500,
  pressings: 0,
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

    // Fetch releases sorted chronologically. per_page=500 ensures prolific artists
    // (e.g. Radiohead) don't have their later catalogue cut off at 100 items —
    // which would omit In Rainbows, Hail to the Thief, etc.
    const relRes = await fetch(
      `https://api.discogs.com/artists/${artistId}/releases?per_page=500&sort=year&sort_order=asc`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!relRes.ok) return [];
    const { releases = [] } = await relRes.json() as {
      releases?: { type: string; role: string; title: string; year: number; format?: string }[];
    };

    // Masters where the artist is the primary act — exclude obvious non-album entries.
    // Discogs master records often lack a format field, so singles (e.g. "Don't Be Sad"
    // by Whiskeytown — a 7" single, not an album) can slip through. We apply both
    // title-pattern and format-field exclusions; the prompt adds a final Claude-side guard.
    const LIVE_PAT   = /\blive\b|\blive at\b|\bconcert\b/i;
    const SINGLE_PAT = /\bb\/w\b/i;
    const REMIX_PAT  = /\bremix(es)?\b|\bdub\b|\bedit\b|\breworked?\b/i;
    // When Discogs does populate the format field for a master, use it as a positive
    // gate: only pass through entries that look like albums (contain "lp" or "album"),
    // and hard-exclude anything that reveals itself to be a single or EP.
    const FORMAT_SINGLE_PAT = /\b(7"|ep|45\s*rpm|single)\b/i;
    const seen = new Set<string>();
    const out: DiscogsAlbum[] = [];
    for (const r of releases) {
      if (r.role !== "Main" || r.type !== "master" || !r.year || r.year < 1900) continue;
      if (LIVE_PAT.test(r.title) || SINGLE_PAT.test(r.title) || REMIX_PAT.test(r.title)) continue;
      const fmt = (r.format ?? "").toLowerCase();
      if (fmt) {
        // If the format field is present and reveals a non-album, always exclude.
        if (fmt.includes("live") || fmt.includes("single") || FORMAT_SINGLE_PAT.test(fmt)) continue;
        // If the format field is present but doesn't indicate LP/Album, also exclude —
        // albums in Discogs always say "lp" or "album" when the field is populated.
        const looksLikeAlbum = fmt.includes("lp") || fmt.includes("album");
        if (!looksLikeAlbum) continue;
      }
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

// ── Tavily Search interview discovery ────────────────────────────────────────
// Searches the web for real interview URLs before calling Claude, so the model
// can annotate verified links rather than recalling from training data (which
// misses smaller music sites like furious.com). Free tier: 1000 req/month.

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

async function searchTavilyInterviews(artist: string, discogsAlbums: DiscogsAlbum[]): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  // Use an early album title to disambiguate common names (e.g. "Colleen" → "Colleen Everyone Alive Wants Answers interview")
  const albumHint = discogsAlbums[0]?.title ?? "";
  const query = albumHint
    ? `"${artist}" "${albumHint}" interview`
    : `"${artist}" musician interview`;

  const EXCLUDE = ["spotify.com", "apple.com", "youtube.com", "amazon.com",
    "wikipedia.org", "discogs.com", "allmusic.com", "facebook.com",
    "instagram.com", "twitter.com", "x.com", "setlist.fm"];

  const INTERVIEW_PAT = /interview|feature|conversation|in conversation|profile|talks to|speaks to|we spoke|q&a/i;

  // Second query targets press/interview pages specifically
  const query2 = albumHint
    ? `"${artist}" musician press interview feature`
    : `"${artist}" musician press interview feature`;

  try {
    const [res1, res2] = await Promise.all([
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query, max_results: 7, search_depth: "basic", exclude_domains: EXCLUDE }),
        signal: AbortSignal.timeout(6000),
      }),
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: query2, max_results: 7, search_depth: "basic", exclude_domains: EXCLUDE }),
        signal: AbortSignal.timeout(6000),
      }),
    ]);

    const seen = new Set<string>();
    const results: TavilyResult[] = [];

    for (const res of [res1, res2]) {
      if (!res.ok) continue;
      const json = await res.json() as { results?: TavilyResult[] };
      for (const r of (json.results ?? [])) {
        if (!seen.has(r.url) && (INTERVIEW_PAT.test(r.title) || INTERVIEW_PAT.test(r.content))) {
          seen.add(r.url);
          results.push(r);
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ── Open Library book search ──────────────────────────────────────────────────
// Free, no API key — used to ground the print prompt with real verified book
// titles before handing off to Haiku, preventing hallucinated memoirs/bios.

type OpenLibraryBook = {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
};

async function searchOpenLibraryBooks(artist: string): Promise<OpenLibraryBook[]> {
  try {
    const fields = "title,author_name,first_publish_year";
    const [byAuthor, bySubject] = await Promise.all([
      fetch(
        `https://openlibrary.org/search.json?author=${encodeURIComponent(artist)}&fields=${fields}&limit=15`,
        { signal: AbortSignal.timeout(5000) }
      ),
      fetch(
        `https://openlibrary.org/search.json?subject=${encodeURIComponent(artist)}&fields=${fields}&limit=15`,
        { signal: AbortSignal.timeout(5000) }
      ),
    ]);

    const seen = new Set<string>();
    const results: OpenLibraryBook[] = [];

    for (const res of [byAuthor, bySubject]) {
      if (!res.ok) continue;
      const json = await res.json() as { docs?: OpenLibraryBook[] };
      for (const doc of (json.docs ?? [])) {
        const key = doc.title.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          results.push(doc);
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

function buildPrintPromptWithOpenLibrary(
  artist: string,
  books: OpenLibraryBook[],
  discogsAlbums: DiscogsAlbum[],
  tavilyInterviews: TavilyResult[] = [],
): string {
  const identityBlock = discogsAlbums.length > 0
    ? `ARTIST IDENTITY: ${artist} is a musician who released these albums: ${discogsAlbums.slice(0, 8).map(a => `"${a.title}" (${a.year})`).join(", ")}. This is NOT any other person who shares this name (e.g. not an author, actor, or public figure).`
    : `ARTIST IDENTITY: ${artist} is a musician. This is NOT any other person who shares this name.`;

  const interviewBlock = tavilyInterviews.length > 0
    ? `\nVERIFIED INTERVIEW URLS found via web search — these are real pages that exist:\n${tavilyInterviews.map((r, i) => `${i + 1}. "${r.title}" — ${r.url}`).join("\n")}\n\nFor INTERVIEWS: select up to 5 from the VERIFIED INTERVIEW URLS above. Copy the URL exactly. Extract the publication name and domain from the URL. Write a one-sentence note on what makes it worth reading. Do not invent interviews beyond this list.`
    : `For INTERVIEWS: list up to 5 notable print/text interviews given by ${artist} the musician (Pitchfork, The Wire, The Guardian, NME, MOJO, Rolling Stone, Uncut, The Quietus, Bandcamp Daily, Fact, Resident Advisor, Stereogum, etc.). Only include interviews you are confident actually exist. Text only — no YouTube, podcasts, or audio/video. Return [] if none found with confidence.`;

  const booksList = books.length > 0
    ? books.map((b, i) => {
        const author = b.author_name?.join(", ") ?? "Unknown";
        const year = b.first_publish_year ?? "unknown year";
        return `${i + 1}. "${b.title}" by ${author} (${year})`;
      }).join("\n")
    : null;

  const booksBlock = booksList
    ? `\nVERIFIED BOOKS from Open Library (may contain results for other people named "${artist}" — only select those clearly about the musician):\n${booksList}\n\nFor BOOKS: select up to 5 from the list above that are clearly about ${artist} the musician or their music scene. Copy title and author exactly. Add type (biography|memoir|criticism|history|fiction|reference) and a one-sentence note. Set written_by_artist: true only when the artist is listed as author. Return [] if none are relevant.`
    : `No verified books were found for ${artist} the musician — return "books": [].`;

  return `You are a music research assistant helping a vinyl collector.

${identityBlock}
${booksBlock}
${interviewBlock}

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"books":[{"title":"Exact Title","author":"Author Name","year":2003,"type":"memoir","written_by_artist":true,"note":"One sentence"}],"interviews":[{"publication":"Furious","domain":"furious.com","title":"Interview title","year":2005,"url":"https://...","note":"What makes it worth reading"}]}`;
}

// ── iTunes podcast episode search ─────────────────────────────────────────────
// Free, no API key — used to ground the podcasts prompt with real verified
// episode titles and Apple Podcasts URLs before handing off to Haiku.

type iTunesEpisode = {
  trackName: string;
  collectionName: string;
  trackViewUrl: string;
  releaseDate: string;
};

async function searchItunesPodcasts(artist: string): Promise<iTunesEpisode[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=podcast&entity=podcastEpisode&limit=30`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const json = await res.json() as { results?: iTunesEpisode[] };
    // Keep only episode-level URLs (must carry the ?i= episode ID parameter)
    return (json.results ?? []).filter(
      (e) => typeof e.trackViewUrl === "string" && e.trackViewUrl.includes("?i=")
    );
  } catch {
    return [];
  }
}

function buildPodcastsPromptWithItunes(artist: string, episodes: iTunesEpisode[], discogsAlbums: DiscogsAlbum[]): string {
  const identityBlock = discogsAlbums.length > 0
    ? `ARTIST IDENTITY: ${artist} is a musician who released these albums: ${discogsAlbums.slice(0, 8).map(a => `"${a.title}" (${a.year})`).join(", ")}. This is NOT any other person who shares this name.`
    : `ARTIST IDENTITY: ${artist} is a musician. This is NOT any other person who shares this name.`;

  const list = episodes
    .map((e, i) => {
      const year = new Date(e.releaseDate).getFullYear();
      return `${i + 1}. Show: "${e.collectionName}" | Episode: "${e.trackName}" | Year: ${year} | Apple URL: ${e.trackViewUrl}`;
    })
    .join("\n");

  return `You are a music research assistant. Below are real podcast episodes found for ${artist} via iTunes Search.

${identityBlock}

VERIFIED EPISODES:
${list}

Select the 5–6 most relevant for a serious ${artist} fan. Prefer episodes where ${artist} the MUSICIAN is the main interview subject, deep-dive album reviews, or dedicated documentary episodes.

CRITICAL: If any episode is clearly about a different person who happens to share the name "${artist}" (e.g. an author, actor, or public figure), exclude it entirely. Only include episodes about the musician.

Copy the show name, episode title, year, and appleUrl EXACTLY as shown above. Add a one-sentence note on why it's worth listening. Only pick from this list — do not invent episodes.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"episodes":[{"show":"Show Name","episode":"Exact episode title","year":2021,"type":"interview","note":"One sentence on why worth listening","appleUrl":"https://podcasts.apple.com/..."}]}
type must be one of: "interview", "review", "documentary", "discussion".
If no episodes clearly relate to ${artist} the musician, return {"episodes":[]}.`;
}

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

    // ── Build album list ─────────────────────────────────────────────────────
    // Path A (preferred): use ranked albums from cached Deep Dive rankings.
    //   6 targeted Discogs master searches instead of 100+ artist-release
    //   fetches, staying comfortably within the 60 req/min consumer key limit.
    // Path B (fallback): scan artist releases when no rankings cached yet.

    let albums: { title: string; year: number; masterId: number }[] = [];

    type RankingAlbum = { title: string; year: number };
    const rankingsCache = await readCache(artistName, "rankings");
    const rankedAlbums: RankingAlbum[] | undefined =
      rankingsCache && typeof rankingsCache === "object" &&
      Array.isArray((rankingsCache as { albums?: unknown }).albums)
        ? (rankingsCache as { albums: RankingAlbum[] }).albums
        : undefined;

    if (rankedAlbums && rankedAlbums.length > 0) {
      // Path A: search for each ranked album's Discogs master in pairs (2 req at a time)
      const SEARCH_BATCH = 2;
      const SEARCH_DELAY_MS = 2000;
      for (let i = 0; i < rankedAlbums.length; i += SEARCH_BATCH) {
        if (i > 0) await new Promise(r => setTimeout(r, SEARCH_DELAY_MS));
        const batchResults = await Promise.all(
          rankedAlbums.slice(i, i + SEARCH_BATCH).map(async (album) => {
            try {
              const res = await fetch(
                `https://api.discogs.com/database/search?q=${encodeURIComponent(`${album.title} ${artistName}`)}&type=master&per_page=5`,
                { headers, signal: AbortSignal.timeout(5000) }
              );
              if (!res.ok) return null;
              const { results: sr = [] } = await res.json() as {
                results?: { id: number; title?: string; year?: number | string }[];
              };
              if (sr.length === 0) return null;
              // Prefer title+year match, then title-only, then first result
              const norm = album.title.toLowerCase().trim();
              const match =
                sr.find(r => {
                  const t = ((r.title ?? "").toLowerCase().split(" - ").pop() ?? "").trim();
                  return t.includes(norm) && String(r.year) === String(album.year);
                }) ??
                sr.find(r => {
                  const t = ((r.title ?? "").toLowerCase().split(" - ").pop() ?? "").trim();
                  return t.includes(norm);
                }) ??
                sr[0];
              return { title: album.title, year: album.year, masterId: match.id };
            } catch {
              return null;
            }
          })
        );
        albums.push(...batchResults.filter((m): m is { title: string; year: number; masterId: number } => m !== null));
      }
    } else {
      // Path B: scan first 100 artist releases, take up to 30 Main album masters
      const relRes = await fetch(
        `https://api.discogs.com/artists/${artistId}/releases?per_page=100&sort=year&sort_order=asc`,
        { headers, signal: AbortSignal.timeout(5000) }
      );
      if (!relRes.ok) return { pressings: [] };
      const { releases = [] } = await relRes.json() as {
        releases?: { type: string; role: string; title: string; year: number; id: number; format?: string }[];
      };

      const LIVE_PAT          = /\blive\b|\blive at\b|\bconcert\b/i;
      const SINGLE_PAT        = /\bb\/w\b/i;
      const REMIX_PAT         = /\bremix(es)?\b|\bdub\b|\bedit\b|\breworked?\b/i;
      const FORMAT_SINGLE_PAT = /\b(7"|ep|45\s*rpm|single)\b/i;
      const seen = new Set<string>();
      for (const r of releases) {
        if (albums.length >= 30) break;
        if (r.role !== "Main" || r.type !== "master" || !r.year || r.year < 1900) continue;
        if (LIVE_PAT.test(r.title) || SINGLE_PAT.test(r.title) || REMIX_PAT.test(r.title)) continue;
        const fmt = (r.format ?? "").toLowerCase();
        if (fmt) {
          if (fmt.includes("live") || fmt.includes("single") || FORMAT_SINGLE_PAT.test(fmt)) continue;
          const looksLikeAlbum = fmt.includes("lp") || fmt.includes("album");
          if (!looksLikeAlbum) continue;
        }
        const norm = r.title.toLowerCase().trim();
        if (seen.has(norm)) continue;
        seen.add(norm);
        albums.push({ title: r.title, year: r.year, masterId: r.id });
      }
    }

    if (albums.length === 0) return { pressings: [] };

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

    // Fetch vinyl versions in batches of 3 with 3s delay → ≈36 req/min,
    // comfortably under the 60 req/min consumer key limit.
    const BATCH = 3;
    const BATCH_DELAY_MS = 3000;
    const versionsResults: ({ title: string; year: number; masterId: number; versions: DiscogsVersion[] })[] = [];
    for (let i = 0; i < albums.length; i += BATCH) {
      if (i > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      const batchResults = await Promise.all(
        albums.slice(i, i + BATCH).map(async (album) => {
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
      versionsResults.push(...batchResults);
    }

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

    // LP\b catches both "LP, Album" and "2xLP, Album" — \bLP\b was too strict
    // and excluded double-vinyl reissues entirely.
    const LP_PAT = /LP\b/i;
    const processedAlbums = versionsResults.map(({ title, year, masterId, versions }) => {
      const vinyl = versions
        .filter(v =>
          v.country &&
          v.stats?.community &&
          v.format && LP_PAT.test(v.format)
        )
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

    // Fetch prices for albums that have LP variants, bundled into the cache.
    // Batched at 4 per 4s = 60 req/min, matching the consumer key rate limit.
    const allReleaseIds = processedAlbums
      .filter(a => a.variants.length > 0)
      .flatMap(a => a.variants.map(v => v.releaseId));
    const priceMap = new Map<number, { lowestPrice: number | null; numForSale: number }>();
    const PRICE_BATCH = 4;
    const PRICE_DELAY_MS = 4000;
    for (let i = 0; i < allReleaseIds.length; i += PRICE_BATCH) {
      if (i > 0) await new Promise(r => setTimeout(r, PRICE_DELAY_MS));
      await Promise.all(allReleaseIds.slice(i, i + PRICE_BATCH).map(async (releaseId) => {
        try {
          const res = await fetch(
            `https://api.discogs.com/marketplace/stats/${releaseId}?curr_abbr=USD`,
            { headers, signal: AbortSignal.timeout(5000) }
          );
          if (!res.ok) return;
          const json = await res.json() as {
            lowest_price?: { value: number } | null;
            num_for_sale?: number;
            blocked_from_sale?: boolean;
          };
          if (!json.blocked_from_sale) {
            priceMap.set(releaseId, {
              lowestPrice: json.lowest_price?.value ?? null,
              numForSale:  json.num_for_sale ?? 0,
            });
          }
        } catch { /* price is best-effort */ }
      }));
    }

    const pressings = processedAlbums.map(a => ({
      ...a,
      variants: a.variants.map(v => ({
        ...v,
        lowestPrice: priceMap.get(v.releaseId)?.lowestPrice ?? null,
        numForSale:  priceMap.get(v.releaseId)?.numForSale  ?? 0,
      })),
    }));

    return { pressings };
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
    return `You are a music guide for serious vinyl collectors. Rank ${artist}'s most essential studio albums from best to worst by critical consensus and collector reputation.
${verifiedBlock}
CRITICAL ACCURACY RULES:
${discogsAlbums.length > 0
  ? `- The VERIFIED CATALOGUE above may contain singles, EPs, and individual song titles alongside full-length albums. You MUST only rank full-length studio albums (typically 8+ tracks, released as LP). Discard any entry that is a single track title, a 7" or 12" single, an EP, a compilation, a live record, or a remix album — even if it appears in the catalogue list.
- SONG TITLE TRAP: If a catalogue entry title matches (or closely resembles) a well-known song by ${artist}, it is almost certainly a single release — not a standalone album. Exclude it. Do not write a description for it.`
  : `- Only include full-length studio albums you are certain exist. If unsure, omit it.`}
- Use the year from the VERIFIED CATALOGUE exactly — do not guess or alter release years.
- Do not confuse ${artist} with any other artist.
- Return EXACTLY 6 albums maximum — choose the most essential, even for prolific artists. Do not exceed 6.
- Rank by genuine artistic significance and critical standing — do NOT include weaker early albums just because they came first.
- Keep each review to 2 sentences.
- DESCRIPTION STYLE: Factual only — describe what the record sounds like, its instrumentation, production approach, or how it differs from the artist's other work. No vague assertions like "essential", "landmark", "apex", "grail", "masterclass", "rewarding", "vindicating" or similar critical boilerplate. State facts, not importance.
${ownedBlock}
Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"2 sentence factual description."}]}`;
  },

  podcasts: (artist) =>
    `You are a music research assistant. Find podcast episodes a fan of ${artist} should listen to.

Priority order:
1. Dedicated podcast series about ${artist} or their albums — include the series name and its best or most representative episode title
2. Episodes where ${artist} is a guest or interview subject — include the exact episode title
3. Episodes doing a deep review of a named ${artist} album — include the exact episode title and album name

RULES:
- Only include episodes you are confident actually exist. Omit anything uncertain.
- Always provide a specific episode title — never "Various episodes" or vague placeholders.
- Include the year of the specific episode (not the show's launch year).
- 5–6 results maximum.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"episodes":[{"show":"Show Name","episode":"Exact episode title","year":2021,"type":"interview","note":"One sentence on why worth listening"}]}
type must be one of: "interview", "review", "documentary", "discussion". Do not fabricate.`,

  print: (artist) =>
    `You are a music research assistant helping a vinyl collector. For ${artist}, return two lists in one JSON response.

BOOKS — up to 5 books by or about ${artist}:
1. Books WRITTEN BY ${artist} (memoirs, essays) — list first, set written_by_artist: true
2. Biographies or critical studies about ${artist}
3. Essential books about the scene ${artist} defined — only if genuinely illuminating
Sort by year ascending within each group. Only include titles you are confident exist.
"type": "biography"|"memoir"|"criticism"|"history"|"fiction"|"reference"

INTERVIEWS — up to 5 notable print/text interviews given by ${artist}:
Sources: Pitchfork, The Wire, The Guardian, NME, MOJO, Rolling Stone, Uncut, The Quietus, Bandcamp Daily, Fact, Resident Advisor, XLR8R, Stereogum, etc.
Text only — no YouTube, podcasts, or audio/video.
Most recent first. Omit "url" unless you are certain of the exact URL.
"domain" is the bare domain (e.g. "pitchfork.com"). "date" is YYYY-MM or YYYY-MM-DD when known.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"books":[{"title":"Book Title","author":"Author Name","year":2003,"type":"memoir","written_by_artist":true,"note":"One sentence"}],"interviews":[{"publication":"Pitchfork","domain":"pitchfork.com","title":"Interview title","year":2019,"date":"2019-03","note":"What makes it worth reading"}]}`,

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
  ? `- Only recommend albums from the COMPLETE CATALOGUE list above. Do not fabricate or suggest albums not on that list.
- SONG TITLE TRAP: The catalogue may include 7" or 12" singles listed as masters. If a title looks like an individual song name rather than an album title, skip it — do not recommend it as a gap.`
  : `- Only recommend albums you are certain ${artist} actually released. Do not fabricate or guess titles.`}
- Studio albums only — no live albums, compilations, or EPs unless they are genuinely essential to the artist's legacy.
- Be selective: flag only albums a serious collector would consider essential gaps, not completionist picks.
- If the collection already covers the essential catalogue, return {"albums":[]}.

For the "why" field: write 1–2 sentences of FACTUAL description only — what the record actually sounds like, who produced it, what instrumentation or approach it uses, how it differs from their other work. No assertions like "essential", "crucial", "pivotal", "defines", "bridges" or other critical boilerplate. Describe the music, not its importance.

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{"albums":[{"title":"Album Title","year":1975,"why":"Factual 1-2 sentence description of the record."}]}
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
      return { data: cached, cached: true };
    }
  }

  // ── Model + token budget ───────────────────────────────────────────────────
  const model     = "claude-haiku-4-5-20251001";
  const maxTokens = MAX_TOKENS[section] ?? 1500;

  // Rankings: cap at 5 for prompt conciseness. Blindspot: pass all owned albums
  // so Claude cannot recommend something the collector already has.
  const promptAlbums = section === "blindspot"
    ? ownedAlbums
    : (section === "rankings" && ownedAlbums?.length)
      ? ownedAlbums.slice(0, 5)
      : ownedAlbums;

  // ── Discogs discography fetch ──────────────────────────────────────────────
  // Used for rankings/blindspot to ground Claude on verified album titles.
  // For podcasts/print we only need a short album list for artist identity
  // disambiguation — read it from the rankings cache to avoid two extra
  // Discogs API calls that would push the function past its timeout.
  let discogsAlbums: DiscogsAlbum[] = [];
  if (section === "rankings" || section === "blindspot") {
    discogsAlbums = await fetchDiscogsDiscography(artist);
    console.log(`[deep-dive] discogs — ${artist}: ${discogsAlbums.length > 0 ? `${discogsAlbums.length} albums` : "unavailable, proceeding without"}`);
  } else if (section === "podcasts" || section === "print") {
    // Prefer rankings cache (already fetched for most artists) over a fresh
    // Discogs call — a handful of titles is enough to disambiguate the artist.
    const rankingsData = await readCache(artist, "rankings");
    if (rankingsData && typeof rankingsData === "object" && Array.isArray((rankingsData as { albums?: unknown }).albums)) {
      discogsAlbums = ((rankingsData as { albums: { title: string; year: number }[] }).albums)
        .map(a => ({ title: a.title, year: a.year }));
    }
  }

  // ── iTunes podcast episode search ──────────────────────────────────────────
  let itunesEpisodes: iTunesEpisode[] = [];
  if (section === "podcasts") {
    itunesEpisodes = await searchItunesPodcasts(artist);
    console.log(`[deep-dive] itunes — ${artist}: ${itunesEpisodes.length} episodes found`);
  }

  // ── Open Library book search + Brave interview search ─────────────────────
  let openLibraryBooks: OpenLibraryBook[] = [];
  let tavilyInterviews: TavilyResult[]   = [];
  if (section === "print") {
    [openLibraryBooks, tavilyInterviews] = await Promise.all([
      searchOpenLibraryBooks(artist),
      searchTavilyInterviews(artist, discogsAlbums),
    ]);
    console.log(`[deep-dive] openlibrary — ${artist}: ${openLibraryBooks.length} books found`);
    console.log(`[deep-dive] tavily — ${artist}: ${tavilyInterviews.length} interview URLs found`);
  }

  const prompt = (section === "podcasts" && itunesEpisodes.length > 0)
    ? buildPodcastsPromptWithItunes(artist, itunesEpisodes, discogsAlbums)
    : section === "print"
      ? buildPrintPromptWithOpenLibrary(artist, openLibraryBooks, discogsAlbums, tavilyInterviews)
      : PROMPTS[section](artist, promptAlbums, discogsAlbums);

  console.log(`[deep-dive] calling ${model} — ${artist}/${section} max_tokens=${maxTokens}`);

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  console.log(`[deep-dive] done — ${artist}/${section} stop_reason=${message.stop_reason} tokens=${message.usage.output_tokens}`);

  // Extract JSON from the response — scan all text blocks and use the first
  // one that contains parseable JSON. This handles two Claude output patterns:
  // 1. Web search: reasoning text first, JSON last → finds it at the end
  // 2. Disambiguation rejection: JSON first, explanation text last → finds it at the start
  const textBlocks = message.content.filter((b) => b.type === "text");

  function tryExtractJson(raw: string): unknown | null {
    const s = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Always extract the outermost {...} block — handles trailing explanation
    // text that Claude appends after the JSON (e.g. when rejecting all results)
    const start = s.indexOf("{");
    const end   = s.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
  }

  let data: unknown = null;
  for (const block of textBlocks) {
    const parsed = tryExtractJson((block as { type: string; text: string }).text ?? "");
    if (parsed !== null) { data = parsed; break; }
  }

  if (data === null) {
    const raw = textBlocks.map(b => (b as { text?: string }).text ?? "").join("\n").slice(0, 400);
    console.error(`[deep-dive] parse error — ${artist}/${section} stop=${message.stop_reason} raw=${raw}`);
    throw new Error("Parse error");
  }

  if (section === "podcasts") stripUnverifiedPodcastUrls(data);

  // ── Cache write (fire-and-forget via after(), 3 s hard timeout) ────────────
  // Same Vercel mid-flight-kill issue as the deep-dive-session tracking below —
  // a bare unawaited call was likely losing the write before it landed.
  // Skipped for empty results so a transient failure can't freeze "No
  // information available" in the shared cache for the full TTL.
  // Cache both populated and confirmed-empty results. Empty results use a short
  // 3-day TTL (via the normal writeCache path) so they get a fresh attempt
  // eventually without regenerating on every single visit.
  if (CACHED_SECTIONS.has(section)) {
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
