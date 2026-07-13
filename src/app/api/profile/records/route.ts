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

const PAGE = 1000; // PostgREST hard max per request
const BATCH = 400; // safe IN-clause size for records lookups

async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  // Fetch first page, then fan out remaining pages in parallel
  const first = await query(0, PAGE - 1);
  const items = first.data ?? [];
  if (items.length < PAGE) return items;

  // We got a full page — there may be more. Fetch up to 9 more pages (10k total).
  const extras = await Promise.all(
    Array.from({ length: 9 }, (_, i) => query((i + 1) * PAGE, (i + 2) * PAGE - 1))
  );
  return [...items, ...extras.flatMap(r => r.data ?? [])];
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabase as any;
    const recordIds = (
      await fetchAllPages<{ record_id: string }>((from, to) =>
        s.from("public_collection_summary").select("record_id").eq("user_id", userId).range(from, to)
      )
    ).map(r => r.record_id).filter(Boolean) as string[];

    if (recordIds.length === 0) return NextResponse.json({ items: [] });

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
        artist:   r.artist    ?? "",
        album:    r.album     ?? "",
        year:     r.year      ?? null,
        format:   r.format    ?? null,
        genre:    r.genre     ?? null,
        coverUrl: r.cover_url ?? null,
      }))
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album));

    return NextResponse.json({ items });
  } else {
    const { data: wantlistRow } = await supabase
      .from("lists")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", "wantlist")
      .maybeSingle();

    if (!wantlistRow) return NextResponse.json({ items: [] });

    const listId = wantlistRow.id as string;

    // Paginate through list_items — PostgREST caps single requests at 1000 rows
    const listItems = await fetchAllPages<{
      record_id: string | null;
      song_artist: string | null;
      song_album: string | null;
      song_cover_url: string | null;
    }>((from, to) =>
      supabase
        .from("list_items")
        .select("record_id, song_artist, song_album, song_cover_url")
        .eq("list_id", listId)
        .order("position", { ascending: true })
        .range(from, to)
    );

    if (!listItems.length) return NextResponse.json({ items: [] });

    const recIds = listItems.map(i => i.record_id).filter(Boolean) as string[];
    const recBatches = recIds.length > 0
      ? await Promise.all(
          Array.from({ length: Math.ceil(recIds.length / BATCH) }, (_, i) =>
            supabase.from("records").select("id, artist, album, year, format, genre, cover_url")
              .in("id", recIds.slice(i * BATCH, (i + 1) * BATCH))
          )
        )
      : [];
    const recById = new Map(
      recBatches.flatMap(b => b.data ?? []).map(r => [r.id, r])
    );

    const items: ProfileRecord[] = listItems
      .map(item => {
        const r = item.record_id ? recById.get(item.record_id) : undefined;
        return {
          artist:   r?.artist       ?? item.song_artist    ?? "",
          album:    r?.album        ?? item.song_album     ?? "",
          year:     r?.year         ?? null,
          format:   r?.format       ?? null,
          genre:    r?.genre        ?? null,
          coverUrl: r?.cover_url    ?? item.song_cover_url ?? null,
        };
      })
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album));

    return NextResponse.json({ items });
  }
}
