import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Trending is global (same result for every user) and changes slowly — recompute
// at most once per hour rather than doing a full user_records table scan per request.
const getCachedTrending = unstable_cache(
  async () => {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    let allRows: { record_id: string }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from("user_records")
        .select("record_id")
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const counts = new Map<string, number>();
    for (const row of allRows) {
      counts.set(row.record_id, (counts.get(row.record_id) ?? 0) + 1);
    }

    const topIds = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([id]) => id);

    if (topIds.length === 0) return [];

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
          collectorCount: counts.get(id)!,
        };
      })
      .filter(Boolean);
  },
  ["trending-records"],
  { revalidate: 3600 },
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const records = await getCachedTrending();
  return Response.json({ records });
}
