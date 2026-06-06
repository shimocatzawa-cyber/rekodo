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
  const mood: string = typeof body.mood === "string" ? body.mood.trim() : "";
  if (!mood) return Response.json({ error: "Mood is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // ── Taste profile context ─────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("bio, star_sign, city")
    .eq("id", user.id)
    .maybeSingle();

  // ── Collection ────────────────────────────────────────────────────────────
  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  const recordIds = (links ?? []).map(l => l.record_id);
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
    .map(id => collectionMap.get(id))
    .filter((r): r is RecordRow => r !== undefined);

  // ── Top-5 lists ───────────────────────────────────────────────────────────
  const { data: listsRaw } = await supabase
    .from("lists")
    .select("id, title, list_type")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const top5Lists = (listsRaw ?? []).filter(l => !l.list_type || l.list_type === "top5");
  type ListWithItems = { title: string; items: string[] };
  const listsForPrompt: ListWithItems[] = [];

  if (top5Lists.length > 0) {
    const listIds = top5Lists.map(l => l.id);
    const { data: itemsRaw } = await supabase
      .from("list_items")
      .select("list_id, record_id")
      .in("list_id", listIds);

    const itemRecordIds = [
      ...new Set((itemsRaw ?? []).map(i => i.record_id).filter(Boolean)),
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
        .filter(i => i.list_id === list.id && i.record_id)
        .map(i => {
          const r = itemRecordMap.get(i.record_id!);
          return r ? `${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}` : null;
        })
        .filter((s): s is string => s !== null);
      if (items.length > 0) listsForPrompt.push({ title: list.title, items });
    }
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const collectionLines = collection
    .map(r => `- ${r.artist} — ${r.album}${r.year ? ` (${r.year})` : ""}${r.genre ? ` [${r.genre}]` : ""}`)
    .join("\n");

  const listsLines = listsForPrompt.length > 0
    ? listsForPrompt
        .map(l => `${l.title}:\n${l.items.map(item => `  • ${item}`).join("\n")}`)
        .join("\n\n")
    : "(No Top 5 lists filled in yet)";

  const profileLines = [
    profile?.bio       ? `Taste essay: "${profile.bio}"` : null,
    profile?.star_sign ? `Star sign: ${profile.star_sign}` : null,
    profile?.city      ? `City: ${profile.city}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are a vinyl recommendation engine with encyclopaedic knowledge of music across all genres, eras, and territories.

A collector has asked for a mood-based recommendation. Their request: "${mood}"

TASTE PROFILE:
${profileLines || "(No additional profile context)"}

COLLECTION (${collection.length} records):
${collectionLines || "(Empty — no collection yet)"}

TOP 5 LISTS:
${listsLines}

TASK: Recommend 3 records that perfectly fit the mood "${mood}" AND resonate with this collector's taste. Records can be from their collection (perfect owned records for this moment) or outside it (new discoveries). Mood fit is the primary filter — taste alignment is secondary.

Rules:
- Each reason must do two things in two sentences maximum: (1) explain precisely why this record fits the mood/context — the texture, atmosphere, tempo, emotional register; (2) connect it to something specific in their taste profile. Be poetic but exact.
- Do not recommend the same artist twice.
- Prioritise records available on vinyl.
- Aim for variety: not all obvious picks, at least one discovery the collector likely hasn't heard.

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation outside the JSON.

Schema:
${JSON_SCHEMA}`;

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
