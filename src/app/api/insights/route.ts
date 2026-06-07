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

  // Return cached summary when collection size hasn't changed
  const { data: profile } = await supabase
    .from("profiles")
    .select("taste_summary, taste_summary_count")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.taste_summary && profile.taste_summary_count === collectionCount) {
    return Response.json({ oneLiner: profile.taste_summary });
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
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([g, n]) => `${g} ${Math.round((n / allRecords.length) * 100)}%`).join(", ");

  // Peak decade
  const decadeMap = new Map<string, number>();
  for (const r of allRecords) {
    if (!r.year) continue;
    const d = r.year < 1960 ? "pre-1960s" : `${Math.floor(r.year / 10) * 10}s`;
    decadeMap.set(d, (decadeMap.get(d) ?? 0) + 1);
  }
  const topDecade = decadeMap.size > 0
    ? [...decadeMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Artist frequency (completist detection)
  const artistMap = new Map<string, number>();
  for (const r of allRecords) artistMap.set(r.artist, (artistMap.get(r.artist) ?? 0) + 1);
  const topArtists = [...artistMap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .filter(([, n]) => n >= 2)
    .map(([a, n]) => `${a} (${n})`).join(", ");

  // Top label
  const labelMap = new Map<string, number>();
  for (const r of allRecords) if (r.label) labelMap.set(r.label, (labelMap.get(r.label) ?? 0) + 1);
  const topLabelEntry = labelMap.size > 0
    ? [...labelMap.entries()].sort((a, b) => b[1] - a[1])[0]
    : null;

  const summary = [
    `Total: ${allRecords.length} records`,
    topGenres     && `Genres: ${topGenres}`,
    topDecade     && `Peak decade: ${topDecade}`,
    topLabelEntry && `Top label: ${topLabelEntry[0]} (${topLabelEntry[1]} records)`,
    topArtists    && `Multiple records by same artist: ${topArtists}`,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system: [
        {
          type: "text",
          text: "You analyse vinyl record collections and write exactly 1–2 sentences (under 35 words total) revealing the collector's musical personality. Be specific — reference artists, labels, decades, or genres. Start with 'Your'. Return only the sentences, no quotes.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: summary }],
    });
    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response");
    const oneLiner = block.text.trim().replace(/^["']|["']$/g, "");

    // Persist so subsequent calls return instantly until collection size changes
    await supabase
      .from("profiles")
      .update({ taste_summary: oneLiner, taste_summary_count: collectionCount })
      .eq("id", user.id);

    return Response.json({ oneLiner });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI error" }, { status: 500 });
  }
}
