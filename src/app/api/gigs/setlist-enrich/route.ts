import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MB_UA   = "rekodo/1.0 (https://rekodo.app)";
const CAA_URL = (rgid: string) => `https://coverartarchive.org/release-group/${rgid}/front-250`;
const ID_BATCH = 400;

type Match = { album: string; cover_url: string | null; source: "collection" | "musicbrainz" };
type MatchMap = Record<string, Match | null>;

// Normalise a title for fuzzy comparison: lowercase, strip punctuation/accents
function norm(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’''`]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function mbLookup(title: string, artist: string): Promise<Match | null> {
  const q   = `recording:"${title.replace(/"/g, "")}" AND artist:"${artist.replace(/"/g, "")}"`;
  const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=5`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": MB_UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const recordings: any[] = data.recordings ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!recordings.length || (recordings[0].score ?? 0) < 70) return null;

    // Prefer: Official + Album primary-type + no secondary types (avoids Live, Compilation)
    for (const rec of recordings.slice(0, 3)) {
      for (const rel of (rec.releases ?? [])) {
        const rg = rel["release-group"] ?? {};
        if (
          rg["primary-type"] === "Album" &&
          !(rg["secondary-types"]?.length > 0) &&
          rel.status === "Official"
        ) {
          return { album: rel.title, cover_url: rg.id ? CAA_URL(rg.id) : null, source: "musicbrainz" };
        }
      }
    }

    // Fallback: first release of the best-scoring recording
    const firstRel = recordings[0]?.releases?.[0];
    if (firstRel) {
      const rgid = firstRel["release-group"]?.id as string | undefined;
      return { album: firstRel.title, cover_url: rgid ? CAA_URL(rgid) : null, source: "musicbrainz" };
    }
  } catch {
    // timeout or parse error — treat as no match
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { artist?: string; songs?: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const artist = body.artist?.trim() ?? "";
  const songs  = (body.songs ?? []).map(s => s.trim()).filter(Boolean);
  if (!artist || songs.length === 0) return NextResponse.json({ matches: {} });

  const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── 1. Get all record IDs for this user ──────────────────────────────────────
  const allRecordIds: string[] = [];
  let page = 0;
  while (true) {
    const { data: urRows, error } = await db
      .from("user_records")
      .select("record_id")
      .eq("user_id", user.id)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !urRows?.length) break;
    allRecordIds.push(...urRows.map((r: any) => r.record_id)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (urRows.length < 1000) break;
    page++;
  }

  // ── 2. Fetch matching records for this artist (batched) ──────────────────────
  const collectionMap = new Map<string, { album: string; cover_url: string | null }>();

  if (allRecordIds.length > 0) {
    for (let i = 0; i < allRecordIds.length; i += ID_BATCH) {
      const chunk = allRecordIds.slice(i, i + ID_BATCH);
      const { data: records } = await db
        .from("records")
        .select("album, cover_url, spotify_tracks")
        .in("id", chunk)
        .ilike("artist", artist)
        .not("spotify_tracks", "is", null);

      for (const rec of records ?? []) {
        const tracks = rec.spotify_tracks as Array<{ title: string }> | null;
        for (const track of tracks ?? []) {
          const key = norm(track.title);
          if (!collectionMap.has(key)) {
            collectionMap.set(key, { album: rec.album, cover_url: rec.cover_url ?? null });
          }
        }
      }
    }
  }

  // ── 3. Match each requested song ─────────────────────────────────────────────
  const matches: MatchMap = {};
  const unmatched: string[] = [];

  for (const song of songs) {
    const hit = collectionMap.get(norm(song));
    if (hit) {
      matches[song] = { ...hit, source: "collection" };
    } else {
      matches[song] = null;
      unmatched.push(song);
    }
  }

  // ── 4. MusicBrainz fallback for unmatched songs (sequential, 1.1s gap) ───────
  for (let i = 0; i < unmatched.length; i++) {
    const result = await mbLookup(unmatched[i], artist);
    if (result) matches[unmatched[i]] = result;
    if (i < unmatched.length - 1) await new Promise(r => setTimeout(r, 1100));
  }

  return NextResponse.json({ matches });
}
