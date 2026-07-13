import { type NextRequest, NextResponse } from "next/server";

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

// Strip Last.fm bio noise: HTML, URLs, CC boilerplate, and disambiguation sentences
function cleanLastFmBio(raw: string): string {
  return raw
    .replace(/<a[^>]*>.*?<\/a>/gi, "")   // anchor tags
    .replace(/<[^>]+>/g, "")              // remaining HTML
    .replace(/https?:\/\/\S+/gi, "")      // bare URLs
    .replace(/www\.\S+/gi, "")            // www. fragments
    // Creative Commons boilerplate Last.fm appends to every bio
    .replace(/User-contributed text is available under the Creative Commons By-SA License[^.]*/gi, "")
    // "Read more on Last.fm" trailing link text
    .replace(/Read more (about .+? )?on Last\.fm\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });

  // Fetch Last.fm and Wikipedia in parallel
  const [lfm, wiki] = await Promise.all([fetchLastFm(artist), fetchWikipedia(artist)]);

  if (!lfm && !wiki) {
    return NextResponse.json<ArtistAbout>({ bio: null, formed: null, origin: null, tags: [], listeners: null, plays: null, similar: [], source: "none" });
  }

  // Bio from Wikipedia only — Last.fm bios are user-contributed and frequently
  // contain disambiguation text, raw URLs, and other noise.
  const bio     = wiki?.bio ?? null;
  const formed  = wiki?.formed  ?? null;
  const origin  = wiki?.origin  ?? null;
  const source  = wiki?.bio ? "wikipedia" : lfm?.tags.length ? "lastfm" : "none";

  const result: ArtistAbout = {
    bio,
    formed,
    origin,
    tags:      lfm?.tags      ?? [],
    listeners: lfm?.listeners ?? null,
    plays:     lfm?.plays     ?? null,
    similar:   lfm?.similar   ?? [],
    source:    source as ArtistAbout["source"],
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
  });
}
