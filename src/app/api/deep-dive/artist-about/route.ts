import { type NextRequest, NextResponse, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const anthropic = new Anthropic();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const BIO_CACHE_TTL_DAYS = 90;

async function readBioCache(artist: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const staleAfter = new Date(Date.now() - BIO_CACHE_TTL_DAYS * 86_400_000).toISOString();
    const { data, error } = await sb
      .from("deep_dive_cache")
      .select("data")
      .eq("artist", artist)
      .eq("section", "about")
      .gt("refreshed_at", staleAfter)
      .maybeSingle();
    if (error || !data) return null;
    return (data.data as { bio?: string } | null)?.bio ?? null;
  } catch {
    return null;
  }
}

async function writeBioCache(artist: string, bio: string): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("deep_dive_cache").upsert(
      { artist, section: "about", data: { bio }, refreshed_at: new Date().toISOString() },
      { onConflict: "artist,section" },
    );
  } catch { /* non-critical */ }
}

type TavilyHit = { url: string; title: string; content: string };

async function searchTavilyBio(artist: string, albumHint: string): Promise<TavilyHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  const EXCLUDE = [
    "spotify.com", "apple.com", "youtube.com", "amazon.com", "discogs.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com", "setlist.fm",
    "genius.com", "bandsintown.com", "songkick.com", "rateyourmusic.com",
  ];

  const q1 = albumHint ? `"${artist}" musician "${albumHint}"` : `"${artist}" musician`;
  const q2 = `"${artist}" interview music`;

  try {
    const [r1, r2] = await Promise.all([
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: q1, max_results: 8, search_depth: "basic", exclude_domains: EXCLUDE }),
        signal: AbortSignal.timeout(6000),
      }),
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: q2, max_results: 8, search_depth: "basic", exclude_domains: EXCLUDE }),
        signal: AbortSignal.timeout(6000),
      }),
    ]);

    const seen = new Set<string>();
    const results: TavilyHit[] = [];
    for (const res of [r1, r2]) {
      if (!res.ok) continue;
      const json = await res.json() as { results?: TavilyHit[] };
      for (const r of (json.results ?? [])) {
        if (!seen.has(r.url) && r.content?.length > 50) {
          seen.add(r.url);
          results.push(r);
        }
      }
    }
    return results.slice(0, 12);
  } catch {
    return [];
  }
}

async function generateClaudeBio(
  artist: string,
  wikiSummary: string | null,
  tags: string[],
  albums: { title: string; year: number }[],
  tavilyHits: TavilyHit[],
): Promise<string | null> {
  const wikiBlock    = wikiSummary ? `WIKIPEDIA SUMMARY:\n${wikiSummary}\n` : "";
  const tagsBlock    = tags.length > 0 ? `GENRES/TAGS: ${tags.join(", ")}\n` : "";
  const discoBlock   = albums.length > 0
    ? `DISCOGRAPHY:\n${albums.map(a => `- "${a.title}" (${a.year})`).join("\n")}\n`
    : "";
  const sourcesBlock = tavilyHits.length > 0
    ? `WEB SOURCES (use these facts if clearly relevant; do not invent anything not present):\n${
        tavilyHits.map((r, i) => `${i + 1}. ${r.title}\n${r.content}`).join("\n\n")
      }\n`
    : "";

  const prompt = `Write a two-paragraph artist biography for ${artist} for a vinyl collector app.

${wikiBlock}${tagsBlock}${discoBlock}${sourcesBlock}
Rules — follow every one exactly:
- Exactly two paragraphs. No third paragraph, no standalone closing sentence, no headers, no bullet points.
- Only include facts that appear in the sources above. Do not invent dates, quotes, or recording locations.
- Proper nouns (names of producers, collaborators, record labels) must appear verbatim in the provided sources. If a name is not explicitly present in the sources, do not include it.
- Be specific: name albums, years, instrumentation, and production details when the sources support it.
- Describe what the music actually sounds like in terms of instrumentation, tempo, and arrangement. Do not describe the artist's qualities (skill, restraint, craft, artistry) — describe the music itself.
- End the second paragraph on a specific musical or biographical detail. Do not end with a summary statement about the artist's overall voice, importance, or emotional power.
- No em dashes (do not use — or –). Use a comma or a full stop instead.
- Do not use any of these words or phrases: tapestry, lush, sonic landscape, journey, captivating, weaves, delves, testament, vibrant, remarkable, intricate, resonate, resonates, groundbreaking, mesmerizing, nuanced, haunting, ethereal, evocative, nestled, genre-defying, boundaries, unique voice, authentic, masterpiece, stands out, pushes boundaries, blurs the lines, wistful, melodicism, emotional truth, considerable, skill and restraint, cuts to the heart, at its core, sonic palette, artistry, craftsmanship.
- Write like a knowledgeable music critic, not a press release.
- Return only the two paragraphs. No preamble, no sign-off.`;

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages:   [{ role: "user", content: prompt }],
    });
    const text = msg.content.find(b => b.type === "text")?.text?.trim() ?? null;
    return text && text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

