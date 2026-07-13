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

  // Check auth first so we can skip the visibility query for owners.
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === userId;

  // Visibility gate — queried separately from the main profile select so a
  // stale PostgREST schema cache (which may not know newly-added columns) can't
  // break the whole route. Defaults to public on any error.
  if (!isOwner) {
    let collectionPublic = true;
    let wantlistPublic   = true;

    try {
      const { data: vis } = await supabase
        .from("profiles")
        .select("collection_public, wantlist_public")
        .eq("id", userId)
        .maybeSingle();

      if (vis) {
        const v = vis as { collection_public?: boolean | null; wantlist_public?: boolean | null };
        collectionPublic = v.collection_public ?? true;
        wantlistPublic   = v.wantlist_public   ?? true;
      }
    } catch { /* stale schema — treat as public */ }

    if (type === "collection" && !collectionPublic) {
      return NextResponse.json({ private: true, items: [] });
    }
    if (type === "wantlist" && !wantlistPublic) {
      return NextResponse.json({ private: true, items: [] });
    }
  }

  if (type === "collection") {
    // Use public_collection_summary — same view the profile page uses, works
    // under RLS for both owners and non-owners.
    const PAGE = 1000;
    const [page1, page2] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("public_collection_summary").select("record_id").eq("user_id", userId).range(0, PAGE - 1),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("public_collection_summary").select("record_id").eq("user_id", userId).range(PAGE, PAGE * 2 - 1),
    ]);

    const recordIds = [
      ...(page1.data ?? []).map((r: { record_id: string }) => r.record_id),
      ...(page2.data ?? []).map((r: { record_id: string }) => r.record_id),
    ].filter(Boolean) as string[];

    if (recordIds.length === 0) return NextResponse.json({ items: [] });

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
        artist:   r.artist   ?? "",
        album:    r.album    ?? "",
        year:     r.year     ?? null,
        format:   r.format   ?? null,
        genre:    r.genre    ?? null,
        coverUrl: r.cover_url ?? null,
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
      artist:   r.artist           ?? "",
      album:    r.title            ?? "",
      year:     r.released         ?? null,
      format:   r.format           ?? null,
      genre:    null,
      coverUrl: r.cover_image_url  ?? null,
    }));

    return NextResponse.json({ items });
  }
}
