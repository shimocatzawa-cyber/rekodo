import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Fetch all user_records to count how many collectors own each record
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

  // Count unique occurrences per record
  const counts = new Map<string, number>();
  for (const row of allRows) {
    counts.set(row.record_id, (counts.get(row.record_id) ?? 0) + 1);
  }

  // Top 40 records owned by the most collectors (min 2)
  const topIds = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([id]) => id);

  if (topIds.length === 0) return Response.json({ records: [] });

  const { data: records } = await supabase
    .from("records")
    .select("id, artist, album, cover_url, year, genre")
    .in("id", topIds)
    .not("album", "is", null)
    .neq("album", "");

  if (!records) return Response.json({ records: [] });

  const result = topIds
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

  return Response.json({ records: result });
}
