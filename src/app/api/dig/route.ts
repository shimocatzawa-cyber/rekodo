import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const BATCH = 400;

const JSON_SCHEMA = `[
  {
    "artist": "string",
    "album": "string",
    "year": number or null,
    "genre": "string — the single primary genre/style tag for this pick",
    "region": "string — the country or region this artist/record originates from",
    "reason": "string",
    "bandcamp_search_url": "https://bandcamp.com/search?q=ENCODED_QUERY",
    "spotify_search_url": "https://open.spotify.com/search/ENCODED_QUERY",
    "apple_music_search_url": "https://music.apple.com/search?term=ENCODED_QUERY"
  }
]

For the search URLs, encode "artist album" as the query (URL-encode spaces and special characters).`;

export async function POST(request: Request) {
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
  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  const recordIds = (links ?? []).map((l) => l.record_id);

  type RecordRow = { id: string; artist: string; album: string; year: number | null; genre: string | null };
  const collectionMap = new Map<string, RecordRow>();
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, artist, album, year, genre")
      .in("id", recordIds.slice(i, i + BATCH));
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

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;

      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          messages: [{ role: "user", content: quizPrompt }],
        });
        const content = message.content[0];
        if (content.type !== "text") return Response.json({ error: "Unexpected response from AI" }, { status: 500 });
        const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
        const recommendations = JSON.parse(raw);
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
        }
        const today = new Date().toISOString().slice(0, 10);
        void (supabase as any).rpc("increment_dig_count", { p_user_id: user.id, p_date: today, p_mode: mode });
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
      const { data: wlItems } = await supabase
        .from("list_items")
        .select("record_id, song_artist, song_album")
        .eq("list_id", wlRow.id);

      const wlRecordIds = (wlItems ?? []).map(i => i.record_id).filter(Boolean) as string[];

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
    artist: string; album: string;
    genre: string | null; region: string | null;
    wantlisted_at: string | null; collected_at: string | null;
  };
  const { data: historyRows } = await (supabase as any)
    .from("dig_history")
    .select("artist, album, genre, region, wantlisted_at, collected_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(150) as { data: HistoryRow[] | null };
  const history = historyRows ?? [];

  const allPrevArtists = [...new Set([...previousArtists, ...history.map((h) => h.artist)])];
  const allPrevRecsMap = new Map<string, { artist: string; album: string }>();
  for (const r of [...previousRecommendations, ...history]) {
    if (r.artist && r.album) allPrevRecsMap.set(`${r.artist} ${r.album}`, r);
  }
  const allPrevRecs = [...allPrevRecsMap.values()];

  // ── Feedback signal from past digs: what they acted on (wantlisted or later
  // bought) vs. what they've seen repeatedly and never touched ───────────────
  function tally(key: "genre" | "region") {
    const counts = new Map<string, { shown: number; accepted: number }>();
    for (const r of history) {
      const val = r[key];
      if (!val) continue;
      const entry = counts.get(val) ?? { shown: 0, accepted: 0 };
      entry.shown += 1;
      if (r.wantlisted_at || r.collected_at) entry.accepted += 1;
      counts.set(val, entry);
    }
    return counts;
  }
  const genreCounts = tally("genre");
  const regionCounts = tally("region");
  const accepted = (counts: Map<string, { shown: number; accepted: number }>) =>
    [...counts.entries()].filter(([, v]) => v.accepted > 0).map(([k]) => k);
  const fatigued = (counts: Map<string, { shown: number; accepted: number }>) =>
    [...counts.entries()].filter(([, v]) => v.shown >= 3 && v.accepted === 0).map(([k]) => k);
  const acceptedGenres = accepted(genreCounts);
  const fatiguedGenres = fatigued(genreCounts);
  const acceptedRegions = accepted(regionCounts);
  const fatiguedRegions = fatigued(regionCounts);

  const feedbackBlock = (acceptedGenres.length || fatiguedGenres.length || acceptedRegions.length || fatiguedRegions.length)
    ? `\nFEEDBACK FROM PAST DIGS — this collector's real behaviour, weight it more than guesswork:\n${
        acceptedGenres.length ? `- They've wantlisted or bought past picks in: ${acceptedGenres.join(", ")}. Lean toward more of this when it genuinely fits the brief.\n` : ""
      }${
        fatiguedGenres.length ? `- They've been shown repeated picks in ${fatiguedGenres.join(", ")} without acting on any — ease off this territory unless something truly exceptional warrants it.\n` : ""
      }${
        acceptedRegions.length ? `- Regions they've responded to: ${acceptedRegions.join(", ")}.\n` : ""
      }${
        fatiguedRegions.length ? `- Regions shown repeatedly with no action: ${fatiguedRegions.join(", ")} — deprioritise these.\n` : ""
      }`
    : "";

  // ── Build prompt ──────────────────────────────────────────────────────────
  const collectionLines = collection
    .map((r) => `- ${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}${r.genre ? ` [${r.genre}]` : ""}`)
    .join("\n");

  const listsLines = listsForPrompt.length > 0
    ? listsForPrompt
        .map((l) => `${l.title}:\n${l.items.map((item) => `  • ${item}`).join("\n")}`)
        .join("\n\n")
    : "(No Top 5 lists filled in yet)";

  const wantlistBlock = wantlistAlbums.length > 0
    ? `\nWANTLIST — do NOT recommend any of these (already on their radar):\n${wantlistAlbums.join("\n")}\n`
    : "";

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  let prompt: string;

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
    const digAngle = Math.random() < 0.5
      ? pick([
          "deeply obscure and rarely discussed even among collectors",
          "critically overlooked on release but reassessed since",
          "a cult classic with a devoted underground following",
          "a regional gem almost unknown outside its home country",
          "a one-album wonder that was never followed up",
          "a collaborative or side-project record that outshines the artists' main work",
        ])
      : pick([
          "a widely loved, critically acclaimed record this collector has somehow never picked up",
          "a record that turns up on every credible 'best albums' list, and earns its place there",
          "a famous record from a genre adjacent to their taste they've likely just never gotten around to",
          "a defining record by an artist they already love a different era or side of",
          "a well-known, obvious-in-hindsight next step from what's already on their shelves",
        ]);

    const prevRecsBlock = allPrevRecs.length > 0
      ? `\nALREADY RECOMMENDED (avoid the same genre, region, or sonic territory as these):\n${allPrevRecs.map(r => `- ${r.artist} — ${r.album}`).join("\n")}\n`
      : "";

    const angleBlock = `\nEXPLORATION ANGLE — you must satisfy both era constraints:\n- One pick MUST come from the ${digDecadeModern} — modern releases are just as valid on vinyl as classics\n- One pick MUST come from the ${digDecadeClassic}\n- The third pick can come from any era\n${digRegion ? `- Geography: one pick should lean toward music originating from ${digRegion}\n` : ""}- One pick should be: ${digAngle}\n- The other two picks do NOT need to be obscure or regional — well-known, widely loved records that genuinely fit this collector's taste are just as valid a recommendation as a deep cut. Most digs should land mostly on great, findable records; rarity is a bonus, not the goal.\n`;

    prompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

