import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ProfileRecord = {
  artist:   string;
  album:    string;
  year:     number | null;
  format:   string | null;
  genre:    string | null;
  coverUrl: string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId") ?? "";
  const type   = searchParams.get("type")   ?? "";

  if (!userId || (type !== "collection" && type !== "wantlist")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("collection_public, wantlist_public")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === userId;

  if (!isOwner) {
    if (type === "collection" && !profile.collection_public) {
      return NextResponse.json({ private: true, items: [] });
    }
    if (type === "wantlist" && !profile.wantlist_public) {
      return NextResponse.json({ private: true, items: [] });
    }
  }

  if (type === "collection") {
    // Fetch record IDs from user_records (paginated — PostgREST cap is 1000/page)
    const PAGE = 1000;
    const [page1, page2] = await Promise.all([
      supabase.from("user_records").select("record_id").eq("user_id", userId).range(0, PAGE - 1),
      supabase.from("user_records").select("record_id").eq("user_id", userId).range(PAGE, PAGE * 2 - 1),
    ]);

    const recordIds = [
      ...(page1.data ?? []).map(r => r.record_id),
      ...(page2.data ?? []).map(r => r.record_id),
    ].filter(Boolean) as string[];

    if (recordIds.length === 0) return NextResponse.json({ items: [] });

    // Batch record detail fetches to stay under PostgREST URL length limits
    const BATCH = 400;
    const batches = await Promise.all(
      Array.from({ length: Math.ceil(recordIds.length / BATCH) }, (_, i) =>
        supabase
          .from("records")
          .select("artist, album, year, format, genre, cover_url")
          .in("id", recordIds.slice(i * BATCH, (i + 1) * BATCH))
      )
    );

    const items: ProfileRecord[] = batches
      .flatMap(b => b.data ?? [])
      .map(r => ({
        artist:   r.artist,
        album:    r.album,
        year:     r.year,
        format:   r.format,
        genre:    r.genre,
        coverUrl: r.cover_url,
      }))
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album));

    return NextResponse.json({ items });
  } else {
    const { data, error } = await supabase
      .from("wantlist")
      .select("artist, title, released, format, cover_image_url")
      .eq("user_id", userId)
      .order("artist", { ascending: true })
      .limit(2000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items: ProfileRecord[] = (data ?? []).map(r => ({
      artist:   r.artist,
      album:    r.title,
      year:     r.released,
      format:   r.format,
      genre:    null, // wantlist rows don't store genre
      coverUrl: r.cover_image_url,
    }));

    return NextResponse.json({ items });
  }
}
