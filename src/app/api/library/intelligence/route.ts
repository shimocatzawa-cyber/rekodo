import { createClient } from "@/lib/supabase/server";
import { computeCollectionIntelligence } from "@/lib/library/intelligence";

export const dynamic = "force-dynamic";

const BATCH = 400;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  const recordIds = (links ?? []).map((l) => l.record_id);
  if (recordIds.length === 0) {
    return Response.json({ error: "No collection found" }, { status: 400 });
  }

  type RecordRow = {
    id: string;
    artist: string;
    album: string;
    year: number | null;
    genre: string | null;
    label: string | null;
    country: string | null;
  };
  const recordMap = new Map<string, RecordRow>();
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, artist, album, year, genre, label, country")
      .in("id", recordIds.slice(i, i + BATCH));
    for (const r of data ?? []) recordMap.set(r.id, r as RecordRow);
  }

  const collection = recordIds
    .map((id) => recordMap.get(id))
    .filter((r): r is RecordRow => r !== undefined);

  try {
    await computeCollectionIntelligence(supabase, user.id, collection);
    return Response.json({ ok: true, recordCount: collection.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Intelligence error: ${msg}` }, { status: 500 });
  }
}
