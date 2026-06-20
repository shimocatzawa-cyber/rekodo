import { createClient } from "@/lib/supabase/server";
import type { UserList, ListSlot, SlotItem } from "@/app/lists/types";

export const dynamic = "force-dynamic";

// PostgREST caps results at 1000 rows per request; wantlists can exceed that,
// so page through with .range() until a page comes back short.
const PAGE_SIZE = 1000;

async function fetchAllListItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listIds: string[],
  select: string,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("list_items")
      .select(select)
      .in("list_id", listIds)
      .order("position")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const uid = user.id;

  // Fetch lists with list_type fallback
  let listsRaw: Array<{ id: string; title: string; slug: string; is_public: boolean; list_type?: string }> = [];
  {
    const { data, error } = await supabase
      .from("lists")
      .select("id, title, slug, is_public, list_type")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    if (error?.message?.includes("list_type")) {
      const { data: fallback } = await supabase
        .from("lists").select("id, title, slug, is_public").eq("user_id", uid).order("created_at", { ascending: true });
      listsRaw = (fallback ?? []).map(l => ({ ...l, list_type: "top5" }));
    } else {
      listsRaw = data ?? [];
    }
  }

  if (listsRaw.length === 0) return Response.json({ lists: [] });

  const listIds = listsRaw.map(l => l.id);

  type ItemRow = {
    id: string; list_id: string; position: number;
    item_type: string; record_id: string | null;
    song_title: string | null; song_artist: string | null;
    song_album: string | null; song_cover_url: string | null; song_year: number | null;
    note: string | null; priority: string | null;
    price_cap: number | null; pressing_tip: string | null;
    found: boolean | null; created_at: string | null;
    source: string | null; discogs_release_id: number | null;
  };

  let itemsData: ItemRow[] = [];
  {
    const { data: full, error: fullErr } = await fetchAllListItems(
      supabase, listIds,
      "id, list_id, position, item_type, record_id, song_title, song_artist, song_album, song_cover_url, song_year, note, priority, price_cap, pressing_tip, found, created_at, source, discogs_release_id",
    );
    if (!fullErr) {
      itemsData = (full ?? []) as unknown as ItemRow[];
    } else {
      const { data: tier2, error: tier2Err } = await fetchAllListItems(
        supabase, listIds,
        "id, list_id, position, item_type, record_id, song_title, song_artist, song_album, song_cover_url, song_year, note, priority",
      );
      if (!tier2Err) {
        itemsData = ((tier2 ?? []) as unknown as Record<string, unknown>[]).map(i => ({
          ...i, price_cap: null, pressing_tip: null, found: null, created_at: null, source: null, discogs_release_id: null,
        })) as unknown as ItemRow[];
      } else {
        const { data: fallback } = await fetchAllListItems(supabase, listIds, "id, list_id, position, record_id");
        itemsData = (fallback ?? []).map(i => ({
          ...i, item_type: "record", song_title: null, song_artist: null, song_album: null,
          song_cover_url: null, song_year: null, note: null, priority: null,
          price_cap: null, pressing_tip: null, found: null, created_at: null, source: null, discogs_release_id: null,
        })) as unknown as ItemRow[];
      }
    }
  }

  const recordIds = [...new Set(
    itemsData.filter(i => i.item_type !== "song" && i.record_id).map(i => i.record_id as string)
  )];
  const { data: recordsData } = recordIds.length
    ? await supabase.from("records").select("id, artist, album, year, genre, cover_url").in("id", recordIds)
    : { data: [] };
  const recordById = new Map((recordsData ?? []).map(r => [r.id, r]));

  const lists: UserList[] = listsRaw.map(l => {
    const isWantlist = l.slug === "wantlist" || l.slug === "want-to-buy";
    const listType   = (isWantlist ? "personal" : (l.list_type ?? "top5")) as "top5" | "personal";
    const listItems = itemsData.filter(i => i.list_id === l.id);

    function buildSlot(item: typeof listItems[0]): ListSlot {
      const slotMeta = {
        note: item.note ?? null,
        priority: (item.priority as ListSlot["priority"]) ?? null,
        price_cap: item.price_cap ?? null,
        pressing_tip: item.pressing_tip ?? null,
        found: item.found ?? false,
        created_at: item.created_at ?? null,
        source: item.source ?? null,
        discogs_release_id: item.discogs_release_id ?? null,
      };
      if (item.item_type === "song") {
        return {
          position: item.position,
          item: {
            id: item.id, item_type: "song",
            artist: item.song_artist ?? "", album: item.song_album ?? "",
            year: item.song_year ?? null, genre: null,
            cover_url: item.song_cover_url ?? null, song_title: item.song_title,
          } satisfies SlotItem,
          ...slotMeta,
        };
      }
      const r = item.record_id ? recordById.get(item.record_id) : undefined;
      if (!r && !item.song_artist) return { position: item.position, item: null };
      if (!r) {
        return {
          position: item.position,
          item: {
            id: item.id, item_type: "record",
            artist: item.song_artist ?? "", album: item.song_album ?? "",
            year: item.song_year ?? null, genre: null,
            cover_url: item.song_cover_url ?? null, song_title: null,
          } satisfies SlotItem,
          ...slotMeta,
        };
      }
      return {
        position: item.position,
        item: {
          id: r.id, item_type: "record",
          artist: r.artist, album: r.album,
          year: r.year ?? null, genre: r.genre ?? null,
          cover_url: r.cover_url ?? null, song_title: null,
        } satisfies SlotItem,
        ...slotMeta,
      };
    }

    let slots: ListSlot[];
    if (isWantlist) {
      // Return every item — no dedup by position so nothing is hidden
      slots = [...listItems].sort((a, b) => a.position - b.position).map(buildSlot);
    } else {
      const maxPos = listType === "top5" ? 5 : listItems.length > 0 ? Math.max(...listItems.map(i => i.position)) : 0;
      slots = Array.from({ length: maxPos }, (_, idx) => {
        const pos  = idx + 1;
        const item = listItems.find(i => i.position === pos);
        if (!item) return { position: pos, item: null };
        return buildSlot(item);
      });
    }

    return { id: l.id, title: l.title, slug: l.slug, is_public: l.is_public, list_type: listType, slots };
  });

  return Response.json({ lists });
}
