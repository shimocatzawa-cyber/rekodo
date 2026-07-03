import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export type TrendingRecord = {
  id: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  year: number | null;
  genre: string | null;
  collectorCount: number;
};

export const getCachedTrending = unstable_cache(
  async (): Promise<TrendingRecord[]> => {
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
      .filter((r): r is TrendingRecord => r !== null);
  },
  ["trending-records"],
  { revalidate: 86400 },
);
