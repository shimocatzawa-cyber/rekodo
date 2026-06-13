import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  if (!links?.length) return Response.json({ error: "Empty collection" }, { status: 400 });

  const collectionCount = links.length;

  // Cache in taste_profile_cache.profile_data under a dedicated key,
  // keeping it separate from taste_summary (used for album recommendations on profile page)
  const { data: cached } = await (supabase as any)
    .from("taste_profile_cache")
    .select("profile_data, record_count_at_generation")
    .eq("user_id", user.id)
    .maybeSingle();

  type ProfileData = Record<string, unknown> & { collectionSummary?: string };
  const cachedData    = (cached?.profile_data ?? {}) as ProfileData;
  const cachedCount   = cached?.record_count_at_generation ?? 0;

  if (cachedData.collectionSummary && cachedCount === collectionCount) {
    return Response.json({ oneLiner: cachedData.collectionSummary });
  }

  const recordIds = links.map(l => l.record_id);
  type RecordRow = { artist: string; genre: string | null; year: number | null; label: string | null };
  const allRecords: RecordRow[] = [];
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("artist, genre, year, label")
      .in("id", recordIds.slice(i, i + BATCH));
    if (data) allRecords.push(...(data as RecordRow[]));
  }

  if (allRecords.length < 5) return Response.json({ error: "Not enough data" }, { status: 400 });

  // Genre summary
  const genreMap = new Map<string, number>();
  for (const r of allRecords) if (r.genre) genreMap.set(r.genre, (genreMap.get(r.genre) ?? 0) + 1);
  const topGenres = [...genreMap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([g, n]) => `${g} (${Math.round((n / allRecords.length) * 100)}%)`).join(", ");

  // Decade breakdown
  const decadeMap = new Map<string, number>();
  for (const r of allRecords) {
    if (!r.year) continue;
    const d = r.year < 1960 ? "pre-1960s" : `${Math.floor(r.year / 10) * 10}s`;
    decadeMap.set(d, (decadeMap.get(d) ?? 0) + 1);
  }
  const topDecades = [...decadeMap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([d, n]) => `${d} (${n})`).join(", ");

  // Artist obsessions
  const artistMap = new Map<string, number>();
  for (const r of allRecords) artistMap.set(r.artist, (artistMap.get(r.artist) ?? 0) + 1);
  const topArtists = [...artistMap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .filter(([, n]) => n >= 2)
    .map(([a, n]) => `${a} (${n})`).join(", ");

  // Top labels
  const labelMap = new Map<string, number>();
  for (const r of allRecords) if (r.label) labelMap.set(r.label, (labelMap.get(r.label) ?? 0) + 1);
  const topLabels = [...labelMap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([l, n]) => `${l} (${n})`).join(", ");

  const collectionData = [
    `Total: ${allRecords.length} records`,
    topGenres   && `Genres: ${topGenres}`,
    topDecades  && `Decades: ${topDecades}`,
    topLabels   && `Top labels: ${topLabels}`,
    topArtists  && `Artist obsessions: ${topArtists}`,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system: [
        {
          type: "text",
          text: "You are a perceptive music critic writing a short reflection on a vinyl collection. Write exactly 2 sentences (under 40 words total) that analyse what this collection reveals — the collector's obsessions, crate-digging instincts, label loyalties, or era fixations. Be specific: reference real genres, labels, artists, or decades from the data. Start with 'Your collection'. No quotes, no album recommendations.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: collectionData }],
    });

    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response");
    const oneLiner = block.text.trim().replace(/^["']|["']$/g, "");

    // Store in taste_profile_cache without touching taste_summary
    await (supabase as any)
      .from("taste_profile_cache")
      .upsert({
        user_id:                    user.id,
        profile_data:               { ...cachedData, collectionSummary: oneLiner },
        record_count_at_generation: collectionCount,
        generated_at:               new Date().toISOString(),
      }, { onConflict: "user_id" });

    return Response.json({ oneLiner });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI error" }, { status: 500 });
  }
}
