import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";
import { UsernameSetupForm } from "./ProfilePageClient";
import type { UserList, ListSlot, SlotItem, DiscoverList } from "@/app/lists/types";

const SERIF  = "var(--font-editorial)";
const ORANGE = "#CC5500";

type Params = Promise<{ username: string }>;

const DEFAULT_TOP5: Array<{ title: string; slug: string }> = [
  { title: "Top 5 All Time",         slug: "top-5-all-time" },
  { title: "Top 5 Desert Island",    slug: "top-5-desert-island" },
  { title: "Top 5 Gateway Records",  slug: "top-5-gateway-records" },
];

const DEFAULT_PERSONAL: Array<{ title: string; slug: string }> = [
  { title: "Wantlist",         slug: "wantlist" },
  { title: "Need to Relisten", slug: "need-to-relisten" },
];

const PINNED_LISTS = ["Top 5 All Time", "Top 5 Records That Changed My Life", "Top 5 Most Played"];
function sortListsByPriority<T extends { title: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ai = PINNED_LISTS.indexOf(a.title);
    const bi = PINNED_LISTS.indexOf(b.title);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });
}

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;

  if (!rawHandle.startsWith("@")) notFound();
  const username = rawHandle.slice(1);

  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  type ProfileRow = {
    id: string; username: string; display_name: string | null;
    city: string | null; country: string | null; country_code: string | null;
    bio: string | null; avatar_url: string | null; is_donor: boolean;
    taste_summary: string | null; star_sign: string | null;
    bandcamp_username: string | null; role: string | null;
    spotify_connected: boolean | null; spotify_display_name: string | null;
    spotify_product: string | null;
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, city, country, country_code, bio, avatar_url, is_donor, taste_summary, star_sign, bandcamp_username, role, spotify_connected, spotify_display_name, spotify_product")
    .eq("username", username)
    .maybeSingle() as unknown as { data: ProfileRow | null };

  if (!profile) {
    if (viewer) {
      const { data: vp } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", viewer.id)
        .maybeSingle();
      if (!vp?.username) {
        return (
          <>
            <nav style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 40px" }}>
              <Link href="/" aria-label="rekōdo home" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, textDecoration: "none" }}>
                ō
              </Link>
            </nav>
            <main style={{ maxWidth: 860, margin: "0 auto", padding: "64px 40px 80px" }}>
              <UsernameSetupForm suggestedUsername={username} />
            </main>
          </>
        );
      }
    }
    notFound();
  }

  const isOwner = viewer?.id === profile.id;

  // Viewer profile for AppNav (skip extra query when viewer is the profile owner)
  let viewerNav: { username: string; displayName: string | null; avatarUrl: string | null } | null = null;
  if (viewer) {
    if (isOwner) {
      viewerNav = { username: profile.username ?? "", displayName: profile.display_name ?? null, avatarUrl: profile.avatar_url ?? null };
    } else {
      const { data: vp } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", viewer.id).maybeSingle();
      if (vp?.username) viewerNav = { username: vp.username, displayName: vp.display_name ?? null, avatarUrl: vp.avatar_url ?? null };
    }
  }

  // Parallel: user records + lists + follow counts
  const [userRecordsResult, listsResult, followerRes, followingRes] = await Promise.all([
    supabase.from("user_records").select("record_id").eq("user_id", profile.id),
    supabase.from("lists")
      .select("id, title, slug, list_type")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("created_at"),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
  ]);

  const userRecords    = userRecordsResult.data ?? [];

  const lists          = sortListsByPriority(listsResult.data ?? []);
  const followerCount  = followerRes.count  ?? 0;
  const followingCount = followingRes.count ?? 0;
  const totalRecords   = userRecords.length;
  const recordIds      = userRecords.map(r => r.record_id).filter(Boolean) as string[];
  const listIds        = lists.map(l => l.id);

  const [recordDetailsResult, listItemsResult] = await Promise.all([
    recordIds.length
      ? supabase.from("records").select("genre, country, label").in("id", recordIds)
      : Promise.resolve({ data: [] as { genre: string | null; country: string | null; label: string | null }[] }),
    listIds.length
      ? supabase.from("list_items")
          .select("list_id, position, item_type, record_id, song_cover_url, song_artist, song_album")
          .in("list_id", listIds)
          .order("position")
      : Promise.resolve({ data: [] }),
  ]);

  const details  = recordDetailsResult.data ?? [];
  const allItems = listItemsResult.data      ?? [];

  function topOf(arr: (string | null)[]): string | null {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const topGenre   = topOf(details.map(r => r.genre));
  const topCountry = topOf(details.map(r => r.country));
  const topLabel   = topOf(details.map(r => r.label));

  const itemRecordIds = allItems
    .filter(i => i.item_type !== "song" && i.record_id)
    .map(i => i.record_id as string);

  const { data: coverRecords } = itemRecordIds.length
    ? await supabase.from("records").select("id, cover_url, artist, album").in("id", itemRecordIds)
    : { data: [] };

  // ── Owner-only: full lists data for Lists tab ─────────────────────────────────

  let fullLists: UserList[] | null = null;

  if (isOwner && viewer) {
    const uid = viewer.id;

    for (const def of DEFAULT_TOP5) {
      const { error: e1 } = await supabase.from("lists").upsert(
        { user_id: uid, title: def.title, slug: def.slug, is_public: true, list_type: "top5" },
        { onConflict: "user_id,slug", ignoreDuplicates: true }
      );
      if (e1?.message?.includes("list_type")) {
        await supabase.from("lists").upsert(
          { user_id: uid, title: def.title, slug: def.slug, is_public: true },
          { onConflict: "user_id,slug", ignoreDuplicates: true }
        );
      }
    }
    const { data: hasWantlist } = await supabase
      .from("lists").select("id").eq("user_id", uid).eq("slug", "wantlist").maybeSingle();
    if (!hasWantlist) {
      await supabase.from("lists")
        .update({ title: "Wantlist", slug: "wantlist" })
        .eq("user_id", uid).eq("slug", "want-to-buy");
    }
    for (const def of DEFAULT_PERSONAL) {
      const { error: e2 } = await supabase.from("lists").upsert(
        { user_id: uid, title: def.title, slug: def.slug, is_public: false, list_type: "personal" },
        { onConflict: "user_id,slug", ignoreDuplicates: true }
      );
      if (e2?.message?.includes("list_type")) {
        await supabase.from("lists").upsert(
          { user_id: uid, title: def.title, slug: def.slug, is_public: false },
          { onConflict: "user_id,slug", ignoreDuplicates: true }
        );
      }
    }

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

    const fullListIds = listsRaw.map(l => l.id);

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
    if (fullListIds.length) {
      const { data: fullData, error: fullErr } = await supabase
        .from("list_items")
        .select("id, list_id, position, item_type, record_id, song_title, song_artist, song_album, song_cover_url, song_year, note, priority, price_cap, pressing_tip, found, created_at, source, discogs_release_id")
        .in("list_id", fullListIds).order("position");
      if (!fullErr) {
        itemsData = (fullData ?? []) as unknown as ItemRow[];
      } else {
        const { data: tier2, error: tier2Err } = await supabase
          .from("list_items")
          .select("id, list_id, position, item_type, record_id, song_title, song_artist, song_album, song_cover_url, song_year, note, priority")
          .in("list_id", fullListIds).order("position");
        if (!tier2Err) {
          itemsData = ((tier2 ?? []) as unknown as Record<string, unknown>[]).map(i => ({ ...i, price_cap: null, pressing_tip: null, found: null, created_at: null, source: null, discogs_release_id: null })) as unknown as ItemRow[];
        } else {
          const { data: fallback } = await supabase
            .from("list_items").select("id, list_id, position, record_id").in("list_id", fullListIds).order("position");
          itemsData = (fallback ?? []).map(i => ({ ...i, item_type: "record", song_title: null, song_artist: null, song_album: null, song_cover_url: null, song_year: null, note: null, priority: null, price_cap: null, pressing_tip: null, found: null, created_at: null, source: null, discogs_release_id: null }));
        }
      }
    }

    const fullRecordIds = [...new Set(
      itemsData.filter(i => i.item_type !== "song" && i.record_id).map(i => i.record_id as string)
    )];
    const { data: recordsData } = fullRecordIds.length
      ? await supabase.from("records").select("id, artist, album, year, genre, cover_url").in("id", fullRecordIds)
      : { data: [] };

    const recordById = new Map((recordsData ?? []).map(r => [r.id, r]));

    fullLists = listsRaw.map(l => {
      const listType  = (l.list_type ?? "top5") as "top5" | "personal";
      const listItems = itemsData.filter(i => i.list_id === l.id);
      const maxPos    = listType === "top5" ? 5 : listItems.length > 0 ? Math.max(...listItems.map(i => i.position)) : 0;

      const slots: ListSlot[] = Array.from({ length: maxPos }, (_, idx) => {
        const pos  = idx + 1;
        const item = listItems.find(i => i.position === pos);
        if (!item) return { position: pos, item: null };

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
            position: pos,
            item: { id: item.id, item_type: "song", artist: item.song_artist ?? "", album: item.song_album ?? "", year: item.song_year ?? null, genre: null, cover_url: item.song_cover_url ?? null, song_title: item.song_title } satisfies SlotItem,
            ...slotMeta,
          };
        }

        const r = item.record_id ? recordById.get(item.record_id) : undefined;
        if (!r && !item.song_artist) return { position: pos, item: null };
        if (!r) {
          return {
            position: pos,
            item: { id: item.id, item_type: "record", artist: item.song_artist ?? "", album: item.song_album ?? "", year: item.song_year ?? null, genre: null, cover_url: item.song_cover_url ?? null, song_title: null } satisfies SlotItem,
            ...slotMeta,
          };
        }
        return {
          position: pos,
          item: { id: r.id, item_type: "record", artist: r.artist, album: r.album, year: r.year ?? null, genre: r.genre ?? null, cover_url: r.cover_url ?? null, song_title: null } satisfies SlotItem,
          ...slotMeta,
        };
      });

      return { id: l.id, title: l.title, slug: l.slug, is_public: l.is_public, list_type: listType, slots };
    });
    fullLists = sortListsByPriority(fullLists);
  }

  // ── Bandcamp sync stats (owner only) ─────────────────────────────────────────
  let bcSyncTotal = 0;
  let bcSyncDuplicates = 0;
  let bcSyncDate: string | null = null;
  if (isOwner && viewer) {
    type DiRow = { is_duplicate: boolean; imported_at: string };
    const { data: diRows } = await supabase
      .from("digital_imports")
      .select("is_duplicate, imported_at")
      .eq("user_id", viewer.id)
      .eq("source", "bandcamp");
    const diAll = (diRows ?? []) as DiRow[];
    bcSyncTotal      = diAll.length;
    bcSyncDuplicates = diAll.filter(r => r.is_duplicate).length;
    bcSyncDate       = diAll.length > 0
      ? diAll.reduce((latest, r) => r.imported_at > latest ? r.imported_at : latest, diAll[0].imported_at)
      : null;
  }

  // ── Discover lists for Community tab ─────────────────────────────────────────

  const excludeId     = viewer?.id ?? profile.id;
  const discoverLists: DiscoverList[] = [];
  try {
    const { data: pubLists } = await supabase
      .from("lists")
      .select("id, title, slug, user_id")
      .eq("is_public", true)
      .neq("user_id", excludeId)
      .order("created_at", { ascending: false })
      .limit(24);

    if (pubLists && pubLists.length > 0) {
      const pubListIds = pubLists.map(l => l.id);
      const pubUserIds = [...new Set(pubLists.map(l => l.user_id))];

      const [{ data: pubProfiles }, { data: pubItems }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name").in("id", pubUserIds),
        supabase.from("list_items").select("list_id, position, record_id").in("list_id", pubListIds).order("position"),
      ]);

      const profileById  = new Map((pubProfiles ?? []).map(p => [p.id, p]));
      const pubRecordIds = [...new Set((pubItems ?? []).map(i => i.record_id).filter(Boolean) as string[])];
      const { data: pubRecords } = pubRecordIds.length
        ? await supabase.from("records").select("id, cover_url").in("id", pubRecordIds)
        : { data: [] };
      const coverById = new Map((pubRecords ?? []).map(r => [r.id, r.cover_url]));

      for (const l of pubLists) {
        const p = profileById.get(l.user_id);
        if (!p) continue;
        const items  = (pubItems ?? []).filter(i => i.list_id === l.id).sort((a, b) => a.position - b.position);
        const covers = items.slice(0, 4).map(i => (i.record_id ? coverById.get(i.record_id) ?? null : null));
        discoverLists.push({ id: l.id, title: l.title, slug: l.slug, username: p.username, displayName: p.display_name ?? null, covers, itemCount: items.length, saveCount: 0 });
      }
    }
  } catch { /* non-fatal */ }

  return (
    <ProfileClient
      profile={{
        id:                profile.id,
        username:          profile.username          ?? "",
        display_name:      profile.display_name      ?? null,
        city:              profile.city              ?? null,
        country:           profile.country           ?? null,
        country_code:      profile.country_code      ?? null,
        bio:               profile.bio               ?? null,
        avatar_url:        profile.avatar_url        ?? null,
        is_donor:          profile.is_donor          ?? false,
        taste_summary:     profile.taste_summary     ?? null,
        star_sign:         profile.star_sign         ?? null,
        bandcamp_username:     profile.bandcamp_username     ?? null,
        role:                 profile.role                 ?? null,
        spotify_connected:    profile.spotify_connected    ?? false,
        spotify_display_name: profile.spotify_display_name ?? null,
        spotify_product:      profile.spotify_product      ?? null,
      }}
      isOwner={isOwner}
      totalRecords={totalRecords}
      topGenre={topGenre}
      topCountry={topCountry}
      topLabel={topLabel}
      lists={lists}
      listItems={allItems}
      coverRecords={coverRecords ?? []}
      followerCount={followerCount}
      followingCount={followingCount}
      viewer={viewerNav}
      fullLists={fullLists ?? undefined}
      discoverLists={discoverLists}
      bcSyncTotal={bcSyncTotal}
      bcSyncDuplicates={bcSyncDuplicates}
      bcSyncDate={bcSyncDate}
    />
  );
}
