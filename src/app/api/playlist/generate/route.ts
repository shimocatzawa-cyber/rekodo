import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyAccessToken, getSpotifySearchCooldownUntil } from "@/lib/spotify";
import { searchAlbum, fetchAlbumTracks } from "@/lib/spotifyMatch";
import { FEELINGS as MOODS } from "@/lib/feelings";
import { checkDailyLimit, isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Don't try to live-match the user's entire backlog just to fill one
// playlist — the background worker already does that, slowly and safely.
// This is a small, bounded, on-demand top-up: only runs when the
// already-matched pool is too thin, only attempts a short Claude-ranked
// shortlist of the most mood-relevant unmatched albums, and stops the
// moment a global cooldown kicks in (same circuit breaker the worker uses).
const SHORTLIST_SIZE = 12;
const MAX_UNMATCHED_POOL_FOR_PROMPT = 300;

// With "include tracks outside my collection" on, the final selection had no
// floor on how many tracks actually come from the collection — Claude was
// sometimes filling the whole playlist with wantlist/discover picks and
// returning zero from the collection itself, defeating the point of "a
// playlist from your collection". This guarantees at least half (rounding up)
// always comes from what the collector actually owns, whenever enough owned
// candidates exist to allow it.
const MIN_COLLECTION_RATIO = 0.5;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type SpotifyTrackJson = { spotify_uri: string; title: string; track_number: number; duration_ms: number; preview_url: string | null };

type Candidate = {
  spotify_uri:  string;
  artist:       string;
  title:        string;
  album:        string;
  year:         number | null;
  cover_url:    string | null;
  duration_ms:  number;
  preview_url:  string | null;
  source:       "collection" | "wantlist" | "discover";
  confidence:   "tagged" | "inferred";
};

type GeneratedTrack = {
  spotify_uri: string;
  artist:      string;
  title:       string;
  album:       string;
  year:        number | null;
  cover_url:   string | null;
  duration_ms: number;
  preview_url: string | null;
  rationale:   string;
  source:      "collection" | "wantlist" | "discover";
};

function flattenCandidates(
  records: Array<{ artist: string; album: string; year?: number | null; cover_url: string | null; spotify_tracks: SpotifyTrackJson[] | null }>,
  source: "collection" | "wantlist" | "discover",
  confidence: "tagged" | "inferred",
): Candidate[] {
  const out: Candidate[] = [];
  for (const r of records) {
    for (const t of r.spotify_tracks ?? []) {
      out.push({
        spotify_uri: t.spotify_uri, artist: r.artist, title: t.title, album: r.album,
        year: r.year ?? null, cover_url: r.cover_url, duration_ms: t.duration_ms,
        preview_url: t.preview_url ?? null, source, confidence,
      });
    }
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Supabase/PostgREST caps unfiltered reads at 1000 rows, and a `.in()` filter
// with thousands of UUIDs crammed into one request URL can fail outright
// (URL too long) — both silently look like "0 rows" if you don't check for
// it. Page past the row cap, and batch large id lists into chunks, the same
// way collection/page.tsx and discogs/import/route.ts already do.
const PAGE_SIZE = 1000;
const ID_BATCH = 400;

async function selectInBatches<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, table: string, select: string, idCol: string, ids: string[], extra?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    let q = db.from(table).select(select).in(idCol, ids.slice(i, i + ID_BATCH));
    if (extra) q = extra(q);
    const { data } = await q;
    if (data) out.push(...(data as T[]));
  }
  return out;
}

type UnmatchedItem = {
  refId:   string;
  table:   "records" | "list_items";
  artist:  string;
  album:   string;
  year:    number | null;
  genre:   string | null;
  feeling: string | null;
  source:  "collection" | "wantlist";
};

// Cheap, Spotify-free ranking pass: ask Claude to pick the most mood-relevant
// albums from the unmatched pool's text metadata alone, before spending a
// single Spotify call. Keeps the live-matching step that follows small.
async function shortlistUnmatched(
  pool: UnmatchedItem[], mood: string, refinement: string,
): Promise<UnmatchedItem[]> {
  const prioritized = pool
    .slice()
    .sort((a, b) => (b.feeling === mood ? 1 : 0) - (a.feeling === mood ? 1 : 0))
    .slice(0, MAX_UNMATCHED_POOL_FOR_PROMPT);

  const listText = prioritized
    .map(p => `${p.refId} :: ${p.artist} — ${p.album}${p.year ? ` (${p.year})` : ""}${p.genre ? `, genre: ${p.genre}` : ""}${p.feeling ? `, tagged feeling: ${p.feeling}` : ""}`)
    .join("\n");

  const userPrompt = [
    `Mood: ${mood}`,
    refinement && `Refinement: ${refinement}`,
    `Pick up to ${SHORTLIST_SIZE} albums most worth checking for this mood.`,
    "",
    "Candidate albums (you may ONLY choose refIds that appear verbatim in this list):",
    listText,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: [{
        type: "text",
        text: `You help shortlist albums from a record collector's catalog before looking them up. Given a mood, an optional refinement constraint, and a list of candidate albums (each with a refId, artist, album, and optionally year/genre/a collector-tagged feeling), pick up to ${SHORTLIST_SIZE} albums most likely to fit the mood well, best fit first. Prefer albums tagged with the matching feeling.`,
        cache_control: { type: "ephemeral" },
      }],
      // Forced tool call instead of asking for raw JSON in prose — a model that
      // prefaces its answer with conversational text ("I need to...") before the
      // JSON object used to crash JSON.parse with "Unexpected token". Tool use
      // guarantees a structured, schema-shaped result instead.
      tools: [{
        name: "shortlist_albums",
        description: "Return the shortlisted refIds, best fit first.",
        input_schema: {
          type: "object",
          properties: { refIds: { type: "array", items: { type: "string" } } },
          required: ["refIds"],
        },
      }],
      tool_choice: { type: "tool", name: "shortlist_albums" },
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content.find(b => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return [];
    const parsed = block.input as { refIds?: string[] };
    const byRefId = new Map(prioritized.map(p => [p.refId, p]));
    const picked: UnmatchedItem[] = [];
    for (const refId of parsed.refIds ?? []) {
      const item = byRefId.get(refId);
      if (item) picked.push(item); // drop anything not in the pool — never trust an invented refId
    }
    return picked.slice(0, SHORTLIST_SIZE);
  } catch {
    return []; // best-effort — fall through to whatever's already matched
  }
}

// Same "outside collection" + style-biased logic as Dig's Discover/Style Dig
// modes, repurposed for the playlist generator: ask Claude for real albums
// the collector doesn't own or want yet, biased toward the styles already in
// their collection, then live-match them on Spotify same as the on-demand
// top-up below.
const DISCOVER_PICKS = 8;

type DiscoveryPick = { artist: string; album: string; year: number | null };

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function discoverOutsideCollection(
  mood: string, refinement: string, ownedArtists: string[], wantlistArtists: string[], styles: string[],
): Promise<DiscoveryPick[]> {
  const ownedBlock = ownedArtists.length > 0
    ? `\nOWNED ARTISTS — never recommend any of these:\n${ownedArtists.join(" · ")}\n`
    : "";
  const wantlistBlock = wantlistArtists.length > 0
    ? `\nWANTLIST ARTISTS — never recommend any of these either (already on their radar):\n${wantlistArtists.join(" · ")}\n`
    : "";
  const stylesBlock = styles.length > 0
    ? `\nSTYLES IN THEIR COLLECTION — bias picks toward these styles or close neighbors, but don't feel limited to them:\n${styles.join(" · ")}\n`
    : "";

  // Random exploration angle, same idea as Dig's Discover/Style modes —
  // without it, repeated calls (different moods, or "Generate" pressed again
  // for the same mood) tend to converge on the same handful of safe, famous
  // picks every time.
  const angleDecade = pick(["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]);
  const angleRegion  = pick([
    "West Africa", "Japan", "Brazil", "Jamaica", "Germany", "Nigeria", "Colombia",
    "South Korea", "Scandinavia", "India", "Turkey", "Eastern Europe", "Caribbean",
    "Indonesia", "Argentina", "Morocco", "Cuba", "Mali", "Iran", "Ghana", "Portugal",
  ]);
  const angleVibe = pick([
    "deeply obscure and rarely discussed even among collectors",
    "critically overlooked on release but reassessed since",
    "a cult classic with a devoted underground following",
    "a regional gem almost unknown outside its home country",
    "a late-career revelation by an artist known for something else entirely",
    "an influential record that shaped a genre without ever becoming famous itself",
    "a record so genre-defying it still has no accurate descriptor",
  ]);
  const angleBlock = `\nEXPLORATION ANGLE — bias at least one or two picks toward: the ${angleDecade}, music originating from ${angleRegion}, and/or a pick that is ${angleVibe}. Resist defaulting to the most famous or obvious records for this mood.\n`;

  const userPrompt = [
    `Mood: ${mood}`,
    refinement && `Refinement: ${refinement}`,
    `Recommend up to ${DISCOVER_PICKS} real studio albums by artists this collector does not yet own and has not wishlisted, that fit the mood and are reasonably likely to be findable on Spotify.`,
    ownedBlock, wantlistBlock, stylesBlock, angleBlock,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: [{
        type: "text",
        text: `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across genres, eras, and territories. Given a mood, a collector's owned and wishlisted artists (to exclude), and the styles already in their collection (to bias toward, without being strictly limited to them), recommend real albums they don't already have that fit the mood. Never invent fictional artists or albums.`,
        cache_control: { type: "ephemeral" },
      }],
      tools: [{
        name: "return_discoveries",
        description: "Return the recommended albums.",
        input_schema: {
          type: "object",
          properties: {
            albums: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  artist: { type: "string" },
                  album:  { type: "string" },
                  year:   { type: "number" },
                },
                required: ["artist", "album"],
              },
            },
          },
          required: ["albums"],
        },
      }],
      tool_choice: { type: "tool", name: "return_discoveries" },
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content.find(b => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return [];
    const parsed = block.input as { albums?: Array<{ artist: string; album: string; year?: number }> };
    return (parsed.albums ?? [])
      .filter(a => a.artist && a.album)
      .slice(0, DISCOVER_PICKS)
      .map(a => ({ artist: a.artist, album: a.album, year: a.year ?? null }));
  } catch {
    return []; // best-effort — generation still proceeds on collection/wantlist candidates
  }
}

// When the explicitly mood-tagged pool is too thin, generation used to widen
// to the ENTIRE untagged matched collection regardless of which mood was
// asked for — so two different moods saw almost the same candidate universe,
// and the final picks converged on the same songs. This filters that bulk
// pool down to what's actually mood-relevant (by artist/album/year/genre —
// no audio, no extra Spotify calls) before it's flattened into per-track
// candidates, so different moods genuinely surface different albums instead
// of relying on chance from the cap's shuffle alone.
const MOOD_RELEVANCE_THRESHOLD = 60; // below this, just include everything — not worth filtering a small pool
const MOOD_RELEVANCE_LIMIT     = 80;

type OwnedAlbumMeta = { id: string; artist: string; album: string; year: number | null; genre: string | null; feeling: string | null };

async function shortlistMoodRelevantAlbums(
  pool: OwnedAlbumMeta[], mood: string, refinement: string,
): Promise<Set<string>> {
  const prioritized = shuffle(pool.slice()).slice(0, MAX_UNMATCHED_POOL_FOR_PROMPT);
  const allIds = new Set(pool.map(p => p.id));

  const listText = prioritized
    .map(p => `${p.id} :: ${p.artist} — ${p.album}${p.year ? ` (${p.year})` : ""}${p.genre ? `, genre: ${p.genre}` : ""}${p.feeling ? `, tagged feeling: ${p.feeling}` : ""}`)
    .join("\n");

  const userPrompt = [
    `Mood: ${mood}`,
    refinement && `Refinement: ${refinement}`,
    `None of these albums are explicitly tagged with the "${mood}" feeling. From artist/album/year/genre alone, pick up to ${MOOD_RELEVANCE_LIMIT} that genuinely plausibly fit this mood — be decisive, most albums in any collection don't fit most moods equally well. If an album is tagged with a different feeling, only include it if it's still a strong fit for this mood too.`,
    "",
    "Candidate albums (you may ONLY choose ids that appear verbatim in this list):",
    listText,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{
        type: "text",
        text: `You help filter a record collector's matched catalog down to the albums most likely to fit a given mood, using only artist/album/year/genre metadata — no audio. Be decisive rather than inclusive.`,
        cache_control: { type: "ephemeral" },
      }],
      tools: [{
        name: "shortlist_mood_relevant",
        description: "Return the ids of mood-relevant albums.",
        input_schema: {
          type: "object",
          properties: { ids: { type: "array", items: { type: "string" } } },
          required: ["ids"],
        },
      }],
      tool_choice: { type: "tool", name: "shortlist_mood_relevant" },
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content.find(b => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return allIds; // fall back to including everything
    const parsed = block.input as { ids?: string[] };
    const picked = (parsed.ids ?? []).filter(id => allIds.has(id)).slice(0, MOOD_RELEVANCE_LIMIT);
    return picked.length > 0 ? new Set(picked) : allIds; // empty/unusable result — don't zero out the pool
  } catch {
    return allIds; // best-effort — fall back to including everything on failure
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Each generation can fire up to 4 Anthropic calls (shortlist, discover,
  // mood-relevance filter, final selection) — cap free usage so a scripted
  // loop can't run up the bill unbounded. Supporters are unlimited.
  const FREE_GENERATE_LIMIT = 2;
  if (!(await isSupporter(supabase, user.id))) {
    const { allowed, used, limit } = await checkDailyLimit(supabase, user.id, "playlist_generate", FREE_GENERATE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: "daily_limit_reached", used, limit }, { status: 429 });
    }
  }

  const body = await request.json().catch(() => ({})) as {
    mood?: string; includeOutsideCollection?: boolean; trackCount?: number; refinement?: string;
  };

  const mood = (body.mood ?? "").toLowerCase().trim();
  if (!MOODS.includes(mood as typeof MOODS[number])) {
    return NextResponse.json({ error: "Invalid mood" }, { status: 400 });
  }
  const trackCount = Math.max(5, Math.min(15, Math.round(body.trackCount ?? 10)));
  const includeOutsideCollection = !!body.includeOutsideCollection;
  const refinement = (body.refinement ?? "").trim().slice(0, 300);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── Owned collection candidates ──────────────────────────────────────────
  const ownedLinks: Array<{ record_id: string; feeling: string | null }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await db
      .from("user_records").select("record_id, feeling").eq("user_id", user.id)
      .range(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    ownedLinks.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const feelingByRecordId = new Map<string, string | null>(
    ownedLinks.map((r) => [r.record_id, r.feeling])
  );
  const ownedRecordIds = [...feelingByRecordId.keys()];

  const ownedMatchedRecords = await selectInBatches<{ id: string; artist: string; album: string; year: number | null; genre: string | null; cover_url: string | null; spotify_tracks: SpotifyTrackJson[] | null }>(
    db, "records", "id, artist, album, year, genre, cover_url, spotify_tracks", "id", ownedRecordIds,
    (q) => q.eq("spotify_matched", true),
  );

  const taggedOwned   = ownedMatchedRecords.filter(r => feelingByRecordId.get(r.id) === mood);
  let untaggedOwned   = ownedMatchedRecords.filter(r => feelingByRecordId.get(r.id) !== mood);

  let candidates: Candidate[] = flattenCandidates(taggedOwned, "collection", "tagged");
  // Tagged pool too thin to fill the requested track count — widen to the
  // full matched collection, marking the rest as lower-confidence inferred.
  if (taggedOwned.length < trackCount) {
    // A large untagged pool gets a cheap text-only mood-relevance pass first —
    // otherwise every thin-tagged mood widens to nearly the same "everything
    // else" superset, and the final picks converge on the same songs
    // regardless of which mood was actually requested.
    if (untaggedOwned.length > MOOD_RELEVANCE_THRESHOLD) {
      const pool: OwnedAlbumMeta[] = untaggedOwned.map(r => ({
        id: r.id, artist: r.artist, album: r.album, year: r.year, genre: r.genre,
        feeling: feelingByRecordId.get(r.id) ?? null,
      }));
      const relevantIds = await shortlistMoodRelevantAlbums(pool, mood, refinement);
      untaggedOwned = untaggedOwned.filter(r => relevantIds.has(r.id));
    }
    candidates = candidates.concat(flattenCandidates(untaggedOwned, "collection", "inferred"));
  }

  // ── Wantlist candidates (optional) ───────────────────────────────────────
  let wantlistId: string | null = null;
  let wantlistRecordIds: string[] = [];
  if (includeOutsideCollection) {
    const { data: wantlist } = await db
      .from("lists").select("id").eq("user_id", user.id).eq("slug", "wantlist").maybeSingle();
    wantlistId = wantlist?.id ?? null;

    if (wantlistId) {
      const { data: recordItems } = await db
        .from("list_items").select("record_id")
        .eq("list_id", wantlistId).eq("item_type", "record").not("record_id", "is", null);
      wantlistRecordIds = (recordItems ?? []).map((r: { record_id: string }) => r.record_id);

      if (wantlistRecordIds.length > 0) {
        const matchedWantlistRecords = await selectInBatches<{ id: string; artist: string; album: string; year: number | null; cover_url: string | null; spotify_tracks: SpotifyTrackJson[] | null }>(
          db, "records", "id, artist, album, year, cover_url, spotify_tracks", "id", wantlistRecordIds,
          (q) => q.eq("spotify_matched", true),
        );
        candidates = candidates.concat(flattenCandidates(matchedWantlistRecords, "wantlist", "inferred"));
      }

      const { data: matchedSongItems } = await db
        .from("list_items").select("song_artist, song_album, song_year, song_cover_url, spotify_tracks")
        .eq("list_id", wantlistId).eq("item_type", "song").eq("spotify_matched", true);
      candidates = candidates.concat(flattenCandidates(
        (matchedSongItems ?? []).map((r: { song_artist: string; song_album: string; song_year: number | null; song_cover_url: string | null; spotify_tracks: SpotifyTrackJson[] | null }) => ({
          artist: r.song_artist, album: r.song_album, year: r.song_year, cover_url: r.song_cover_url, spotify_tracks: r.spotify_tracks,
        })),
        "wantlist", "inferred",
      ));
    }
  }

  // ── Outside-collection discovery (optional) — Dig's "outside collection +
  // styles" logic, repurposed: ask Claude for fresh picks the collector
  // doesn't own or want yet, biased by the styles already in their
  // collection, then live-match them on Spotify ───────────────────────────
  if (includeOutsideCollection && !(await getSpotifySearchCooldownUntil())) {
    const ownedArtistRows = await selectInBatches<{ artist: string; styles: string[] | null }>(
      db, "records", "artist, styles", "id", ownedRecordIds,
    );
    const ownedArtistsAll = [...new Set(ownedArtistRows.map(r => r.artist))];
    const ownedStyles = [...new Set(ownedArtistRows.flatMap(r => r.styles ?? []))].sort();

    const wantlistArtistsAll = new Set<string>();
    if (wantlistRecordIds.length > 0) {
      const wlArtistRows = await selectInBatches<{ artist: string }>(
        db, "records", "artist", "id", wantlistRecordIds,
      );
      for (const r of wlArtistRows) wantlistArtistsAll.add(r.artist);
    }
    if (wantlistId) {
      const { data: wlSongRows } = await db
        .from("list_items").select("song_artist")
        .eq("list_id", wantlistId).eq("item_type", "song");
      for (const r of (wlSongRows ?? []) as Array<{ song_artist: string }>) {
        if (r.song_artist) wantlistArtistsAll.add(r.song_artist);
      }
    }

    const discoveries = await discoverOutsideCollection(
      mood, refinement, ownedArtistsAll, [...wantlistArtistsAll], ownedStyles,
    );

    if (discoveries.length > 0) {
      const token = await getSpotifyAccessToken(db, user.id);
      if (token) {
        for (const d of discoveries) {
          const result = await searchAlbum(token, d.artist, d.album);
          if (result.kind === "blocked") break; // global cooldown just kicked in — stop immediately
          if (result.kind === "transient" || result.kind === "not_found") continue;
          const tracks = await fetchAlbumTracks(token, result.id);
          if (tracks === "blocked") break;
          if (tracks === null) continue; // transient
          candidates = candidates.concat(flattenCandidates(
            [{ artist: d.artist, album: d.album, year: d.year, cover_url: null, spotify_tracks: tracks }],
            "discover", "inferred",
          ));
        }
      }
    }
  }

  // ── On-demand top-up: candidate pool too thin — try a small, bounded live
  // match instead of making the user wait on the background backfill ───────
  // Gate on DISTINCT ARTISTS, not raw track count: the final selection allows
  // only one track per artist, so a pool with plenty of tracks but only a
  // handful of artists (e.g. a few fully-matched albums) was reporting as
  // "thick enough" and skipping the top-up, then consistently truncating the
  // playlist short of the requested track count.
  const MIN_DESIRED = trackCount * 2;
  let distinctArtistCount = new Set(candidates.map(c => c.artist.toLowerCase().trim())).size;
  if ((candidates.length < MIN_DESIRED || distinctArtistCount < trackCount) && !(await getSpotifySearchCooldownUntil())) {
    let unmatchedPool: UnmatchedItem[] = [];

    if (ownedRecordIds.length > 0) {
      const rows = await selectInBatches<{ id: string; artist: string; album: string; year: number | null; genre: string | null }>(
        db, "records", "id, artist, album, year, genre", "id", ownedRecordIds,
        (q) => q.is("spotify_matched_at", null),
      );
      for (const r of rows) {
        unmatchedPool.push({
          refId: r.id, table: "records", artist: r.artist, album: r.album,
          year: r.year, genre: r.genre, feeling: feelingByRecordId.get(r.id) ?? null, source: "collection",
        });
      }
    }

    if (includeOutsideCollection && wantlistRecordIds.length > 0) {
      const rows = await selectInBatches<{ id: string; artist: string; album: string; year: number | null; genre: string | null }>(
        db, "records", "id, artist, album, year, genre", "id", wantlistRecordIds,
        (q) => q.is("spotify_matched_at", null),
      );
      for (const r of rows) {
        unmatchedPool.push({
          refId: r.id, table: "records", artist: r.artist, album: r.album,
          year: r.year, genre: r.genre, feeling: null, source: "wantlist",
        });
      }
    }

    if (includeOutsideCollection && wantlistId) {
      const { data } = await db
        .from("list_items").select("id, song_artist, song_album, song_year")
        .eq("list_id", wantlistId).eq("item_type", "song").is("spotify_matched_at", null);
      for (const r of (data ?? []) as Array<{ id: string; song_artist: string; song_album: string; song_year: number | null }>) {
        unmatchedPool.push({
          refId: r.id, table: "list_items", artist: r.song_artist, album: r.song_album,
          year: r.song_year, genre: null, feeling: null, source: "wantlist",
        });
      }
    }

    // A single fixed-size (12-album) shortlist was a hard ceiling on how many
    // new artists a thin collection could ever surface per generate call —
    // once those 12 ran out (many fail not_found/transient on Spotify), the
    // request just shipped whatever was already matched, which for a
    // lightly-matched collection meant the same handful of tracks every time.
    // Keep shortlisting fresh batches from what's left of the unmatched pool
    // — excluding anything already tried this request — until the pool
    // actually satisfies the requested track count, the pool runs dry, a
    // global cooldown kicks in, or a sane attempt budget is spent (stays well
    // inside the route's 60s ceiling alongside the LLM calls).
    const MAX_TOPUP_ATTEMPTS = 36;
    const MAX_TOPUP_ROUNDS   = 4;
    let topupAttempts = 0;
    let round = 0;
    const token = unmatchedPool.length > 0 ? await getSpotifyAccessToken(db, user.id) : null;

    while (
      token
      && unmatchedPool.length > 0
      && distinctArtistCount < trackCount
      && topupAttempts < MAX_TOPUP_ATTEMPTS
      && round < MAX_TOPUP_ROUNDS
      && !(await getSpotifySearchCooldownUntil())
    ) {
      round++;
      const shortlist = await shortlistUnmatched(unmatchedPool, mood, refinement);
      if (shortlist.length === 0) break; // nothing more worth trying from what's left
      const triedRefIds = new Set<string>();
      let blocked = false;

      for (const item of shortlist) {
        if (topupAttempts >= MAX_TOPUP_ATTEMPTS) break;
        triedRefIds.add(item.refId);
        topupAttempts++;
        const result = await searchAlbum(token, item.artist, item.album);
        if (result.kind === "blocked") { blocked = true; break; } // global cooldown just kicked in — stop immediately
        if (result.kind === "transient") continue; // leave unmatched, background worker will retry
        const now = new Date().toISOString();
        if (result.kind === "not_found") {
          await db.from(item.table).update({ spotify_matched: false, spotify_matched_at: now }).eq("id", item.refId);
          continue;
        }
        const tracks = await fetchAlbumTracks(token, result.id);
        if (tracks === "blocked") { blocked = true; break; }
        if (tracks === null) continue; // transient — leave unmatched
        await db.from(item.table).update({
          spotify_album_id: result.id, spotify_matched: true, spotify_tracks: tracks, spotify_matched_at: now,
        }).eq("id", item.refId);
        candidates = candidates.concat(flattenCandidates(
          [{ artist: item.artist, album: item.album, year: item.year, cover_url: null, spotify_tracks: tracks }],
          item.source, item.feeling === mood ? "tagged" : "inferred",
        ));
      }

      // Drop everything this round tried (matched, not-found, or transient
      // and skipped) so the next round's shortlist only sees genuinely
      // untried items instead of re-picking the same ones again.
      unmatchedPool = unmatchedPool.filter(p => !triedRefIds.has(p.refId));
      distinctArtistCount = new Set(candidates.map(c => c.artist.toLowerCase().trim())).size;
      if (blocked) break;
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No Spotify-matched tracks available yet. Wait for matching to finish, or sync more records." }, { status: 422 });
  }

  // Cap prompt size — tagged/high-confidence first, then a slice of the rest.
  const MAX_CANDIDATES = 150;
  if (candidates.length > MAX_CANDIDATES) {
    const tagged   = candidates.filter(c => c.confidence === "tagged");
    // Discover-sourced candidates were getting silently dropped here: they're
    // appended to the candidate array near the end of the pipeline, after the
    // bulk of the owned/untagged collection — but `rest` preserved that same
    // insertion order and the slice just took the head, so once the untagged
    // collection alone exceeded the cap, none of the "outside my collection"
    // picks ever survived to reach Claude. Always keep them.
    const discover = candidates.filter(c => c.confidence !== "tagged" && c.source === "discover");
    const rest     = candidates.filter(c => c.confidence !== "tagged" && c.source !== "discover");
    // Shuffle the bulk pool instead of always slicing the same deterministic
    // DB-order head — otherwise every mood that falls back to the untagged
    // collection (most moods, once the explicitly-tagged pool is thin) gets
    // fed the exact same first-150 tracks every time, and the final picks
    // converge on the same songs regardless of which mood was requested.
    // This also gives the few freshly top-up-matched tracks mixed into `rest`
    // a fair chance of surviving the cut instead of being reliably excluded.
    candidates = tagged.concat(discover, shuffle(rest)).slice(0, MAX_CANDIDATES);
  }

  const candidateByUri = new Map(candidates.map(c => [c.spotify_uri, c]));

  const candidateListText = candidates
    .map(c => `${c.spotify_uri} :: ${c.artist} — ${c.title} (album: ${c.album}; source: ${c.source}; confidence: ${c.confidence})`)
    .join("\n");

  const minCollectionCount = Math.ceil(trackCount * MIN_COLLECTION_RATIO);
  const collectionCandidateCount = candidates.filter(c => c.source === "collection").length;
  const ratioBlock = includeOutsideCollection && collectionCandidateCount > 0
    ? `\nAt least ${Math.min(minCollectionCount, collectionCandidateCount)} of the ${trackCount} tracks MUST have source "collection" — this is a playlist FROM the collector's own collection first; wantlist and discover picks are a bonus, not a replacement.\n`
    : "";

  const userPrompt = [
    `Mood: ${mood}`,
    refinement && `Refinement: ${refinement}`,
    `Target track count: ${trackCount}`,
    ratioBlock,
    "",
    "Candidate tracks (you may ONLY choose from this exact list, using the exact spotify_uri given):",
    candidateListText,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: [{
        type: "text",
        text: `You are rekōdo's DJ. Given a candidate pool of tracks (each tagged with its confidence — "tagged" means the collector explicitly marked the album with this mood, "inferred" means it's a guess from genre/era/label context — and its source, "collection", "wantlist", or "discover") and a target mood, select exactly the requested number of tracks and sequence them as a coherent DJ set: an arc with an opening, building section, peak, and resolution. Never select more than one track from the same artist — each artist may appear at most once in the playlist, even if the candidate pool is dominated by a few artists; skip an otherwise-good track rather than repeat an artist. Prefer "tagged" tracks over "inferred" ones when there are enough to choose from. If a minimum "collection" track count is specified, treat it as a hard floor, not a target to undercut. Honor any refinement text as a hard constraint (e.g. "skip anything too upbeat" means exclude upbeat-feeling tracks even if otherwise a good mood fit). For each track, write one short rationale (max 20 words) explaining its place in the sequence (e.g. "opens low and slow", "lifts the energy into the peak", "brings it back down to close"). You must only select spotify_uri values that appear verbatim in the candidate list — never invent a track.`,
        cache_control: { type: "ephemeral" },
      }],
      // Forced tool call instead of raw-JSON-in-prose — see shortlistUnmatched
      // above for why: a conversational preamble before the JSON used to crash
      // JSON.parse with "Unexpected token" and surface as a generation error.
      tools: [{
        name: "return_playlist",
        description: "Return the selected, sequenced tracks.",
        input_schema: {
          type: "object",
          properties: {
            tracks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  spotify_uri: { type: "string" },
                  artist:      { type: "string" },
                  title:       { type: "string" },
                  album:       { type: "string" },
                  rationale:   { type: "string" },
                  source:      { type: "string" },
                },
                required: ["spotify_uri", "rationale"],
              },
            },
          },
          required: ["tracks"],
        },
      }],
      tool_choice: { type: "tool", name: "return_playlist" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = msg.content.find(b => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Unexpected response type");
    const parsed = block.input as { tracks: Array<{ spotify_uri: string; rationale: string }> };

    // Trust the candidate pool for metadata (artist/title/album/year/cover/duration) —
    // only take spotify_uri (to look up the candidate) and rationale from Claude's response.
    // Also enforce one-track-per-artist here too — the prompt asks for it, but
    // don't rely on the model alone, same as the spotify_uri hallucination guard.
    const validated: GeneratedTrack[] = [];
    const seenArtists = new Set<string>();
    for (const t of parsed.tracks ?? []) {
      const c = candidateByUri.get(t.spotify_uri);
      if (!c) continue; // hallucinated URI not in the pool — drop silently
      const artistKey = c.artist.toLowerCase().trim();
      if (seenArtists.has(artistKey)) continue; // repeat artist — drop
      seenArtists.add(artistKey);
      validated.push({
        spotify_uri: c.spotify_uri, artist: c.artist, title: c.title, album: c.album,
        year: c.year, cover_url: c.cover_url, duration_ms: c.duration_ms, preview_url: c.preview_url,
        rationale: t.rationale ?? "", source: c.source,
      });
    }

    if (validated.length === 0) {
      return NextResponse.json({ error: "Generation failed — no valid tracks returned." }, { status: 502 });
    }

    // Top up short of the requested count directly from whatever's left in
    // the candidate pool. The model was asked for exactly `trackCount`
    // tracks, but a thin pool — or the model simply under-delivering — used
    // to ship a playlist noticeably shorter than requested with no
    // acknowledgment (e.g. asking for 10 and getting back 3). Prefer tagged
    // confidence and collection source first, same preference order given to
    // the model itself, and never repeat an artist already used.
    if (validated.length < trackCount) {
      const usedArtists = new Set(validated.map(t => t.artist.toLowerCase().trim()));
      const usedUris    = new Set(validated.map(t => t.spotify_uri));
      const sourceOrder: Record<Candidate["source"], number> = { collection: 0, wantlist: 1, discover: 2 };
      const leftover = candidates
        .filter(c => !usedUris.has(c.spotify_uri) && !usedArtists.has(c.artist.toLowerCase().trim()))
        .sort((a, b) => {
          if (a.confidence !== b.confidence) return a.confidence === "tagged" ? -1 : 1;
          return sourceOrder[a.source] - sourceOrder[b.source];
        });
      for (const extra of leftover) {
        if (validated.length >= trackCount) break;
        const artistKey = extra.artist.toLowerCase().trim();
        if (usedArtists.has(artistKey)) continue; // another extra for the same artist already added this pass
        validated.push({
          spotify_uri: extra.spotify_uri, artist: extra.artist, title: extra.title, album: extra.album,
          year: extra.year, cover_url: extra.cover_url, duration_ms: extra.duration_ms, preview_url: extra.preview_url,
          rationale: "fills out the set", source: extra.source,
        });
        usedArtists.add(artistKey);
      }
    }

    // Enforce the inside/outside ratio here too — the prompt asks for a
    // collection floor, but the same "don't rely on the model alone" rule
    // applies as for the artist-dedup above. Swap from the tail first (the
    // resolution end of Claude's sequence) so the deliberately-built opening
    // is disturbed the least; fall back to appending if there's nothing left
    // to swap out.
    if (includeOutsideCollection) {
      const target = Math.min(minCollectionCount, collectionCandidateCount);
      let collectionCount = validated.filter(t => t.source === "collection").length;
      if (collectionCount < target) {
        const usedArtists = new Set(validated.map(t => t.artist.toLowerCase().trim()));
        const usedUris    = new Set(validated.map(t => t.spotify_uri));
        const extraCollection = shuffle(candidates.filter(c =>
          c.source === "collection" && !usedUris.has(c.spotify_uri) && !usedArtists.has(c.artist.toLowerCase().trim())
        ));
        while (collectionCount < target && extraCollection.length > 0) {
          const extra = extraCollection.pop()!;
          const replacement: GeneratedTrack = {
            spotify_uri: extra.spotify_uri, artist: extra.artist, title: extra.title, album: extra.album,
            year: extra.year, cover_url: extra.cover_url, duration_ms: extra.duration_ms, preview_url: extra.preview_url,
            rationale: "from your collection", source: extra.source,
          };
          let swapIdx = -1;
          for (let i = validated.length - 1; i >= 0; i--) {
            if (validated[i].source !== "collection") { swapIdx = i; break; }
          }
          if (swapIdx >= 0) validated[swapIdx] = replacement;
          else validated.push(replacement);
          usedArtists.add(extra.artist.toLowerCase().trim());
          collectionCount++;
        }
      }
    }

    // Never silently ship a degenerate handful of tracks when meaningfully
    // more were asked for — a thin matched pool (or sparse top-up results)
    // used to surface as a valid-looking but tiny "playlist" with no
    // indication anything was short. Surface it as an error instead so the
    // user knows to wait for more matching, try a different mood, or widen
    // the search, rather than wondering why a 10-track request came back
    // with 3.
    const MIN_RESULT_TRACKS = Math.min(trackCount, 5);
    if (validated.length < MIN_RESULT_TRACKS) {
      return NextResponse.json({
        error: `Only ${validated.length} track${validated.length === 1 ? "" : "s"} could be matched on Spotify for "${mood}" right now — try again in a bit while matching continues in the background, pick a different mood, or enable "Include tracks outside my collection".`,
      }, { status: 422 });
    }

    return NextResponse.json({ tracks: validated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate playlist." },
      { status: 502 },
    );
  }
}
