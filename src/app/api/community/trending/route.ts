import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Trending is global (same result for every user) and changes slowly — recompute
// at most once per 24h. Uses a DB-side GROUP BY aggregation via RPC so Postgres
// handles the counting rather than reading every user_records row into JS.
const getCachedTrending = unstable_cache(
  async () => {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: trendingRows, error } = await supabase.rpc("get_trending_records", { limit_count: 40 });
    if (error || !trendingRows || trendingRows.length === 0) return [];

    const topIds = (trendingRows as { record_id: string; collector_count: number }[]).map(r => r.record_id);
    const countMap = new Map(
      (trendingRows as { record_id: string; collector_count: number }[]).map(r => [r.record_id, r.collector_count]),
    );

    const { data: records } = await supabase
      .from("records")
      .select("id, artist, album, cover_url, year, genre")
      .in("id", topIds)
      .not("album", "is", null)
      .neq("album", "");

    if (!records) return [];

    return topIds
      .map(id => {
        const rec = records.find(r => r.id === id);
        if (!rec) return null;
        return {
          id,
          artist: rec.artist,
          album: rec.album,
          coverUrl: rec.cover_url,
          year: rec.year,
          genre: rec.genre,
          collectorCount: countMap.get(id)!,
        };
      })
      .filter(Boolean);
  },
  ["trending-records"],
  { revalidate: 86400 },
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const records = await getCachedTrending();
  return Response.json({ records });
}
