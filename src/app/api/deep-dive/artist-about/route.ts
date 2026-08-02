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

  if (!lfm && !wiki) {
    return NextResponse.json<ArtistAbout>({ bio: null, formed: null, origin: null, tags: [], listeners: null, plays: null, similar: [], source: "none" });
  }

  // Prefer Wikipedia bio (editorial quality); fall back to cleaned Last.fm bio
  // only when Wikipedia has no article (e.g. disambiguation pages, obscure artists).
  const bio     = wiki?.bio ?? lfm?.bio ?? null;
  const formed  = wiki?.formed  ?? null;
  const origin  = wiki?.origin  ?? null;
  const source  = wiki?.bio ? "wikipedia" : lfm?.bio ? "lastfm" : lfm?.tags.length ? "lastfm" : "none";

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
