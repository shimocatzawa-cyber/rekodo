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

    // RPC now returns artist+album aggregated across all pressings; record_id is the most-collected pressing
    const rows = trendingRows as { record_id: string; artist: string; album: string; collector_count: number }[];
    const topIds = rows.map(r => r.record_id);

    const { data: meta } = await supabase
      .from("records")
      .select("id, cover_url, year, genre")
      .in("id", topIds);

    const metaMap = new Map((meta ?? []).map(r => [r.id, r]));

    return rows.map(row => {
      const m = metaMap.get(row.record_id);
      return {
        id:             row.record_id,
        artist:         row.artist,
        album:          row.album,
        coverUrl:       m?.cover_url ?? null,
        year:           m?.year ?? null,
        genre:          m?.genre ?? null,
        collectorCount: row.collector_count,
      };
    });
  },
  ["trending-records"],
  { revalidate: 86400 },
);
