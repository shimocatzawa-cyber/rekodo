import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { isPlausibleArtistMatch, isPlausibleAlbumMatch } from "@/lib/textMatch";

export const dynamic = "force-dynamic";

const BATCH = 400;
// Max records sent to Claude as a taste signal. The full artist list is always
// sent separately for exclusion — this cap only applies to the album-level lines.
const TASTE_SAMPLE = 600;

// Fisher-Yates shuffle + slice — preserves genre proportions approximately.
function sampleRecords<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, max);
}

// Discogs release search results are formatted "Artist - Title" — split on
// the first " - " to compare each side separately rather than as one blob.
function parseDiscogsTitle(title: string): { artist: string; album: string } {
  const idx = title.indexOf(" - ");
  if (idx === -1) return { artist: title, album: title };
  return { artist: title.slice(0, idx), album: title.slice(idx + 3) };
}

// Existence check against Discogs, mirroring the pattern already used for
// book recommendations (library/recommendations/route.ts + Open Library):
// an LLM asked for "deeply obscure" picks will occasionally hallucinate an
// artist/album that doesn't exist, and obscurity is exactly where that's
// hardest to catch by eye. Fails CLOSED (treats errors/no-match the same as
// "couldn't verify, drop it") — same choice made for the book pattern, and
// the 5-candidate buffer this is filtering already exists to absorb losses
// like this without shortchanging the final 3 shown.
async function verifyOnDiscogs(artist: string, album: string): Promise<boolean> {
  const key = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) return true; // integration not configured — don't block on it

  try {
    const url = new URL("https://api.discogs.com/database/search");
    url.searchParams.set("q", `${artist} ${album}`);
    url.searchParams.set("type", "release");
    url.searchParams.set("per_page", "10");
    url.searchParams.set("key", key);
    url.searchParams.set("secret", secret);

    const res = await fetch(url.toString(), { headers: { "User-Agent": "rekodo/1.0" } });
    if (!res.ok) return true; // rate-limited or server error — can't verify, don't drop the pick

    const data = await res.json() as { results?: Array<{ title: string }> };
    const results = data.results ?? [];
    return results.some(r => {
      const { artist: ra, album: rt } = parseDiscogsTitle(r.title);
      return isPlausibleAlbumMatch(artist, album, [ra], rt);
    });
  } catch {
    return true;
  }
}

