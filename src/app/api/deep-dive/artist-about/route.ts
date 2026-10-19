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

// ── Discogs artist details ────────────────────────────────────────────────────
// Primary source for artist identification, profile text, and image.
// Prefers exact name match to avoid resolving "Maybel" → "Mabel McVey" etc.

type DiscogsArtistDetails = {
  id:      number;
  profile: string | null;
  imageUrl: string | null;
  urls:    string[];
  members: string[];
};

async function fetchDiscogsArtistDetails(artistName: string): Promise<DiscogsArtistDetails | null> {
  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
  if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

  try {
    const searchRes = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return null;

    const { results = [] } = await searchRes.json() as {
      results?: { id: number; type: string; title?: string; cover_image?: string; thumb?: string }[];
    };
    const norm = artistName.toLowerCase().trim();
    const hit =
      results.find(r => r.type === "artist" && r.title?.toLowerCase().trim() === norm) ??
      results.find(r => r.type === "artist");
    if (!hit) return null;

    const detailRes = await fetch(
      `https://api.discogs.com/artists/${hit.id}`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!detailRes.ok) return null;

    const detail = await detailRes.json() as {
      profile?: string;
      images?:  { type: string; uri: string; uri150: string }[];
      urls?:    string[];
      members?: { name: string; active?: boolean }[];
    };

    // Use uri150 thumbnail (small, fast) — fall back to search thumb
    const imageUrl =
      detail.images?.find(i => i.type === "primary")?.uri150 ??
      detail.images?.[0]?.uri150 ??
      hit.cover_image ??
      hit.thumb ??
      null;

    // Skip Discogs placeholder grey image
    const cleanImage = imageUrl && !imageUrl.includes("spacer") && imageUrl.length > 30
      ? imageUrl : null;

    return {
      id:       hit.id,
      profile:  detail.profile?.trim() || null,
      imageUrl: cleanImage,
      urls:     detail.urls ?? [],
      members:  (detail.members ?? []).map(m => m.name),
    };
  } catch {
    return null;
  }
}

// ── Tavily web search ─────────────────────────────────────────────────────────

type TavilyHit = { url: string; title: string; content: string };

async function searchTavilyBio(artist: string, albumHint: string, extraUrls: string[]): Promise<TavilyHit[]> {
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

    const seen = new Set<string>(extraUrls);
    const results: TavilyHit[] = [];

    // Include any artist URLs (Bandcamp etc) as direct fetches
    for (const url of extraUrls) {
      if (url.includes("bandcamp.com") || url.includes("soundcloud.com")) {
        try {
          const fr = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: key, query: `site:${url} ${artist}`, max_results: 3, search_depth: "basic" }),
            signal: AbortSignal.timeout(5000),
          });
          if (fr.ok) {
            const fj = await fr.json() as { results?: TavilyHit[] };
            for (const r of fj.results ?? []) {
              if (!seen.has(r.url) && r.content?.length > 50) { seen.add(r.url); results.push(r); }
            }
          }
        } catch { /* non-fatal */ }
      }
    }

    for (const res of [r1, r2]) {
      if (!res.ok) continue;
      const json = await res.json() as { results?: TavilyHit[] };
      for (const r of (json.results ?? [])) {
        if (!seen.has(r.url) && r.content?.length > 50) { seen.add(r.url); results.push(r); }
      }
    }

    return results.slice(0, 14);
  } catch {
    return [];
  }
}

// ── Claude bio generation ─────────────────────────────────────────────────────

async function generateClaudeBio(
  artist: string,
  discogs: DiscogsArtistDetails | null,
  albums: { title: string; year: number }[],
  tavilyHits: TavilyHit[],
): Promise<string | null> {
  const discogsBlock = discogs?.profile
    ? `DISCOGS PROFILE:\n${discogs.profile}\n`
    : "";
  const membersBlock = discogs?.members?.length
    ? `MEMBERS: ${discogs.members.join(", ")}\n`
    : "";
  const discoBlock = albums.length > 0
    ? `DISCOGRAPHY:\n${albums.map(a => `- "${a.title}" (${a.year})`).join("\n")}\n`
    : "";
  const sourcesBlock = tavilyHits.length > 0
    ? `WEB SOURCES (use these facts if clearly relevant; do not invent anything not present):\n${
        tavilyHits.map((r, i) => `${i + 1}. ${r.title}\n${r.content}`).join("\n\n")
      }\n`
    : "";

  const hasAnySources = discogsBlock || discoBlock || sourcesBlock;
  if (!hasAnySources) return null;

  const prompt = `Write a two-paragraph artist biography for ${artist} for a vinyl collector app.

${discogsBlock}${membersBlock}${discoBlock}${sourcesBlock}
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
- CRITICAL: If the sources above do not contain enough verified information to write a factual two-paragraph biography, output exactly the word NO_BIO and nothing else. Do not explain why. Do not ask for more sources. Do not write a partial bio. Just: NO_BIO
- Return only the two paragraphs (or NO_BIO). No preamble, no sign-off, no meta-commentary.`;

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages:   [{ role: "user", content: prompt }],
    });
    const text = msg.content.find(b => b.type === "text")?.text?.trim() ?? null;
    if (!text || text.length < 100) return null;
    if (
      text.startsWith("NO_BIO") ||
      /^I need to clarify/i.test(text) ||
      /^I cannot/i.test(text) ||
      /^I don't have/i.test(text) ||
      /^Without reliable source/i.test(text) ||
      /\bCould you provide sources\b/i.test(text)
    ) return null;
    return text;
  } catch {
    return null;
  }
}