Below is a collector's vinyl collection and their curated Top 5 lists. Study the taste pattern carefully — it is your only brief.

COLLECTION (${collection.length} records):
${collectionLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}
${artistsBlock}${prevBlock}${wantlistBlock}${prevRecsBlock}${feedbackBlock}${angleBlock}
MODE: DISCOVER — recommend artists this collector does not own yet and has not already wishlisted.

Rules:
- STRICT: Every recommendation must be by an artist NOT in the OWNED ARTISTS list and NOT in the WANTLIST.
- STRICT: Do not recommend anything from the same genre, regional scene, or sonic territory as the ALREADY RECOMMENDED list above — every "Dig again" must open a genuinely different crate.
- STRICT: Follow the era constraints in the EXPLORATION ANGLE exactly — one modern pick (post-2000) is mandatory every single time.
- STRICT: Do not default to the 1960s–1970s classic canon for all three picks. Resist the training bias toward that period.
- Apply the EXPLORATION ANGLE to one pick only. The other two picks should be whatever genuinely fits this collector's taste best — they can be well-known, even famous, records. The bar is "this collector will love it," not "this collector hasn't heard of it." Do not chase obscurity for its own sake.
- Each recommendation must have a reason written in plain English that reveals the aesthetic logic — not genre tags, but the texture, atmosphere, and emotional territory. Write it as if pointing at two records already on their shelf and saying "this is where those two shelves collide." Maximum 2 sentences.
- The picks should feel genuinely surprising but inevitable in hindsight — the kind of record they will wonder how they missed.
- Prioritise records obtainable on vinyl (original pressings, reissues, or easily available secondhand).

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

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

    const prevRecsBlock = allPrevRecs.length > 0
      ? `\nALREADY RECOMMENDED (avoid repeating the same artists or sub-style as these):\n${allPrevRecs.map(r => `- ${r.artist} — ${r.album}`).join("\n")}\n`
      : "";

    const digDecadeClassic = pick([
      "1950s", "1960s", "early 1970s", "late 1970s",
      "1980s", "early 1990s", "late 1990s", "2000s",
    ]);
    const digDecadeModern = pick(["2010s", "2020s"]);
    const digAngle = Math.random() < 0.5
      ? pick([
          "deeply obscure and rarely discussed even among collectors",
          "critically overlooked on release but reassessed since",
          "a cult classic with a devoted underground following",
          "a regional gem almost unknown outside its home country",
          "a one-album wonder that was never followed up",
          "a collaborative or side-project record that outshines the artists' main work",
        ])
      : pick([
          "a widely loved, critically acclaimed record this collector has somehow never picked up",
          "a record that turns up on every credible 'best of the style' list, and earns its place there",
          "a defining record by an artist they already love a different era or side of",
          "a well-known, obvious-in-hindsight next step from what's already on their shelves",
        ]);

    const angleBlock = `\nEXPLORATION ANGLE — you must satisfy both era constraints:\n- One pick MUST come from the ${digDecadeModern} — modern releases are just as valid on vinyl as classics\n- One pick MUST come from the ${digDecadeClassic}\n- The third pick can come from any era\n- One pick should be: ${digAngle}\n- The other two picks do NOT need to be obscure — well-known, widely loved records within "${style}" are just as valid as a deep cut. Most digs should land mostly on great, findable records; rarity is a bonus, not the goal.\n`;

    prompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

