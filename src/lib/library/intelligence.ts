import Anthropic from "@anthropic-ai/sdk";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CollectionItem {
  artist: string;
  album?: string;
  year?: number | null;
  genre?: string | null;
  label?: string | null;
  country?: string | null;
}

export async function computeCollectionIntelligence(
  supabase: SupabaseClient<Database>,
  userId: string,
  collection: CollectionItem[]
): Promise<void> {
  if (collection.length === 0) return;

  const collectionLines = collection
    .map((r) => {
      const parts = [`${r.artist}${r.album ? ` — ${r.album}` : ""}`];
      if (r.label) parts.push(`label:${r.label}`);
      if (r.year) parts.push(`year:${r.year}`);
      if (r.genre) parts.push(`genre:${r.genre}`);
      if (r.country) parts.push(`country:${r.country}`);
      return parts.join(" | ");
    })
    .join("\n");

  const prompt = `You are analysing a vinyl record collection.

Collection data (${collection.length} records):
${collectionLines}

Return JSON only, no preamble, no markdown:
{
  "top_artists": [{"name": "", "count": 0, "notable_records": [""]}],
  "top_labels": [{"name": "", "count": 0}],
  "top_genres": [{"name": "", "count": 0}],
  "top_decades": [{"decade": "", "count": 0}],
  "top_countries": [{"country": "", "count": 0}],
  "taste_keywords": []
}

Rules:
- top_artists: top 20 most-owned artists by count, include their notable records from this collection
- top_labels: top 15 most-common labels
- top_genres: top 10 genres
- top_decades: count by decade (e.g. "1960s", "1970s")
- top_countries: top 10 countries
- taste_keywords: 10–15 descriptive terms capturing the aesthetic character of this collection`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") return;

  const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(raw);

  await supabase.from("collection_intelligence").delete().eq("user_id", userId);

  await supabase.from("collection_intelligence").insert({
    user_id: userId,
    top_artists: parsed.top_artists ?? [],
    top_labels: parsed.top_labels ?? [],
    top_genres: parsed.top_genres ?? [],
    top_decades: parsed.top_decades ?? [],
    top_countries: parsed.top_countries ?? [],
    taste_summary: JSON.stringify(parsed.taste_keywords ?? []),
    last_computed_at: new Date().toISOString(),
  });
}
