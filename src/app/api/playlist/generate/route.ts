import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyAccessToken, getSpotifySearchCooldownUntil } from "@/lib/spotify";
import { searchAlbum, fetchAlbumTracks } from "@/lib/spotifyMatch";
import { FEELINGS as MOODS } from "@/lib/feelings";

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
  source:       "collection" | "wantlist";
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
  source:      "collection" | "wantlist";
};

function flattenCandidates(
  records: Array<{ artist: string; album: string; year?: number | null; cover_url: string | null; spotify_tracks: SpotifyTrackJson[] | null }>,
  source: "collection" | "wantlist",
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
        text: `You help shortlist albums from a record collector's catalog before looking them up. Given a mood, an optional refinement constraint, and a list of candidate albums (each with a refId, artist, album, and optionally year/genre/a collector-tagged feeling), pick up to ${SHORTLIST_SIZE} albums most likely to fit the mood well, best fit first. Prefer albums tagged with the matching feeling. Respond with a raw JSON object (no markdown) with exactly one key "refIds": an array of refId strings, best fit first, copied verbatim from the candidate list.`,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content[0];
    if (block.type !== "text") return [];
    const raw = block.text.trim().replace(/^```(?:json)?\n?|\n?```$/g, "");
    const parsed = JSON.parse(raw) as { refIds?: string[] };
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    mood?: string; includeWantlist?: boolean; trackCount?: number; refinement?: string;
  };

  const mood = (body.mood ?? "").toLowerCase().trim();
  if (!MOODS.includes(mood as typeof MOODS[number])) {
    return NextResponse.json({ error: "Invalid mood" }, { status: 400 });
  }
  const trackCount = Math.max(5, Math.min(15, Math.round(body.trackCount ?? 10)));
  const includeWantlist = !!body.includeWantlist;
  const refinement = (body.refinement ?? "").trim().slice(0, 300);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── Owned collection candidates ──────────────────────────────────────────
  const { data: ownedLinks } = await db
    .from("user_records").select("record_id, feeling").eq("user_id", user.id);

  const feelingByRecordId = new Map<string, string | null>(
    (ownedLinks ?? []).map((r: { record_id: string; feeling: string | null }) => [r.record_id, r.feeling])
  );
  const ownedRecordIds = [...feelingByRecordId.keys()];

  let ownedMatchedRecords: Array<{ id: string; artist: string; album: string; year: number | null; cover_url: string | null; spotify_tracks: SpotifyTrackJson[] | null }> = [];
  if (ownedRecordIds.length > 0) {
    const { data } = await db
      .from("records")
      .select("id, artist, album, year, cover_url, spotify_tracks")
      .in("id", ownedRecordIds)
      .eq("spotify_matched", true);
    ownedMatchedRecords = data ?? [];
  }

  const taggedOwned   = ownedMatchedRecords.filter(r => feelingByRecordId.get(r.id) === mood);
  const untaggedOwned = ownedMatchedRecords.filter(r => feelingByRecordId.get(r.id) !== mood);

  let candidates: Candidate[] = flattenCandidates(taggedOwned, "collection", "tagged");
  // Tagged pool too thin to fill the requested track count — widen to the
  // full matched collection, marking the rest as lower-confidence inferred.
  if (taggedOwned.length < trackCount) {
    candidates = candidates.concat(flattenCandidates(untaggedOwned, "collection", "inferred"));
  }

  // ── Wantlist candidates (optional) ───────────────────────────────────────
  let wantlistId: string | null = null;
  let wantlistRecordIds: string[] = [];
  if (includeWantlist) {
    const { data: wantlist } = await db
      .from("lists").select("id").eq("user_id", user.id).eq("slug", "wantlist").maybeSingle();
    wantlistId = wantlist?.id ?? null;

    if (wantlistId) {
      const { data: recordItems } = await db
        .from("list_items").select("record_id")
        .eq("list_id", wantlistId).eq("item_type", "record").not("record_id", "is", null);
      wantlistRecordIds = (recordItems ?? []).map((r: { record_id: string }) => r.record_id);

      if (wantlistRecordIds.length > 0) {
        const { data: matchedWantlistRecords } = await db
          .from("records").select("id, artist, album, year, cover_url, spotify_tracks")
          .in("id", wantlistRecordIds).eq("spotify_matched", true);
        candidates = candidates.concat(flattenCandidates(matchedWantlistRecords ?? [], "wantlist", "inferred"));
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

  // ── On-demand top-up: candidate pool too thin — try a small, bounded live
  // match instead of making the user wait on the background backfill ───────
  const MIN_DESIRED = trackCount * 2;
  if (candidates.length < MIN_DESIRED && !(await getSpotifySearchCooldownUntil())) {
    const unmatchedPool: UnmatchedItem[] = [];

    if (ownedRecordIds.length > 0) {
      const { data } = await db
        .from("records").select("id, artist, album, year, genre")
        .in("id", ownedRecordIds).is("spotify_matched_at", null);
      for (const r of (data ?? []) as Array<{ id: string; artist: string; album: string; year: number | null; genre: string | null }>) {
        unmatchedPool.push({
          refId: r.id, table: "records", artist: r.artist, album: r.album,
          year: r.year, genre: r.genre, feeling: feelingByRecordId.get(r.id) ?? null, source: "collection",
        });
      }
    }

    if (includeWantlist && wantlistRecordIds.length > 0) {
      const { data } = await db
        .from("records").select("id, artist, album, year, genre")
        .in("id", wantlistRecordIds).is("spotify_matched_at", null);
      for (const r of (data ?? []) as Array<{ id: string; artist: string; album: string; year: number | null; genre: string | null }>) {
        unmatchedPool.push({
          refId: r.id, table: "records", artist: r.artist, album: r.album,
          year: r.year, genre: r.genre, feeling: null, source: "wantlist",
        });
      }
    }

    if (includeWantlist && wantlistId) {
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

    if (unmatchedPool.length > 0) {
      const shortlist = await shortlistUnmatched(unmatchedPool, mood, refinement);
      if (shortlist.length > 0) {
        const token = await getSpotifyAccessToken(db, user.id);
        if (token) {
          for (const item of shortlist) {
            const result = await searchAlbum(token, item.artist, item.album);
            if (result.kind === "blocked") break; // global cooldown just kicked in — stop immediately
            if (result.kind === "transient") continue; // leave unmatched, background worker will retry
            const now = new Date().toISOString();
            if (result.kind === "not_found") {
              await db.from(item.table).update({ spotify_matched: false, spotify_matched_at: now }).eq("id", item.refId);
              continue;
            }
            const tracks = await fetchAlbumTracks(token, result.id);
            if (tracks === "blocked") break;
            if (tracks === null) continue; // transient — leave unmatched
            await db.from(item.table).update({
              spotify_album_id: result.id, spotify_matched: true, spotify_tracks: tracks, spotify_matched_at: now,
            }).eq("id", item.refId);
            candidates = candidates.concat(flattenCandidates(
              [{ artist: item.artist, album: item.album, year: item.year, cover_url: null, spotify_tracks: tracks }],
              item.source, item.feeling === mood ? "tagged" : "inferred",
            ));
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No Spotify-matched tracks available yet. Wait for matching to finish, or sync more records." }, { status: 422 });
  }

  // Cap prompt size — tagged/high-confidence first, then a slice of the rest.
  const MAX_CANDIDATES = 150;
  if (candidates.length > MAX_CANDIDATES) {
    const tagged = candidates.filter(c => c.confidence === "tagged");
    const rest   = candidates.filter(c => c.confidence !== "tagged");
    candidates = tagged.concat(rest).slice(0, MAX_CANDIDATES);
  }

  const candidateByUri = new Map(candidates.map(c => [c.spotify_uri, c]));

  const candidateListText = candidates
    .map(c => `${c.spotify_uri} :: ${c.artist} — ${c.title} (album: ${c.album}; source: ${c.source}; confidence: ${c.confidence})`)
    .join("\n");

  const userPrompt = [
    `Mood: ${mood}`,
    refinement && `Refinement: ${refinement}`,
    `Target track count: ${trackCount}`,
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
        text: `You are rekōdo's DJ. Given a candidate pool of tracks (each tagged with its confidence — "tagged" means the collector explicitly marked the album with this mood, "inferred" means it's a guess from genre/era/label context) and a target mood, select exactly the requested number of tracks and sequence them as a coherent DJ set: an arc with an opening, building section, peak, and resolution. Prefer "tagged" tracks over "inferred" ones when there are enough to choose from. Honor any refinement text as a hard constraint (e.g. "skip anything too upbeat" means exclude upbeat-feeling tracks even if otherwise a good mood fit). For each track, write one short rationale (max 20 words) explaining its place in the sequence (e.g. "opens low and slow", "lifts the energy into the peak", "brings it back down to close"). You must only select spotify_uri values that appear verbatim in the candidate list — never invent a track. Respond with a raw JSON object (no markdown, no code block) with exactly one key "tracks": an array of objects with keys "spotify_uri", "artist", "title", "album", "rationale", "source" (copy source verbatim from the candidate's source field), in final sequence order.`,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    const raw = block.text.trim().replace(/^```(?:json)?\n?|\n?```$/g, "");
    const parsed = JSON.parse(raw) as { tracks: Array<{ spotify_uri: string; rationale: string }> };

    // Trust the candidate pool for metadata (artist/title/album/year/cover/duration) —
    // only take spotify_uri (to look up the candidate) and rationale from Claude's response.
    const validated: GeneratedTrack[] = [];
    for (const t of parsed.tracks ?? []) {
      const c = candidateByUri.get(t.spotify_uri);
      if (!c) continue; // hallucinated URI not in the pool — drop silently
      validated.push({
        spotify_uri: c.spotify_uri, artist: c.artist, title: c.title, album: c.album,
        year: c.year, cover_url: c.cover_url, duration_ms: c.duration_ms, preview_url: c.preview_url,
        rationale: t.rationale ?? "", source: c.source,
      });
    }

    if (validated.length === 0) {
      return NextResponse.json({ error: "Generation failed — no valid tracks returned." }, { status: 502 });
    }

    return NextResponse.json({ tracks: validated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate playlist." },
      { status: 502 },
    );
  }
}
