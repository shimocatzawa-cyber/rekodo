import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const BATCH = 400;

const JSON_SCHEMA = `[
  {
    "artist": "string",
    "album": "string",
    "year": number or null,
    "reason": "string",
    "bandcamp_search_url": "https://bandcamp.com/search?q=ENCODED_QUERY",
    "spotify_search_url": "https://open.spotify.com/search/ENCODED_QUERY",
    "apple_music_search_url": "https://music.apple.com/search?term=ENCODED_QUERY"
  }
]

For the search URLs, encode "artist album" as the query (URL-encode spaces and special characters).`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const mode: "discover" | "explore" | "hallucinations" =
    body.mode === "explore" ? "explore" :
    body.mode === "hallucinations" ? "hallucinations" :
    "discover";

  // Artists shown in earlier digs this session — hard-exclude to prevent repetition
  const previousArtists: string[] = Array.isArray(body.previousArtists) ? body.previousArtists : [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

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

    const prevBlock = previousArtists.length > 0
      ? `\nALREADY RECOMMENDED THIS SESSION — do not repeat any of these artists (user has already seen them):\n${previousArtists.join(" · ")}\n`
      : "";

    // Random exploration angle — forces variety on every call
    const digDecade = pick(["1950s", "1960s", "early 1970s", "late 1970s", "1980s", "early 1990s", "late 1990s", "2000s"]);
    const digRegion = pick(["West Africa", "Japan", "Brazil", "Jamaica", "Germany", "Nigeria", "Colombia", "South Korea", "East Africa", "Scandinavia", "India", "Turkey", "Eastern Europe", "Caribbean", "Indonesia", "Argentina"]);
    const digAngle  = pick([
      "deeply obscure and rarely discussed even among collectors",
      "critically overlooked on release but reassessed since",
      "a cult classic with a devoted underground following",
      "a regional gem almost unknown outside its home country",
      "a one-album wonder that was never followed up",
      "a late-career revelation by an artist known for something else entirely",
      "an influential record that shaped a genre without ever becoming famous itself",
      "a collaborative or side-project record that outshines the artists' main work",
    ]);

    const angleBlock = `\nEXPLORATION ANGLE — use this to steer away from defaults and ensure variety:\n- Era: favour records from the ${digDecade}\n- Geography: look toward music originating from ${digRegion}\n- At least one pick must be: ${digAngle}\n`;

    prompt = `You are a vinyl crate-digging assistant with encyclopaedic knowledge of recorded music across all genres, eras, and territories.

Below is a collector's vinyl collection and their curated Top 5 lists. Study the taste pattern carefully — it is your only brief.

COLLECTION (${collection.length} records):
${collectionLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}
${artistsBlock}${prevBlock}${wantlistBlock}${angleBlock}
MODE: DISCOVER — recommend artists this collector does not own yet and has not already wishlisted.

Rules:
- STRICT: Every recommendation must be by an artist NOT in the OWNED ARTISTS list and NOT in the WANTLIST. This collector wants completely new discoveries.
- Follow the EXPLORATION ANGLE — do not default to the most obvious or well-known records that match this taste profile. Each "Dig again" should feel like a different crate.
- Each recommendation must have a reason written in plain English that reveals the aesthetic logic — not genre tags, but the texture, atmosphere, and emotional territory. Write it as if pointing at two records already on their shelf and saying "this is where those two shelves collide." Maximum 2 sentences.
- The picks should feel genuinely surprising but inevitable in hindsight — the kind of record they will wonder how they missed.
- Prioritise records obtainable on vinyl (original pressings, reissues, or easily available secondhand).

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;
  } else if (mode === "hallucinations") {
    const ownedArtists = [...new Set(collection.map((r) => r.artist))].sort();
    const artistsBlock = ownedArtists.length > 0
      ? `\nOWNED ARTISTS — do not recommend any record by any of these artists:\n${ownedArtists.join(" · ")}\n`
      : "";

    const prevBlock = previousArtists.length > 0
      ? `\nALREADY RECOMMENDED THIS SESSION — do not repeat any of these artists:\n${previousArtists.join(" · ")}\n`
      : "";

    prompt = `You are a fearless crate-digging oracle with encyclopaedic knowledge of the entire recorded music universe — mainstream and deeply obscure. Your mission: take this collector somewhere they have never been.

Below is a collector's vinyl collection and their curated Top 5 lists. Study their taste carefully — so you can transcend it.

COLLECTION (${collection.length} records):
${collectionLines || "(Empty collection)"}

TOP 5 LISTS:
${listsLines}
${artistsBlock}${prevBlock}${wantlistBlock}
MODE: HALLUCINATIONS · TAKE THE TRIP — surface 3 records that push into territory this collector has never explored. You are not limited to what is far from their collection; you are hunting for genuinely mind-expanding music from obscure and psychedelic corners of the recorded universe.

Rules:
- STRONG BIAS toward psychedelic music in all its forms: acid folk, kosmische, psych rock, free jazz, raga, Ethiopian jazz, Brazilian tropicália, Afrobeat, spiritual jazz, noise, drone, outer limits electronic, and any genre where the music itself alters perception. Dig deep — not the obvious psych classics, but the genuinely obscure pressings and lost masterpieces.
- At least one pick must be from a non-Western musical tradition the collector shows no sign of owning.
- Recommend artists NOT in the OWNED ARTISTS list.
- Each reason must do two things: (1) describe the sonic and spiritual territory of the record — what it feels like to hear it, the world it opens; (2) acknowledge the leap from their current taste and make it feel like an invitation rather than a challenge. Maximum 2 sentences. Write with conviction.
- Real albums only. Must be obtainable on vinyl (original pressing or reissue).

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
    const recommendations = JSON.parse(raw);

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return Response.json({ error: "Invalid recommendations format" }, { status: 500 });
    }

    return Response.json({ recommendations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `AI error: ${msg}` }, { status: 500 });
  }
}