export interface ArtistAbout {
  bio:       string | null;
  formed:    string | null;
  origin:    string | null;
  tags:      string[];
  listeners: number | null;
  plays:     number | null;
  similar:   string[];
  source:    "lastfm" | "wikipedia" | "none";
}

// Strip Last.fm bio noise and truncate at disambiguation sections
function cleanLastFmBio(raw: string): string {
  // Strip HTML and links first
  let text = raw
    .replace(/<a[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "");

  // Truncate at common Last.fm disambiguation/boilerplate markers
  const cutoffs = [
    /\bThere (?:are|is|was) (?:also|at least|\d)/i,
    /\bThis (?:tag|artist) may also/i,
    /\bUser-contributed text/i,
    /\bRead more (?:about .+? )?on Last\.fm/i,
  ];
  for (const pat of cutoffs) {
    const idx = text.search(pat);
    if (idx > 80) text = text.slice(0, idx); // only cut if there's real content before it
  }

  return text.replace(/\s{2,}/g, " ").trim();
}

async function fetchLastFm(artist: string): Promise<ArtistAbout | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;

  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist)}&api_key=${key}&format=json&autocorrect=1`;
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) return null;

  const json = await res.json() as {
    artist?: {
      bio?: { summary?: string; content?: string };
      tags?: { tag?: { name: string }[] };
      stats?: { listeners?: string; playcount?: string };
      similar?: { artist?: { name: string }[] };
    };
    error?: number;
  };

  if (json.error || !json.artist) return null;

  const a = json.artist;

  // Prefer the full content bio over the summary
  const rawBio = a.bio?.content ?? a.bio?.summary ?? "";
  const bio    = cleanLastFmBio(rawBio);

  // Skip placeholder bios Last.fm uses when there's no real content
  const realBio = bio.length > 80 && !bio.startsWith("There are") ? bio : null;

  const tags = (a.tags?.tag ?? []).map(t => t.name).filter(Boolean).slice(0, 5);
  const similar = (a.similar?.artist ?? []).map(s => s.name).filter(Boolean).slice(0, 5);
  const listeners = a.stats?.listeners ? parseInt(a.stats.listeners, 10) : null;
  const plays     = a.stats?.playcount ? parseInt(a.stats.playcount, 10) : null;

  if (!realBio && tags.length === 0 && listeners === null) return null;

  return { bio: realBio, formed: null, origin: null, tags, listeners, plays, similar, source: "lastfm" };
}

async function fetchWikipedia(artist: string): Promise<{ bio: string; formed: string | null; origin: string | null } | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "rekodo/1.0 (https://rekodo.co)" },
    next:    { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const json = await res.json() as {
    type?:    string;
    extract?: string;
    description?: string;
  };

  // Reject disambiguation pages and non-articles
  if (json.type === "disambiguation" || !json.extract) return null;

  // Only use if it looks like a musician/band article
  const desc = json.description?.toLowerCase() ?? "";
  const extract = json.extract ?? "";
  const musicKeywords = ["band", "musician", "singer", "rapper", "producer", "dj", "artist", "vocalist", "group", "duo", "trio"];
  if (!musicKeywords.some(k => desc.includes(k) || extract.toLowerCase().includes(k))) return null;

  // Extract formed year and origin from the extract heuristically
  const formedMatch = extract.match(/\bformed\b.*?(\b(19|20)\d{2}\b)/i);
  const originMatch = extract.match(/\bfrom\s+([A-Z][A-Za-z\s,]+?)(?:,\s*(?:who|they|is|are|\w{1,4}\s+(?:is|are))|\.|$)/);

  return {
    bio:    extract,
    formed: formedMatch?.[1] ?? null,
    origin: originMatch?.[1]?.trim() ?? null,
  };
}

// Curated bios that override both Last.fm and Wikipedia for specific artists.
const ARTIST_BIO_OVERRIDES: Record<string, string> = {
  "Julie Byrne": `Julie Byrne grew up in Buffalo listening to her father play fingerstyle guitar and began playing his instrument herself at seventeen. His influence remains central to a style shaped by intricate picking, open tunings and an instinctive use of silence. Across three albums released between 2014 and 2023, Byrne has built a small but remarkably coherent catalogue: intimate without sounding narrowly diaristic, technically assured without calling attention to its difficulty, and patient enough to let a held note or the space around a phrase carry as much weight as the lyric.