Below is a collector's vinyl collection and their curated Top 5 lists. Study the taste pattern carefully — it is your only brief.

COLLECTION (${collection.length} records):
${collectionLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}
${artistsBlock}${prevBlock}${wantlistBlock}${prevRecsBlock}${feedbackBlock}${angleBlock}
MODE: STYLE DIG — recommend artists/albums squarely within the style "${style}" that this collector does not own yet and has not already wishlisted.

Rules:
- STRICT: Every recommendation must be unambiguously within the "${style}" style, or a very close subgenre of it. Do not drift into adjacent but distinct styles.
- STRICT: Every recommendation must be by an artist NOT in the OWNED ARTISTS list and NOT in the WANTLIST.
- STRICT: Do not repeat artists from the ALREADY RECOMMENDED list — every "Dig again" must surface a genuinely different corner of "${style}".
- Apply the EXPLORATION ANGLE to one pick only. The other two should be whatever genuinely fits this collector's taste best within "${style}" — they can be well-known, even essential, records in the style. The bar is "this collector will love it," not "this collector hasn't heard of it."
- Each reason must explain specifically what makes this pick a great entry point into "${style}" for someone who already collects vinyl in this lane — speak to the texture, atmosphere, and lineage, not genre tags. Maximum 2 sentences.
- The picks should feel genuinely surprising but inevitable in hindsight — the kind of record they will wonder how they missed.
- Prioritise records obtainable on vinyl (original pressings, reissues, or easily available secondhand).

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;
  } else {
    // Explore: surface hidden gems from within the collection
    prompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

Below is a collector's vinyl collection and their curated Top 5 lists. Study the taste pattern carefully — it is your only brief.

COLLECTION (${collection.length} records):
${collectionLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}

MODE: EXPLORE — surface hidden gems from within this collector's existing collection.

Rules:
- YOU MUST ONLY recommend records that appear verbatim in the COLLECTION list above. Do not recommend anything outside that list.
- Find 3 records the collector already owns that deserve far more attention than they are likely getting — overlooked masterpieces, records with hidden depth, or albums that become revelatory once you understand their context.
- Prefer records NOT already featured in the Top 5 lists (those are already appreciated).
- Each reason must explain specifically WHY this record is a hidden gem — what makes it extraordinary, what the collector may have missed on first listen, or how it connects to deeper threads in their taste. Frame it as "you already own this — here is why it deserves to be on your shelf of shelves." Maximum 2 sentences.
- Do not recommend the most obvious or celebrated record by an artist if a deeper cut would be more revealing.

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;
  }

  // ── Call Claude ───────────────────────────────────────────────────────────
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return Response.json({ error: "Unexpected response from AI" }, { status: 500 });
    }

    const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    let recommendations = JSON.parse(raw);

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
    }

    // Post-filter: remove any picks Claude returned that belong to artists already
    // in the collection — the prompt instruction alone isn't reliable enough.
    if (mode === "discover" || mode === "style") {
      const ownedArtistSet = new Set(collection.map(r => r.artist.toLowerCase().trim()));
      recommendations = recommendations.filter(
        (r: { artist?: string }) => r.artist && !ownedArtistSet.has(r.artist.toLowerCase().trim())
      );
      if (recommendations.length === 0) {
        return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
      }
    }

    // Atomically increment daily dig count for all users (fire-and-forget)
    const today = new Date().toISOString().slice(0, 10);
    void (supabase as any).rpc("increment_dig_count", { p_user_id: user.id, p_date: today, p_mode: mode });

    // Persist outside-collection picks (with genre/region tags) so future digs
    // (any session/device) don't repeat them and can learn from what's accepted
    if (mode === "discover" || mode === "style") {
      const rows = recommendations
        .filter((r: { artist?: string; album?: string }) => r.artist && r.album)
        .map((r: { artist: string; album: string; genre?: string; region?: string }) => ({
          user_id: user.id, artist: r.artist, album: r.album, mode,
          genre: r.genre ?? null, region: r.region ?? null,
        }));
      if (rows.length > 0) void (supabase as any).from("dig_history").insert(rows);
    }

    return Response.json({ recommendations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `AI error: ${msg}` }, { status: 500 });
  }
}
