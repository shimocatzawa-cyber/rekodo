import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ListsClient from "@/components/lists/ListsClient";

// ─── Discover type ─────────────────────────────────────────────────────────────

export type DiscoverList = {
  id: string;
  title: string;
  slug: string;
  username: string;
  displayName: string | null;
  covers: (string | null)[];
  itemCount: number;
  saveCount: number;
};

// ─── Shared slot types ─────────────────────────────────────────────────────────

export type SlotItem = {
  id: string;            // record.id for records; list_items.id for songs
  item_type: "record" | "song";
  artist: string;
  album: string;         // album title (record) or parent album name (song)
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  song_title: string | null;  // null for records
};

export type ListSlot = {
  position: number;
  item: SlotItem | null;
};

export type UserList = {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
  list_type: "top5" | "personal";
  slots: ListSlot[];
};

// ─── Default lists ─────────────────────────────────────────────────────────────

const DEFAULT_TOP5: Array<{ title: string; slug: string }> = [
  { title: "Top 5 All Time",         slug: "top-5-all-time" },
  { title: "Top 5 Desert Island",    slug: "top-5-desert-island" },
  { title: "Top 5 Gateway Records",  slug: "top-5-gateway-records" },
];

const DEFAULT_PERSONAL: Array<{ title: string; slug: string }> = [
  { title: "Want to Buy",      slug: "want-to-buy" },
  { title: "Need to Relisten", slug: "need-to-relisten" },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ListsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";

  // Ensure profile row exists for brand-new users. ignoreDuplicates:true means
  // this is a no-op if the profile already exists (won't overwrite onboarding username).
  await supabase.from("profiles").upsert(
    { id: user.id, username: emailPrefix },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // Ensure default lists exist — include list_type if the migration has been applied,
  // fall back silently if the column doesn't exist yet.
  for (const def of DEFAULT_TOP5) {
    const { error: e1 } = await supabase.from("lists").upsert(
      { user_id: user.id, title: def.title, slug: def.slug, is_public: true, list_type: "top5" },
      { onConflict: "user_id,slug", ignoreDuplicates: true }
    );
    if (e1?.message?.includes("list_type")) {
      await supabase.from("lists").upsert(
        { user_id: user.id, title: def.title, slug: def.slug, is_public: true },
        { onConflict: "user_id,slug", ignoreDuplicates: true }
      );
    }
  }
  for (const def of DEFAULT_PERSONAL) {
    const { error: e2 } = await supabase.from("lists").upsert(
      { user_id: user.id, title: def.title, slug: def.slug, is_public: false, list_type: "personal" },
      { onConflict: "user_id,slug", ignoreDuplicates: true }
    );
    if (e2?.message?.includes("list_type")) {
      await supabase.from("lists").upsert(
        { user_id: user.id, title: def.title, slug: def.slug, is_public: false },
        { onConflict: "user_id,slug", ignoreDuplicates: true }
      );
    }
  }

  // Fetch profile (for share URLs + nav display)
  const { data: profile } = await supabase
    .from("profiles").select("username, display_name, avatar_url").eq("id", user.id).maybeSingle();
  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const rawUsername  = profile?.username ?? null;
  const username     = (rawUsername && rawUsername !== autoGen)
    ? rawUsername
    : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;

  // Fetch all lists — try with list_type (post-migration), fall back without it.
  let listsRaw: Array<{ id: string; title: string; slug: string; is_public: boolean; list_type?: string }> = [];
  {
    const { data, error } = await supabase
      .from("lists")
      .select("id, title, slug, is_public, list_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error?.message?.includes("list_type")) {
      const { data: fallback } = await supabase
        .from("lists")
        .select("id, title, slug, is_public")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      listsRaw = (fallback ?? []).map((l) => ({ ...l, list_type: "top5" }));
    } else {
      listsRaw = data ?? [];
    }
  }

  const listIds = listsRaw.map((l) => l.id);

  // Fetch all list items — try with song/type columns, fall back to basics.
  type ItemRow = {
    id: string; list_id: string; position: number;
    item_type: string; record_id: string | null;
    song_title: string | null; song_artist: string | null;
    song_album: string | null; song_cover_url: string | null; song_year: number | null;
  };

  let itemsData: ItemRow[] = [];
  if (listIds.length) {
    const { data, error } = await supabase
      .from("list_items")
      .select("id, list_id, position, item_type, record_id, song_title, song_artist, song_album, song_cover_url, song_year")
      .in("list_id", listIds)
      .order("position");
    if (error) {
      // New columns probably don't exist yet — fall back to old schema
      const { data: fallback } = await supabase
        .from("list_items")
        .select("id, list_id, position, record_id")
        .in("list_id", listIds)
        .order("position");
      itemsData = (fallback ?? []).map((i) => ({
        ...i,
        item_type: "record",
        song_title: null, song_artist: null, song_album: null,
        song_cover_url: null, song_year: null,
      }));
    } else {
      itemsData = (data ?? []) as ItemRow[];
    }
  }

  // Fetch records for record-type items
  const recordIds = [
    ...new Set(
      itemsData
        .filter((i) => i.item_type !== "song" && i.record_id)
        .map((i) => i.record_id as string)
    ),
  ];
  const { data: recordsData } = recordIds.length
    ? await supabase
        .from("records")
        .select("id, artist, album, year, genre, cover_url")
        .in("id", recordIds)
    : { data: [] };

  const recordById = new Map((recordsData ?? []).map((r) => [r.id, r]));

  // Assemble lists
  const lists: UserList[] = listsRaw.map((l) => {
    const listType = (l.list_type ?? "top5") as "top5" | "personal";
    const listItems = (itemsData ?? []).filter((i) => i.list_id === l.id);

    // Top5: always 5 numbered slots. Personal: slots = filled items (dense, no gaps).
    const maxPos = listType === "top5"
      ? 5
      : listItems.length > 0 ? Math.max(...listItems.map((i) => i.position)) : 0;

    const slots: ListSlot[] = Array.from({ length: maxPos }, (_, idx) => {
      const pos = idx + 1;
      const item = listItems.find((i) => i.position === pos);
      if (!item) return { position: pos, item: null };

      if (item.item_type === "song") {
        return {
          position: pos,
          item: {
            id: item.id,
            item_type: "song",
            artist: item.song_artist ?? "",
            album: item.song_album ?? "",
            year: item.song_year ?? null,
            genre: null,
            cover_url: item.song_cover_url ?? null,
            song_title: item.song_title,
          } satisfies SlotItem,
        };
      }

      const r = item.record_id ? recordById.get(item.record_id) : undefined;
      if (!r) return { position: pos, item: null };
      return {
        position: pos,
        item: {
          id: r.id,
          item_type: "record",
          artist: r.artist,
          album: r.album,
          year: r.year ?? null,
          genre: r.genre ?? null,
          cover_url: r.cover_url ?? null,
          song_title: null,
        } satisfies SlotItem,
      };
    });

    return {
      id: l.id,
      title: l.title,
      slug: l.slug,
      is_public: l.is_public,
      list_type: listType,
      slots,
    };
  });

  // ── Discover: other users' public lists ────────────────────────────────────
  const discoverLists: DiscoverList[] = [];
  try {
    const { data: pubLists } = await supabase
      .from("lists")
      .select("id, title, slug, user_id")
      .eq("is_public", true)
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(24);

    if (pubLists && pubLists.length > 0) {
      const pubListIds  = pubLists.map(l => l.id);
      const pubUserIds  = [...new Set(pubLists.map(l => l.user_id))];

      const [{ data: pubProfiles }, { data: pubItems }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name").in("id", pubUserIds),
        supabase.from("list_items").select("list_id, position, record_id").in("list_id", pubListIds).order("position"),
      ]);

      const profileById = new Map((pubProfiles ?? []).map(p => [p.id, p]));
      const pubRecordIds = [...new Set((pubItems ?? []).map(i => i.record_id).filter(Boolean) as string[])];
      const { data: pubRecords } = pubRecordIds.length
        ? await supabase.from("records").select("id, cover_url").in("id", pubRecordIds)
        : { data: [] };
      const coverById = new Map((pubRecords ?? []).map(r => [r.id, r.cover_url]));

      for (const l of pubLists) {
        const profile = profileById.get(l.user_id);
        if (!profile) continue;
        const items = (pubItems ?? []).filter(i => i.list_id === l.id).sort((a, b) => a.position - b.position);
        const covers = items.slice(0, 4).map(i => (i.record_id ? coverById.get(i.record_id) ?? null : null));
        discoverLists.push({
          id: l.id, title: l.title, slug: l.slug,
          username: profile.username, displayName: profile.display_name ?? null,
          covers, itemCount: items.length, saveCount: 0,
        });
      }
    }
  } catch { /* non-fatal — discover is best-effort */ }

  return (
    <ListsClient
      initialLists={lists}
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      discoverLists={discoverLists}
    />
  );
}