Not Even Happiness brought Byrne to a wider audience in 2017. Although voice and fingerpicked guitar remain at its centre, the album is less bare than its reputation suggests, with strings, flute, synthesizer and environmental textures quietly expanding its arrangements. Songs such as "Follow My Voice" and "Natural Blue" move through gradual changes in atmosphere rather than conventional dramatic peaks, turning landscape, solitude and memory into something almost physical.

Six years later, The Greater Wings widened that musical language with piano, harp, synthesizers and orchestral strings. Recording began with Eric Littmann, Byrne's longtime collaborator and the producer of Not Even Happiness, before his death in 2021; Byrne later completed the record with Alex Somers and returning collaborators including Jake Falby. Grief runs through the album, but Byrne has described it more broadly as a love letter to her chosen family and a commitment to their shared future. It is her most expansive record without being her loudest, showing how restraint can hold devotion, loss, renewal and an enormous amount of life.`,
};

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });

  const overrideBio = ARTIST_BIO_OVERRIDES[artist];
  if (overrideBio) {
    return NextResponse.json<ArtistAbout>(
      { bio: overrideBio, formed: null, origin: null, tags: [], listeners: null, plays: null, similar: [], source: "none" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } },
    );
  }

  // Fetch Last.fm and Wikipedia in parallel
  const [lfm, wiki] = await Promise.all([fetchLastFm(artist), fetchWikipedia(artist)]);

  const rawBio = wiki?.bio ?? lfm?.bio ?? null;
  const formed = wiki?.formed ?? null;
  const origin = wiki?.origin ?? null;
  const source = wiki?.bio ? "wikipedia" : lfm?.bio ? "lastfm" : lfm?.tags.length ? "lastfm" : "none";

  // When the bio is thin (under 400 chars), enhance it with Claude grounded on
  // Tavily web results. Check the DB cache first so we only generate once per artist.
  let finalBio = rawBio;
  if (!rawBio || rawBio.length < 400) {
    const cachedBio = await readBioCache(artist);
    if (cachedBio) {
      finalBio = cachedBio;
    } else {
      // Read albums from the rankings cache to give Claude discography context
      // without making an extra Discogs API call.
      let albums: { title: string; year: number }[] = [];
      const sb = getSupabase();
      if (sb) {
        try {
          const { data: rankRow } = await sb
            .from("deep_dive_cache")
            .select("data")
            .eq("artist", artist)
            .eq("section", "rankings")
            .maybeSingle();
          const rd = rankRow?.data as { albums?: { title: string; year: number }[] } | null;
          if (Array.isArray(rd?.albums)) albums = rd!.albums;
        } catch { /* non-critical */ }
      }

      const albumHint     = albums[0]?.title ?? "";
      const tavilyHits    = await searchTavilyBio(artist, albumHint);
      const generatedBio  = await generateClaudeBio(artist, rawBio, lfm?.tags ?? [], albums, tavilyHits);

      if (generatedBio) {
        finalBio = generatedBio;
        after(() => writeBioCache(artist, generatedBio));
      }
    }
  }

  if (!finalBio && !lfm) {
    return NextResponse.json<ArtistAbout>({ bio: null, formed: null, origin: null, tags: [], listeners: null, plays: null, similar: [], source: "none" });
  }

  // Suppress "via Wikipedia/Last.fm" attribution when the bio was generated by Claude
  // rather than taken directly from those sources.
  const finalSource = (finalBio && finalBio !== rawBio)
    ? "none"
    : source as ArtistAbout["source"];

  const result: ArtistAbout = {
    bio:       finalBio,
    formed,
    origin,
    tags:      lfm?.tags      ?? [],
    listeners: lfm?.listeners ?? null,
    plays:     lfm?.plays     ?? null,
    similar:   lfm?.similar   ?? [],
    source:    finalSource,
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
  });
}