// ── Last.fm — metadata only (tags, listeners, similar) ────────────────────────
// No longer used for bio text; Discogs is the primary source.

type LastFmMeta = {
  tags:      string[];
  listeners: number | null;
  plays:     number | null;
  similar:   string[];
};

async function fetchLastFmMeta(artist: string): Promise<LastFmMeta | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  try {
    // autocorrect=0 — don't silently redirect to a different artist
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist)}&api_key=${key}&format=json&autocorrect=0`;
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json() as {
      artist?: {
        tags?:    { tag?: { name: string }[] };
        stats?:   { listeners?: string; playcount?: string };
        similar?: { artist?: { name: string }[] };
      };
      error?: number;
    };
    if (json.error || !json.artist) return null;
    const a = json.artist;
    return {
      tags:      (a.tags?.tag ?? []).map(t => t.name).filter(Boolean).slice(0, 5),
      listeners: a.stats?.listeners ? parseInt(a.stats.listeners, 10) : null,
      plays:     a.stats?.playcount ? parseInt(a.stats.playcount, 10) : null,
      similar:   (a.similar?.artist ?? []).map(s => s.name).filter(Boolean).slice(0, 5),
    };
  } catch {
    return null;
  }
}

// Curated bios that override everything else for specific artists.
const ARTIST_BIO_OVERRIDES: Record<string, string> = {
  "Julie Byrne": `Julie Byrne grew up in Buffalo listening to her father play fingerstyle guitar and began playing his instrument herself at seventeen. His influence remains central to a style shaped by intricate picking, open tunings and an instinctive use of silence. Across three albums released between 2014 and 2023, Byrne has built a small but remarkably coherent catalogue: intimate without sounding narrowly diaristic, technically assured without calling attention to its difficulty, and patient enough to let a held note or the space around a phrase carry as much weight as the lyric.

Not Even Happiness brought Byrne to a wider audience in 2017. Although voice and fingerpicked guitar remain at its centre, the album is less bare than its reputation suggests, with strings, flute, synthesizer and environmental textures quietly expanding its arrangements. Songs such as "Follow My Voice" and "Natural Blue" move through gradual changes in atmosphere rather than conventional dramatic peaks, turning landscape, solitude and memory into something almost physical.

Six years later, The Greater Wings widened that musical language with piano, harp, synthesizers and orchestral strings. Recording began with Eric Littmann, Byrne's longtime collaborator and the producer of Not Even Happiness, before his death in 2021; Byrne later completed the record with Alex Somers and returning collaborators including Jake Falby. Grief runs through the album, but Byrne has described it more broadly as a love letter to her chosen family and a commitment to their shared future. It is her most expansive record without being her loudest, showing how restraint can hold devotion, loss, renewal and an enormous amount of life.`,
};

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

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });

  // Curated override — highest priority
  const overrideBio = ARTIST_BIO_OVERRIDES[artist];
  if (overrideBio) {
    return NextResponse.json<ArtistAbout>(
      { bio: overrideBio, formed: null, origin: null, tags: [], listeners: null, plays: null, similar: [], source: "none" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } },
    );
  }

  // Fetch Discogs details + Last.fm metadata in parallel
  const [discogs, lfm] = await Promise.all([
    fetchDiscogsArtistDetails(artist),
    fetchLastFmMeta(artist),
  ]);

  // Check bio cache — only skip if we have a fresh cached bio
  const cachedBio = await readBioCache(artist);
  let finalBio: string | null = cachedBio;

  if (!finalBio) {
    // Read albums from rankings cache for discography context
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

    const albumHint  = albums[0]?.title ?? "";
    const tavilyHits = await searchTavilyBio(artist, albumHint, discogs?.urls ?? []);
    const generated  = await generateClaudeBio(artist, discogs, albums, tavilyHits);

    if (generated) {
      finalBio = generated;
      after(() => writeBioCache(artist, generated));
    }
  }

  const result: ArtistAbout = {
    bio:       finalBio,
    formed:    null,
    origin:    null,
    tags:      lfm?.tags      ?? [],
    listeners: lfm?.listeners ?? null,
    plays:     lfm?.plays     ?? null,
    similar:   lfm?.similar   ?? [],
    source:    "none",
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
  });
}