const JSON_SCHEMA = `[
  {
    "artist": "string",
    "album": "string",
    "year": number or null,
    "genre": "string — the single primary genre/style tag for this pick",
    "region": "string — the country or region this artist/record originates from",
    "sub_style": "string or null — STYLE DIG ONLY: the specific scene/niche within the chosen style this pick belongs to (e.g. 'ragga jungle' within 'Jungle', 'slowcore' within 'Indie Rock'). Omit/null for other modes.",
    "reason": "string",
    "bandcamp_search_url": "https://bandcamp.com/search?q=ENCODED_QUERY",
    "spotify_search_url": "https://open.spotify.com/search/ENCODED_QUERY",
    "apple_music_search_url": "https://music.apple.com/search?term=ENCODED_QUERY"
  }
]

For the search URLs, encode "artist album" as the query (URL-encode spaces and special characters).`;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const isJa = locale === "ja";

  const body = await request.json().catch(() => ({}));
  const mode: "discover" | "explore" | "style" =
    body.mode === "explore" ? "explore" : body.mode === "style" ? "style" : "discover";

  const style: string = typeof body.style === "string" ? body.style.trim().slice(0, 80) : "";
  if (mode === "style" && !style) {
    return Response.json({ error: "Style is required for Style Dig" }, { status: 400 });
  }

  // Artists and full recs shown in earlier digs this session — hard-exclude to prevent repetition
  const previousArtists: string[] = Array.isArray(body.previousArtists) ? body.previousArtists : [];
  const previousRecommendations: Array<{ artist: string; album: string }> =
    Array.isArray(body.previousRecommendations) ? body.previousRecommendations : [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // ── Supporter check + daily rate limit ───────────────────────────────────
  const FREE_DIG_LIMIT = 3;
  const { data: profileRow } = await (supabase as any)
    .from("profiles")
    .select("is_supporter")
    .eq("id", user.id)
    .maybeSingle() as { data: { is_supporter: boolean | null } | null };
  const isSupporter = !!profileRow?.is_supporter;

  if (!isSupporter) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: countRow } = await (supabase as any)
      .from("dig_daily_count")
      .select("count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle() as { data: { count: number } | null };
    const used = countRow?.count ?? 0;
    if (used >= FREE_DIG_LIMIT) {
      return Response.json({ error: "daily_limit_reached", used, limit: FREE_DIG_LIMIT }, { status: 429 });
    }
  }

  // ── Fetch collection ──────────────────────────────────────────────────────
  // Paginate to avoid the PostgREST 1000-row default cap on large collections.
  const allLinks: { record_id: string }[] = [];
  let linkPage = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("user_records")
      .select("record_id")
      .eq("user_id", user.id)
      .range(linkPage * BATCH, (linkPage + 1) * BATCH - 1);
    if (!batch || batch.length === 0) break;
    allLinks.push(...batch);
    if (batch.length < BATCH) break;
    linkPage++;
  }

  const recordIds = allLinks.map((l) => l.record_id);

  type RecordRow = { id: string; artist: string; album: string; year: number | null; genre: string | null; styles: string[] | null; label: string | null; format: string | null; country: string | null; producers: string[] | null };
  // Parallelise all metadata batches — turns 31 sequential calls into concurrent ones.
  const metaBatches = await Promise.all(
    Array.from({ length: Math.ceil(recordIds.length / BATCH) }, (_, i) =>
      supabase
        .from("records")
        .select("id, artist, album, year, genre, styles, label, format, country, producers")
        .in("id", recordIds.slice(i * BATCH, (i + 1) * BATCH))
    )
  );
  const collectionMap = new Map<string, RecordRow>();
  for (const { data } of metaBatches) {
    for (const r of data ?? []) collectionMap.set(r.id, r as RecordRow);
  }
  const collection = recordIds
    .map((id) => collectionMap.get(id))
    .filter((r): r is RecordRow => r !== undefined);

  // ── Quiz fallback (no collection synced yet) ─────────────────────────────
  if (collection.length === 0 && mode === "discover") {
    const { data: quizRow } = await (supabase as any)
      .from("user_quiz_profile")
      .select("top5_releases, mood_context, depth_breadth")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .maybeSingle() as { data: { top5_releases: Array<{ artist: string; album: string; year?: number }> | null; mood_context: string | null; depth_breadth: string | null } | null };

    if (quizRow) {
      const picks = (quizRow.top5_releases ?? []).filter(r => r.artist && r.album);
      const picksBlock = picks.length > 0
        ? picks.map(r => `- ${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}`).join("\n")
        : "(No specific albums listed)";

      const moodLabel: Record<string, string> = {
        energised: "Energised & social", introspective: "Introspective & late night",
        background: "Background & ambient", shifting: "Shifting — it depends",
      };
      const depthLabel: Record<string, string> = {
        deep: "Deep into one artist at a time", wide: "Wide across many styles",
        scene: "Following a scene or movement", surprise: "Whatever surprises me",
      };

      const quizPrompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

A new collector has shared their favourite albums and how they listen. Use this to infer their taste and recommend 3 records they would love — albums to seek out as first vinyl purchases.

THEIR FAVOURITE ALBUMS:
${picksBlock}

LISTENING MOOD: ${moodLabel[quizRow.mood_context ?? ""] ?? quizRow.mood_context ?? "Not specified"}
EXPLORATION STYLE: ${depthLabel[quizRow.depth_breadth ?? ""] ?? quizRow.depth_breadth ?? "Not specified"}

Rules:
- Recommend 3 records by 3 different artists that follow naturally from their declared taste
- If they listed specific albums, reference the aesthetic logic — explain the connection explicitly
- Prioritise records that are readily available on vinyl (original pressings, reissues, secondhand)
- Each reason must explain WHY this is a perfect first purchase for someone with this taste profile — speak to texture, mood, and aesthetic territory. Maximum 2 sentences.
- Do not default to the most famous records in any genre — find the records that will genuinely surprise and delight
- Only recommend a record you are confident actually exists and was released under that exact artist/album name — if you are not sure, do not include it.
${isJa ? "- Write all reason text in Japanese (日本語).\n" : ""}
Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;

      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: quizPrompt }],
        });
        const content = message.content[0];
        if (content.type !== "text") return Response.json({ error: "Unexpected response from AI" }, { status: 500 });
        const stripped = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
        const start = stripped.indexOf("[");
        const end = stripped.lastIndexOf("]");
        const raw = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;
        const recommendations = JSON.parse(raw);
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
        }
        const today = new Date().toISOString().slice(0, 10);
        // after() keeps the function alive until this completes — a bare
        // unawaited rpc() call gets killed mid-flight as soon as the response
        // below is sent, which is why dig counts weren't landing.
        after(() => (supabase as any).rpc("increment_dig_count", { p_user_id: user.id, p_date: today, p_mode: mode }));
        return Response.json({ recommendations, quiz: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return Response.json({ error: `AI error: ${msg}` }, { status: 500 });
      }
    }
  }

  // ── Fetch top-5 lists and items ───────────────────────────────────────────
  const { data: listsRaw } = await supabase
    .from("lists")
    .select("id, title, list_type")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const top5Lists = (listsRaw ?? []).filter((l) => !l.list_type || l.list_type === "top5");

  type ListWithItems = { title: string; items: string[] };
  const listsForPrompt: ListWithItems[] = [];

  if (top5Lists.length > 0) {
    const listIds = top5Lists.map((l) => l.id);
    const { data: itemsRaw } = await supabase
      .from("list_items")
      .select("list_id, record_id")
      .in("list_id", listIds);

    const itemRecordIds = [
      ...new Set((itemsRaw ?? []).map((i) => i.record_id).filter(Boolean)),
    ] as string[];

    type ItemRecordRow = { id: string; artist: string; album: string; year: number | null };
    const itemRecordMap = new Map<string, ItemRecordRow>();
    for (let i = 0; i < itemRecordIds.length; i += BATCH) {
      const { data } = await supabase
        .from("records")
        .select("id, artist, album, year")
        .in("id", itemRecordIds.slice(i, i + BATCH));
      for (const r of data ?? []) itemRecordMap.set(r.id, r as ItemRecordRow);
    }

    for (const list of top5Lists) {
      const items = (itemsRaw ?? [])
        .filter((i) => i.list_id === list.id && i.record_id)
        .map((i) => {
          const r = itemRecordMap.get(i.record_id!);
          return r ? `${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}` : null;
        })
        .filter((s): s is string => s !== null);
      if (items.length > 0) listsForPrompt.push({ title: list.title, items });
    }
  }

  // ── Fetch wantlist albums for exclusion ──────────────────────────────────
  const wantlistAlbums: string[] = [];
  {
    const { data: wlRow } = await supabase
      .from("lists")
      .select("id")
      .eq("user_id", user.id)
      .in("slug", ["wantlist", "want-to-buy"])
      .maybeSingle();

    if (wlRow) {
      const wlItems: { record_id: string | null; song_artist: string | null; song_album: string | null }[] = [];
      let wlPage = 0;
      while (true) {
        const { data: wlBatch } = await supabase
          .from("list_items")
          .select("record_id, song_artist, song_album")
          .eq("list_id", wlRow.id)
          .range(wlPage * BATCH, (wlPage + 1) * BATCH - 1);
        if (!wlBatch || wlBatch.length === 0) break;
        wlItems.push(...wlBatch);
        if (wlBatch.length < BATCH) break;
        wlPage++;
      }

      const wlRecordIds = wlItems.map(i => i.record_id).filter(Boolean) as string[];

      // Songs added directly (no record_id)
      for (const i of wlItems ?? []) {
        if (!i.record_id && i.song_artist && i.song_album) {
          wantlistAlbums.push(`${i.song_artist} — ${i.song_album}`);
        }
      }

      for (let i = 0; i < wlRecordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("artist, album")
          .in("id", wlRecordIds.slice(i, i + BATCH));
        for (const r of data ?? []) wantlistAlbums.push(`${r.artist} — ${r.album}`);
      }
    }
  }

  // ── Fetch persistent dig history (stops repeats across sessions/devices —
  // the in-memory session list alone is wiped on every refresh) ─────────────
  type HistoryRow = {
    artist: string; album: string; mode: string;
    genre: string | null; region: string | null; sub_style: string | null;
    style: string | null; angle: string | null;
    wantlisted_at: string | null; collected_at: string | null; dismissed_at: string | null;
    created_at: string;
  };
  const { data: historyRows } = await (supabase as any)
    .from("dig_history")
    .select("artist, album, mode, genre, region, sub_style, style, angle, wantlisted_at, collected_at, dismissed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(150) as { data: HistoryRow[] | null };
  const history = historyRows ?? [];

  // Artist/album hard-exclusion uses the FULL history regardless of age —
  // a repeat is a repeat no matter how long ago it was shown.
  const allPrevArtists = [...new Set([...previousArtists, ...history.map((h) => h.artist)])];
  const allPrevRecsMap = new Map<string, { artist: string; album: string }>();
  for (const r of [...previousRecommendations, ...history]) {
    if (r.artist && r.album) allPrevRecsMap.set(`${r.artist} ${r.album}`, r);
  }
  const allPrevRecs = [...allPrevRecsMap.values()];

  // The most recent angle used (any mode) — avoid repeating it immediately so
  // the same flavour-text phrasing doesn't visibly recur dig after dig.
  const lastAngle = history.find(h => h.angle)?.angle ?? null;

  // ── Feedback signal from past digs: what they acted on (wantlisted or later
  // bought) vs. what they've seen repeatedly — or explicitly dismissed — and
  // never touched. Scoped to the last 60 days so a stale signal from months
  // ago doesn't permanently suppress a genre/style the collector's taste has
  // since moved past.
  const FATIGUE_WINDOW_DAYS = 60;
  const fatigueCutoff = new Date(Date.now() - FATIGUE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentHistory = history.filter(h => h.created_at >= fatigueCutoff);

  function tally(rows: HistoryRow[], key: "genre" | "region" | "sub_style") {
    const counts = new Map<string, { shown: number; accepted: number; dismissed: number }>();
    for (const r of rows) {
      const val = r[key];
      if (!val) continue;
      const entry = counts.get(val) ?? { shown: 0, accepted: 0, dismissed: 0 };
      entry.shown += 1;
      if (r.wantlisted_at || r.collected_at) entry.accepted += 1;
      if (r.dismissed_at) entry.dismissed += 1;
      counts.set(val, entry);
    }
    return counts;
  }
  const accepted = (counts: Map<string, { shown: number; accepted: number; dismissed: number }>) =>
    [...counts.entries()].filter(([, v]) => v.accepted > 0).map(([k]) => k);
  // Fatigued: 3+ ignored impressions with no action, OR a single explicit
  // "not for me" — a direct dismissal is a stronger, faster-converging
  // signal than waiting out three passive non-actions.
  const fatigued = (counts: Map<string, { shown: number; accepted: number; dismissed: number }>) =>
    [...counts.entries()].filter(([, v]) => v.accepted === 0 && (v.shown >= 3 || v.dismissed >= 1)).map(([k]) => k);

  // Genre/region fatigue: DISCOVER-mode signal only. Style Dig is opt-in by
  // definition — the collector chose that genre on purpose, so mixing its
  // impressions into this tally would wrongly read "asked for this 5 times"
  // as "ignored this 5 times" and suppress it in Discover too.
  const discoverHistory = recentHistory.filter(h => h.mode === "discover");
  const genreCounts  = tally(discoverHistory, "genre");
  const regionCounts = tally(discoverHistory, "region");
  const acceptedGenres  = accepted(genreCounts);
  const fatiguedGenres  = fatigued(genreCounts);
  const acceptedRegions = accepted(regionCounts);
  const fatiguedRegions = fatigued(regionCounts);

  // Sub-style fatigue: STYLE-mode signal only, scoped to the style being dug
  // right now — a "Lo-fi" sub-style fatigue signal from a past Hip Hop style
  // dig shouldn't suppress an unrelated "Lo-fi" corner of a Bedroom Pop dig.
  const sameStyleHistory = recentHistory.filter(h => h.mode === "style" && h.style === style);
  const subStyleCounts    = tally(sameStyleHistory, "sub_style");
  const fatiguedSubStyles = fatigued(subStyleCounts);

  const feedbackBlock = (acceptedGenres.length || fatiguedGenres.length || acceptedRegions.length || fatiguedRegions.length)
    ? `\nFEEDBACK FROM PAST DIGS — this collector's real behaviour, weight it more than guesswork:\n${
        acceptedGenres.length ? `- They've wantlisted or bought past picks in: ${acceptedGenres.join(", ")}. Lean toward more of this when it genuinely fits the brief.\n` : ""
      }${
        fatiguedGenres.length ? `- They've been shown repeated picks in ${fatiguedGenres.join(", ")} without acting on any (or said "not for me") — ease off this territory unless something truly exceptional warrants it.\n` : ""
      }${
        acceptedRegions.length ? `- Regions they've responded to: ${acceptedRegions.join(", ")}.\n` : ""
      }${
        fatiguedRegions.length ? `- Regions shown repeatedly with no action: ${fatiguedRegions.join(", ")} — deprioritise these.\n` : ""
      }`
    : "";

  const subStyleFeedbackBlock = fatiguedSubStyles.length > 0
    ? `\nWithin "${style}", these specific corners have been shown repeatedly with no action (or were marked "not for me"): ${fatiguedSubStyles.join(", ")} — surface a genuinely different sub-style/scene within "${style}" instead.\n`
    : "";

  // ── Build prompt ──────────────────────────────────────────────────────────
  const listsLines = listsForPrompt.length > 0
    ? listsForPrompt
        .map((l) => `${l.title}:\n${l.items.map((item) => `  • ${item}`).join("\n")}`)
        .join("\n\n")
    : "(No Top 5 lists filled in yet)";

  const wantlistBlock = wantlistAlbums.length > 0
    ? `\nWANTLIST — do NOT recommend any of these (already on their radar):\n${wantlistAlbums.join("\n")}\n`
    : "";

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  // Avoid immediately repeating the same flavour-text angle dig after dig —
  // falls back to the full pool if avoiding it would leave nothing to pick.
  function pickAvoiding<T>(arr: T[], avoid: T | null): T {
    const filtered = avoid ? arr.filter(x => x !== avoid) : arr;
    return pick(filtered.length > 0 ? filtered : arr);
  }

  let prompt: string;
  // Captured from whichever branch runs below so the persistence step can
  // record which angle was used this dig, regardless of mode.
  let digAngleUsed: string | null = null;

  if (mode === "discover") {
    const ownedArtists = [...new Set(collection.map((r) => r.artist))].sort();
    const artistsBlock = ownedArtists.length > 0
      ? `\nOWNED ARTISTS — you must not recommend any record by any of these artists:\n${ownedArtists.join(" · ")}\n`
      : "";

    const prevBlock = allPrevArtists.length > 0
      ? `\nALREADY RECOMMENDED — do not repeat any of these artists (user has already seen them, possibly in an earlier session):\n${allPrevArtists.join(" · ")}\n`
      : "";

    // Random exploration angle — forces era variety on every call, but
    // obscurity/region are only an occasional spice (~40-50% of calls),
    // not a mandate stacked onto all three picks every single time.
    const digDecadeClassic = pick([
      "1950s", "1960s", "early 1970s", "late 1970s",
      "1980s", "early 1990s", "late 1990s", "2000s",
    ]);
    const digDecadeModern = pick(["2010s", "2020s"]);
    const digRegion = Math.random() < 0.4
      ? pick([
          "West Africa", "Japan", "Brazil", "Jamaica", "Germany", "Nigeria", "Colombia",
          "South Korea", "Scandinavia", "India", "Turkey", "Eastern Europe", "Caribbean",
          "Indonesia", "Argentina", "Morocco", "Cuba", "Mali", "Iran", "Ghana", "Portugal",
          "United States", "United Kingdom", "France", "Italy", "Canada", "Australia",
        ])
      : null;
    const digAngle = pickAvoiding(
      Math.random() < 0.5
        ? [
            "deeply obscure and rarely discussed even among collectors",
            "critically overlooked on release but reassessed since",
            "a cult classic with a devoted underground following",
            "a regional gem almost unknown outside its home country",
            "a one-album wonder that was never followed up",
            "a collaborative or side-project record that outshines the artists' main work",
          ]
        : [
            "a widely loved, critically acclaimed record this collector has somehow never picked up",
            "a record that turns up on every credible 'best albums' list, and earns its place there",
            "a famous record from a genre adjacent to their taste they've likely just never gotten around to",
            "a defining record by an artist they already love a different era or side of",
            "a well-known, obvious-in-hindsight next step from what's already on their shelves",
          ],
      lastAngle,
    );
    digAngleUsed = digAngle;

    // Past picks shown for context only — NOT a genre/territory exclusion.
    // Similar style across digs is fine and often correct (a collector's
    // taste genuinely clusters); forcing every dig into new sonic territory
    // just to avoid genre overlap produced more contrived, worse-fit picks
    // than just letting good taste repeat. Artist-level repeats are excluded
    // separately (and enforced in code below) — this block exists so the
    // model doesn't waste a pick recommending something near-identical to
    // one already shown.
    const prevRecsBlock = allPrevRecs.length > 0
      ? `\nALREADY RECOMMENDED (for context — do not recommend the same artist or a near-identical record to these; similar genre/style to these is completely fine):\n${allPrevRecs.map(r => `- ${r.artist} — ${r.album}`).join("\n")}\n`
      : "";

    const angleBlock = `\nEXPLORATION ANGLE — you must satisfy both era constraints:\n- One pick MUST come from the ${digDecadeModern} — modern releases are just as valid on vinyl as classics\n- One pick MUST come from the ${digDecadeClassic}\n- Any picks beyond those two can come from any era\n${digRegion ? `- Geography: one pick should lean toward music originating from ${digRegion}\n` : ""}- One pick should be: ${digAngle}\n- The remaining picks do NOT need to be obscure or regional — well-known, widely loved records that genuinely fit this collector's taste are just as valid a recommendation as a deep cut. Most digs should land mostly on great, findable records; rarity is a bonus, not the goal.\n`;

    const tasteSample    = sampleRecords(collection, TASTE_SAMPLE);
    const tasteSampleLines = tasteSample
      .map((r) => `- ${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}${r.genre ? ` [${r.genre}]` : ""}`)
      .join("\n");
    const collectionNote = collection.length > TASTE_SAMPLE
      ? `(showing ${tasteSample.length} of ${collection.length} records — representative taste sample)`
      : `(${collection.length} records)`;

    prompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

Below is a sample of a collector's vinyl collection and their curated Top 5 lists. Study the taste pattern carefully — it is your only brief.

COLLECTION ${collectionNote}:
${tasteSampleLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}
${artistsBlock}${prevBlock}${wantlistBlock}${prevRecsBlock}${feedbackBlock}${angleBlock}
MODE: DISCOVER — recommend artists this collector does not own yet and has not already wishlisted.

Rules:
- STRICT: Every recommendation must be by an artist NOT in the OWNED ARTISTS list and NOT in the WANTLIST.
- STRICT: Never recommend the same artist twice, or a record near-identical to one in the ALREADY RECOMMENDED list — but recommending within the same genre or sonic territory as past picks is completely fine. This collector's taste genuinely clusters; don't force variety for its own sake.
- STRICT: Follow the era constraints in the EXPLORATION ANGLE exactly — one modern pick (post-2000) is mandatory every single time.
- STRICT: Do not default to the 1960s–1970s classic canon for all picks. Resist the training bias toward that period.
- Apply the EXPLORATION ANGLE to one pick only. The remaining picks should be whatever genuinely fits this collector's taste best — they can be well-known, even famous, records. The bar is "this collector will love it," not "this collector hasn't heard of it." Do not chase obscurity for its own sake.
- Each recommendation must have a reason written in plain English that reveals the aesthetic logic — not genre tags, but the texture, atmosphere, and emotional territory. Write it as if pointing at two records already on their shelf and saying "this is where those two shelves collide." Maximum 2 sentences.
- The picks should feel genuinely surprising but inevitable in hindsight — the kind of record they will wonder how they missed.
- Prioritise records obtainable on vinyl (original pressings, reissues, or easily available secondhand).
- Only recommend a record you are confident actually exists and was released under that exact artist/album name — if you are not sure, do not include it.
${isJa ? "- Write all reason text in Japanese (日本語).\n" : ""}
Return ONLY a valid JSON array with exactly 10 objects — extra picks give headroom after artists already owned or already recommended get filtered out; only the first 3 surviving picks are shown. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;
  } else if (mode === "style") {
    const ownedArtists = [...new Set(collection.map((r) => r.artist))].sort();
    const artistsBlock = ownedArtists.length > 0
      ? `\nOWNED ARTISTS — you must not recommend any record by any of these artists:\n${ownedArtists.join(" · ")}\n`
      : "";

    const prevBlock = allPrevArtists.length > 0
      ? `\nALREADY RECOMMENDED — do not repeat any of these artists (user has already seen them, possibly in an earlier session):\n${allPrevArtists.join(" · ")}\n`
      : "";

    // Past picks for context — artist repeats are excluded above; the real
    // diversity lever for Style Dig is sub-style/scene, not genre (the genre
    // IS the brief, so avoiding it would defeat the point of the mode).
    const prevRecsBlock = allPrevRecs.length > 0
      ? `\nALREADY RECOMMENDED (for context — do not repeat the same artist or a near-identical record):\n${allPrevRecs.map(r => `- ${r.artist} — ${r.album}`).join("\n")}\n`
      : "";

    const digDecadeClassic = pick([
      "1950s", "1960s", "early 1970s", "late 1970s",
      "1980s", "early 1990s", "late 1990s", "2000s",
    ]);
    const digDecadeModern = pick(["2010s", "2020s"]);
    const digAngle = pickAvoiding(
      Math.random() < 0.5
        ? [
            "deeply obscure and rarely discussed even among collectors",
            "critically overlooked on release but reassessed since",
            "a cult classic with a devoted underground following",
            "a regional gem almost unknown outside its home country",
            "a one-album wonder that was never followed up",
            "a collaborative or side-project record that outshines the artists' main work",
          ]
        : [
            "a widely loved, critically acclaimed record this collector has somehow never picked up",
            "a record that turns up on every credible 'best of the style' list, and earns its place there",
            "a defining record by an artist they already love a different era or side of",
            "a well-known, obvious-in-hindsight next step from what's already on their shelves",
          ],
      lastAngle,
    );
    digAngleUsed = digAngle;

    const angleBlock = `\nEXPLORATION ANGLE — you must satisfy both era constraints:\n- One pick MUST come from the ${digDecadeModern} — modern releases are just as valid on vinyl as classics\n- One pick MUST come from the ${digDecadeClassic}\n- Any picks beyond those two can come from any era\n- One pick should be: ${digAngle}\n- The remaining picks do NOT need to be obscure — well-known, widely loved records within "${style}" are just as valid as a deep cut. Most digs should land mostly on great, findable records; rarity is a bonus, not the goal.\n`;

    // Filter to records in/adjacent to the requested style for the taste signal.
    // Fall back to full collection sample if fewer than 20 matching records.
    const s = style.toLowerCase();
    const styleMatching = collection.filter((r) =>
      r.genre?.toLowerCase().includes(s) ||
      (r.styles ?? []).some((st) => st.toLowerCase().includes(s))
    );
    const stylePool      = styleMatching.length >= 20 ? styleMatching : collection;
    const styleSample    = sampleRecords(stylePool, TASTE_SAMPLE);
    const styleSampleLines = styleSample
      .map((r) => `- ${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}${r.genre ? ` [${r.genre}]` : ""}`)
      .join("\n");
    const styleNote = styleMatching.length >= 20
      ? `(${styleMatching.length} records matching "${style}"${styleMatching.length > TASTE_SAMPLE ? `, showing ${styleSample.length}` : ""})`
      : `(${styleSample.length} of ${collection.length} records — full collection taste sample, few direct "${style}" matches)`;

    prompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

Below is a collector's vinyl collection and their curated Top 5 lists. Study the taste pattern carefully — it is your only brief.

COLLECTION ${styleNote}:
${styleSampleLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}
${artistsBlock}${prevBlock}${wantlistBlock}${prevRecsBlock}${subStyleFeedbackBlock}${angleBlock}
MODE: STYLE DIG — recommend artists/albums squarely within the style "${style}" that this collector does not own yet and has not already wishlisted.

Rules:
- STRICT: Every recommendation must be unambiguously within the "${style}" style, or a very close subgenre of it. Do not drift into adjacent but distinct styles.
- STRICT: Every recommendation must be by an artist NOT in the OWNED ARTISTS list and NOT in the WANTLIST.
- STRICT: Do not repeat artists from the ALREADY RECOMMENDED list — every "Dig again" must surface a genuinely different corner of "${style}".
- Tag each pick's "sub_style" field with the specific scene/niche within "${style}" it belongs to — be specific (e.g. "dub techno" not just "Techno" again). Vary the sub-style across the picks in this batch, and don't default to the same handful of canonical sub-styles every time.
- Apply the EXPLORATION ANGLE to one pick only. The remaining picks should be whatever genuinely fits this collector's taste best within "${style}" — they can be well-known, even essential, records in the style. The bar is "this collector will love it," not "this collector hasn't heard of it."
- Each reason must explain specifically what makes this pick a great entry point into "${style}" for someone who already collects vinyl in this lane — speak to the texture, atmosphere, and lineage, not genre tags. Maximum 2 sentences.
- The picks should feel genuinely surprising but inevitable in hindsight — the kind of record they will wonder how they missed.
- Prioritise records obtainable on vinyl (original pressings, reissues, or easily available secondhand).
- Only recommend a record you are confident actually exists and was released under that exact artist/album name — if you are not sure, do not include it.
${isJa ? "- Write all reason text in Japanese (日本語).\n" : ""}
Return ONLY a valid JSON array with exactly 10 objects — extra picks give headroom after artists already owned or already recommended get filtered out; only the first 3 surviving picks are shown. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;
  } else {
    // Explore: pure in-collection pick — no Claude call, no hallucination risk.
    // Exclusion sources:
    //   1. allPrevRecs — session picks + the persistent dig_history rows (all modes,
    //      last 150). Explore picks are now written to dig_history so cross-session
    //      memory survives page refreshes.
    //   2. Top 5 lists — strip the "(YYYY)" year suffix that listsForPrompt.items
    //      appends, so the "Artist — Album" key actually matches collection records.
    // Picks are chosen with two-pass diversity: artist + genre in the first pass,
    // artist-only in the second (fallback when the collection is single-genre).
    const recentExploreKeys = new Set(
      allPrevRecs.map((r) => `${r.artist.toLowerCase()}||${r.album.toLowerCase()}`)
    );
    // listsForPrompt.items are "Artist — Album (YYYY)" — strip year before comparing
    const top5Keys = new Set(
      listsForPrompt.flatMap(l =>
        l.items.map(i => i.replace(/ \(\d{4}\)$/, "").toLowerCase())
      )
    );
    const explorePool = collection.filter(
      (r) => !recentExploreKeys.has(`${r.artist.toLowerCase()}||${r.album.toLowerCase()}`)
        && !top5Keys.has(`${r.artist} — ${r.album}`.toLowerCase())
    );
    const pool     = explorePool.length >= 3 ? explorePool : collection;
    const shuffled = sampleRecords(pool, pool.length);

    // First pass: prefer different artist AND different genre across all 3 picks
    const picked: RecordRow[]      = [];
    const pickedArtists            = new Set<string>();
    const pickedGenres             = new Set<string>();
    for (const r of shuffled) {
      if (picked.length >= 3) break;
      const ak = r.artist.toLowerCase().trim();
      const gk = (r.genre ?? "").toLowerCase();
      if (pickedArtists.has(ak)) continue;
      if (gk && pickedGenres.has(gk)) continue; // skip same genre in first pass
      picked.push(r);
      pickedArtists.add(ak);
      if (gk) pickedGenres.add(gk);
    }
    // Second pass: fill remaining slots with just artist diversity (relaxes genre)
    for (const r of shuffled) {
      if (picked.length >= 3) break;
      const ak = r.artist.toLowerCase().trim();
      if (pickedArtists.has(ak) || picked.some(p => p.id === r.id)) continue;
      picked.push(r);
      pickedArtists.add(ak);
    }

    if (picked.length === 0) {
      return Response.json({ error: "Not enough records to explore" }, { status: 400 });
    }

    // Persist picks to dig_history so the next session's allPrevRecs excludes them.
    // Without this, every page refresh resets shownRecs and the same picks resurface.
    after(() => (supabase as any).from("dig_history").insert(
      picked.map(r => ({
        user_id: user.id, artist: r.artist, album: r.album, mode: "explore",
        genre: r.genre ?? null, region: null, sub_style: null, style: null, angle: null,
      }))
    ));

    const today = new Date().toISOString().slice(0, 10);
    after(() => (supabase as any).rpc("increment_dig_count", { p_user_id: user.id, p_date: today, p_mode: mode }));

    const exploreRecs = picked.map(r => {
      const q = encodeURIComponent(`${r.artist} ${r.album}`);
      return {
        artist:                 r.artist,
        album:                  r.album,
        year:                   r.year ?? null,
        genre:                  r.genre ?? null,
        region:                 null,
        sub_style:              null,
        reason:                 "In your collection",
        label:                  r.label    ?? null,
        format:                 r.format   ?? null,
        country:                r.country  ?? null,
        styles:                 r.styles   ?? null,
        producers:              r.producers ?? null,
        bandcamp_search_url:    `https://bandcamp.com/search?q=${q}`,
        spotify_search_url:     `https://open.spotify.com/search/${q}`,
        apple_music_search_url: `https://music.apple.com/search?term=${q}`,
      };
    });

    return Response.json({ recommendations: exploreRecs });
  }

  // ── Call Claude ───────────────────────────────────────────────────────────
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      // Discover/style modes ask for 5 objects (not 3) so post-filtering has
      // headroom — 1024 was already close to the ceiling for 3 full objects
      // (reason text + three search URLs each), and routinely truncated mid-
      // string for 5, surfacing as "Unterminated string in JSON" parse errors.
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return Response.json({ error: "Unexpected response from AI" }, { status: 500 });
    }

    const stripped = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    const raw = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;
    let recommendations = JSON.parse(raw);

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
    }

    // Post-filter: remove any picks Claude returned that belong to artists already
    // in the collection, or already recommended in this or an earlier session —
    // the prompt instructions alone aren't reliable enough for either rule. Only
    // the owned-artist side had this safety net before; the no-repeat rule had
    // none, so Claude dropping it silently surfaced as repeated digs with no
    // server-side catch. Ask the prompt for 5 candidates (see angleBlock/prompt
    // above) specifically so filtering down to 3 here doesn't shortchange the
    // response — without the buffer, every filtered pick was a pick never
    // replaced, so "exactly 3 requested" routinely shipped as 1 or 2 shown.
    //
    // Owned artists are matched exactly (large, stable list sourced directly
    // from the user's own data — exact match is the right tradeoff there).
    // Previously-recommended artists use fuzzy matching instead, since that's
    // a smaller, recently-seen set where catching "Boards Of Canada" vs
    // "boards of canada" / diacritic variants actually matters for not
    // re-showing the same artist under a slightly different spelling.
    if (mode === "discover" || mode === "style") {
      const ownedArtistSet = new Set(collection.map(r => r.artist.toLowerCase().trim()));
      const seenThisBatch: string[] = []; // the 5-candidate buffer could repeat an artist across its own picks
      const candidates = (recommendations as Array<{ artist?: string }>).filter(r => {
        if (!r.artist) return false;
        const exactKey = r.artist.toLowerCase().trim();
        if (ownedArtistSet.has(exactKey)) return false;
        if (allPrevArtists.some(a => isPlausibleArtistMatch(r.artist!, a))) return false;
        if (seenThisBatch.some(a => isPlausibleArtistMatch(r.artist!, a))) return false;
        seenThisBatch.push(r.artist);
        return true;
      });

      // Existence check — run in parallel across the surviving candidates,
      // dropping anything Discogs can't plausibly verify (likely hallucinated).
      const verified = await Promise.all(
        candidates.map(async (r: { artist?: string; album?: string }) =>
          r.artist && r.album && (await verifyOnDiscogs(r.artist, r.album)) ? r : null
        )
      );
      recommendations = verified.filter((r): r is { artist?: string; album?: string } => r !== null).slice(0, 3);

      // Hybrid fallback: fill remaining slots from rekōdo's internal library when
      // Discogs verification or the owned-artist filter reduces Claude's picks below 3.
      if (recommendations.length < 3) {
        const needed = 3 - recommendations.length;
        const ownedIdSet    = new Set(recordIds);
        const filledArtists = new Set<string>([
          ...allPrevArtists.map(a => a.toLowerCase().trim()),
          ...(recommendations as Array<{ artist?: string }>).map(r => r.artist?.toLowerCase().trim() ?? ""),
        ]);
        const wantlistSet = new Set(wantlistAlbums.map(s => s.toLowerCase()));

        type DbRec = { id: string; artist: string; album: string; year: number | null; genre: string | null; styles: string[] | null; label: string | null; format: string | null; country: string | null; producers: string[] | null };
        let dbPool: DbRec[] = [];

        if (mode === "style") {
          // Match against the styles array (style is a Discogs sub-genre tag, not a primary genre)
          const { data } = await (supabase as any)
            .from("records")
            .select("id, artist, album, year, genre, styles, label, format, country, producers")
            .contains("styles", [style])
            .limit(300) as { data: DbRec[] | null };
          dbPool = data ?? [];
        } else if (collection.length > 0) {
          // Use the user's top genres as a taste signal
          const genreCount = new Map<string, number>();
          for (const r of collection) if (r.genre) genreCount.set(r.genre, (genreCount.get(r.genre) ?? 0) + 1);
          const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
          if (topGenres.length > 0) {
            const { data } = await supabase
              .from("records")
              .select("id, artist, album, year, genre, styles, label, format, country, producers")
              .in("genre", topGenres)
              .limit(300) as { data: DbRec[] | null };
            dbPool = data ?? [];
          }
        }

        if (dbPool.length > 0) {
          const eligible = sampleRecords(
            dbPool.filter(r =>
              r.artist && r.album &&
              !ownedIdSet.has(r.id) &&
              !ownedArtistSet.has(r.artist.toLowerCase().trim()) &&
              !filledArtists.has(r.artist.toLowerCase().trim()) &&
              !wantlistSet.has(`${r.artist} — ${r.album}`.toLowerCase())
            ),
            needed * 5
          );

          const pickedArtists = new Set<string>();
          for (const r of eligible) {
            if ((recommendations as unknown[]).length >= 3) break;
            const artistKey = r.artist.toLowerCase().trim();
            if (pickedArtists.has(artistKey)) continue;
            pickedArtists.add(artistKey);
            const q = encodeURIComponent(`${r.artist} ${r.album}`);
            (recommendations as unknown[]).push({
              artist:    r.artist,
              album:     r.album,
              year:      r.year ?? null,
              genre:     r.genre ?? null,
              region:    null,
              sub_style: null,
              reason:    "From rekōdo's library",
              label:     r.label     ?? null,
              format:    r.format    ?? null,
              country:   r.country   ?? null,
              styles:    r.styles    ?? null,
              producers: r.producers ?? null,
              bandcamp_search_url:    `https://bandcamp.com/search?q=${q}`,
              spotify_search_url:     `https://open.spotify.com/search/${q}`,
              apple_music_search_url: `https://music.apple.com/search?term=${q}`,
            });
          }
        }
      }

      if (recommendations.length === 0) {
        return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
      }
    }

    // Atomically increment daily dig count for all users (fire-and-forget,
    // kept alive via after() — a bare unawaited call gets killed mid-flight
    // once the response below is sent).
    const today = new Date().toISOString().slice(0, 10);
    after(() => (supabase as any).rpc("increment_dig_count", { p_user_id: user.id, p_date: today, p_mode: mode }));

    // Persist outside-collection picks (with genre/region/sub-style/angle tags)
    // so future digs (any session/device) don't repeat them and can learn
    // from what's accepted, dismissed, or shown repeatedly with no action.
    if (mode === "discover" || mode === "style") {
      const rows = (recommendations as Array<{ artist?: string; album?: string; genre?: string; region?: string; sub_style?: string }>)
        .filter((r) => r.artist && r.album)
        .map((r) => ({
          user_id: user.id, artist: r.artist, album: r.album, mode,
          genre: r.genre ?? null, region: r.region ?? null,
          sub_style: mode === "style" ? (r.sub_style ?? null) : null,
          style: mode === "style" ? style : null,
          angle: digAngleUsed,
        }));
      if (rows.length > 0) after(() => (supabase as any).from("dig_history").insert(rows));
    }

    return Response.json({ recommendations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `AI error: ${msg}` }, { status: 500 });
  }
}
