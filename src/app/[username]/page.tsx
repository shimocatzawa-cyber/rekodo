import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";
import { UsernameSetupForm } from "./ProfilePageClient";
import type { DiscoverList } from "@/app/lists/types";
import { getOrComputeCompatibility } from "@/lib/compatibility";
import { getPublicEssentials } from "@/lib/essentials";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

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

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;

  if (!rawHandle.startsWith("@")) notFound();
  const username = rawHandle.slice(1);

  const supabase = await createClient();
  const viewer = await getUserWithTimeout(supabase);

  type ProfileRow = {
    id: string; username: string; display_name: string | null;
    city: string | null; country: string | null; country_code: string | null;
    bio: string | null; avatar_url: string | null; is_donor: boolean; is_supporter: boolean | null;
    taste_summary: string | null; star_sign: string | null;
    bandcamp_username: string | null; role: string | null;
    spotify_connected: boolean | null; spotify_display_name: string | null;
    spotify_product: string | null;
  };

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, city, country, country_code, bio, avatar_url, is_donor, is_supporter, taste_summary, star_sign, bandcamp_username, role, spotify_connected, spotify_display_name, spotify_product")
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
  // Show password form for all owners — if a pure OAuth account tries to set
  // one, supabase.auth.updateUser returns a clear error that we surface inline.
  const hasPassword = isOwner;

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

  // Parallel: user records + follow counts + collection photo
  const [userRecordsResult, followerRes, followingRes, collectionPhotoRes, photoLikeCountRes, viewerLikedRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("public_collection_summary").select("record_id, copies").eq("user_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
    supabase.from("collection_photos").select("storage_path").eq("user_id", profile.id).eq("display_order", 1).maybeSingle(),
    supabase.from("collection_photo_likes").select("id", { count: "exact", head: true }).eq("photo_owner_id", profile.id),
    viewer && !isOwner
      ? supabase.from("collection_photo_likes").select("id", { count: "exact", head: true }).eq("photo_owner_id", profile.id).eq("liker_id", viewer.id)
      : Promise.resolve({ count: 0 }),
  ]);

  const userRecords    = userRecordsResult.data ?? [];

  const followerCount  = followerRes.count  ?? 0;
  const followingCount = followingRes.count ?? 0;

  const collectionPhotoPath = collectionPhotoRes.data?.storage_path ?? null;
  let collectionPhoto: string | null = null;
  if (collectionPhotoPath) {
    const { data: { publicUrl } } = supabase.storage.from("collection-photos").getPublicUrl(collectionPhotoPath);
    collectionPhoto = publicUrl;
  }
  const totalRecords   = (userRecords as { record_id: string }[]).length;
  const recordIds      = (userRecords as { record_id: string }[]).map((r) => r.record_id).filter(Boolean) as string[];

  // Batch into groups of 400 to stay under PostgREST URL length limits
  const BATCH = 400;
  const detailBatches = recordIds.length > 0
    ? await Promise.all(
        Array.from({ length: Math.ceil(recordIds.length / BATCH) }, (_, i) =>
          supabase.from("records").select("id, genre, country, label, artist, year")
            .in("id", recordIds.slice(i * BATCH, (i + 1) * BATCH))
        )
      )
    : [];
  const details = detailBatches.flatMap(b => b.data ?? []) as { id: string; genre: string | null; country: string | null; label: string | null; artist: string | null; year: number | null }[];

  // Build a copies map so stats are copies-weighted (matching Insights page)
  const copiesMap = new Map((userRecords as { record_id: string; copies: number }[]).map(r => [r.record_id, r.copies ?? 1]));

  function topOf(arr: (string | null)[]): string | null {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const topCountry = topOf(details.map(r => r.country));
  const topLabel   = topOf(details.map(r => r.label));

  // Copies-weighted genre
  const genreCopies = new Map<string, number>();
  let totalCopiesForGenre = 0;
  for (const r of details) {
    const copies = copiesMap.get(r.id) ?? 1;
    totalCopiesForGenre += copies;
    if (r.genre && r.genre !== "Unknown") genreCopies.set(r.genre, (genreCopies.get(r.genre) ?? 0) + copies);
  }
  const topGenreEntry = [...genreCopies.entries()].sort((a, b) => b[1] - a[1])[0];
  const topGenre    = topGenreEntry?.[0] ?? null;
  const topGenrePct = topGenre && totalCopiesForGenre > 0
    ? Math.round((topGenreEntry![1] / totalCopiesForGenre) * 100)
    : null;

  // Copies-weighted most collected artist
  const artistCopies = new Map<string, number>();
  for (const r of details) {
    const copies = copiesMap.get(r.id) ?? 1;
    const artist = r.artist?.trim();
    if (!artist || artist === "Unknown" || artist === "Various") continue;
    artistCopies.set(artist, (artistCopies.get(artist) ?? 0) + copies);
  }
  const topArtist = [...artistCopies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const validYears = details.map(r => r.year).filter((y): y is number => !!y && y > 1900 && y <= 2030);
  const collectionSpan = validYears.length > 0
    ? (Math.min(...validYears) === Math.max(...validYears)
      ? String(Math.min(...validYears))
      : `${Math.min(...validYears)} → ${Math.max(...validYears)}`)
    : null;

  // ── Owner-only: ensure default lists exist (Lists tab fetches its own data
  // client-side via ProfileListsTab — this no longer needs to build a result
  // here, just make sure the default rows/slug migration are in place) ───────

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

  // ── Top 5 All Time ────────────────────────────────────────────────────────────
  const top5AllTime = await (async () => {
    const { data: list } = await supabase.from("lists").select("id").eq("user_id", profile.id).eq("slug", "top-5-all-time").maybeSingle();
    if (!list) return null;
    const { data: items } = await supabase
      .from("list_items")
      .select("position, record_id, item_type, song_artist, song_album, song_cover_url")
      .eq("list_id", list.id)
      .order("position")
      .limit(5);
    if (!items?.length) return null;
    const recIds = items.map(i => i.record_id).filter(Boolean) as string[];
    const { data: recs } = recIds.length
      ? await supabase.from("records").select("id, artist, album, cover_url").in("id", recIds)
      : { data: [] as { id: string; artist: string; album: string; cover_url: string | null }[] };
    const recById = new Map((recs ?? []).map(r => [r.id, r]));
    return items.map(item => {
      if (item.record_id) {
        const r = recById.get(item.record_id);
        return { position: item.position, artist: r?.artist ?? "", album: r?.album ?? "", coverUrl: r?.cover_url ?? null };
      }
      return { position: item.position, artist: item.song_artist ?? "", album: item.song_album ?? "", coverUrl: item.song_cover_url ?? null };
    });
  })();

  const [compatibility, essentials] = await Promise.all([
    viewer && !isOwner ? getOrComputeCompatibility(supabase, viewer.id, profile.id) : Promise.resolve(null),
    getPublicEssentials(supabase, profile.id),
  ]);

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
        is_supporter:      profile.is_supporter      ?? false,
        taste_summary:     profile.taste_summary     ?? null,
        star_sign:         profile.star_sign         ?? null,
        bandcamp_username:     profile.bandcamp_username     ?? null,
        role:                 profile.role                 ?? null,
        spotify_connected:    profile.spotify_connected    ?? false,
        spotify_display_name: profile.spotify_display_name ?? null,
        spotify_product:      profile.spotify_product      ?? null,
      }}
      isOwner={isOwner}
      isSupporter={!!(profile.is_supporter || profile.is_donor || profile.role === "admin")}
      totalRecords={totalRecords}
      topGenre={topGenre}
      topCountry={topCountry}
      topLabel={topLabel}
      topArtist={topArtist}
      topGenrePct={topGenrePct}
      collectionSpan={collectionSpan}
      followerCount={followerCount}
      followingCount={followingCount}
      viewer={viewerNav}
      collectionPhoto={collectionPhoto}
      photoLikeCount={photoLikeCountRes.count ?? 0}
      photoLiked={(viewerLikedRes.count ?? 0) > 0}
      viewerId={viewer?.id ?? null}
      compatibility={compatibility ? { score: compatibility.score, styleScore: compatibility.styleScore ?? null, label: compatibility.label } : null}
      top5AllTime={top5AllTime}
      essentials={essentials}
      bcSyncTotal={bcSyncTotal}
      bcSyncDuplicates={bcSyncDuplicates}
      bcSyncDate={bcSyncDate}
      hasPassword={hasPassword}
    />
  );
}
