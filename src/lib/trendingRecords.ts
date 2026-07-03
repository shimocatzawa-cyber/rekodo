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

    // Fetch top 200 pressings — fast single-table scan, no joins in SQL
    const { data: trendingRows, error } = await supabase.rpc("get_trending_records", { limit_count: 200 });
    if (error || !trendingRows || trendingRows.length === 0) return [];

    const rows = trendingRows as { record_id: string; collector_count: number }[];
    const topIds = rows.map(r => r.record_id);
    const countById = new Map(rows.map(r => [r.record_id, r.collector_count]));

    const { data: records } = await supabase
      .from("records")
      .select("id, artist, album, cover_url, year, genre")
      .in("id", topIds)
      .not("album", "is", null)
      .neq("album", "");

    if (!records) return [];

    // Aggregate by artist+album: sum collector counts across pressings,
    // keeping the most-collected pressing for cover art
    type AlbumAgg = { count: number; bestId: string; bestCount: number; artist: string; album: string; coverUrl: string | null; year: number | null; genre: string | null };
    const albumMap = new Map<string, AlbumAgg>();

    for (const rec of records) {
      const key = `${rec.artist}|||${rec.album}`;
      const cnt = countById.get(rec.id) ?? 0;
      const existing = albumMap.get(key);
      if (!existing) {
        albumMap.set(key, { count: cnt, bestId: rec.id, bestCount: cnt, artist: rec.artist, album: rec.album, coverUrl: rec.cover_url ?? null, year: rec.year ?? null, genre: rec.genre ?? null });
      } else {
        existing.count += cnt;
        if (cnt > existing.bestCount) {
          existing.bestId = rec.id;
          existing.bestCount = cnt;
          existing.coverUrl = rec.cover_url ?? null;
          existing.year = rec.year ?? null;
          existing.genre = rec.genre ?? null;
        }
      }
    }

    return [...albumMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 40)
      .map(a => ({
        id:             a.bestId,
        artist:         a.artist,
        album:          a.album,
        coverUrl:       a.coverUrl,
        year:           a.year,
        genre:          a.genre,
        collectorCount: a.count,
      }));
  },
  ["trending-records"],
  { revalidate: 86400 },
);
