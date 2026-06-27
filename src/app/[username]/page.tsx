import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";
import { UsernameSetupForm } from "./ProfilePageClient";
import type { DiscoverList } from "@/app/lists/types";
import { getOrComputeCompatibility } from "@/lib/compatibility";
import { getPublicEssentials } from "@/lib/essentials";

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
  const { data: { user: viewer } } = await supabase.auth.getUser();

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
  const [userRecordsResult, followerRes, followingRes, collectionPhotoRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("public_collection_summary").select("record_id").eq("user_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
    supabase.from("collection_photos").select("storage_path").eq("user_id", profile.id).eq("display_order", 1).maybeSingle(),
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
  const totalRecords   = userRecords.length;
  const recordIds      = userRecords.map((r: { record_id: string }) => r.record_id).filter(Boolean) as string[];

  const recordDetailsResult = recordIds.length
    ? await supabase.from("records").select("genre, country, label").in("id", recordIds)
    : { data: [] as { genre: string | null; country: string | null; label: string | null }[] };

  const details = recordDetailsResult.data ?? [];

  function topOf(arr: (string | null)[]): string | null {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const topGenre   = topOf(details.map(r => r.genre));
  const topCountry = topOf(details.map(r => r.country));
  const topLabel   = topOf(details.map(r => r.label));

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
      followerCount={followerCount}
      followingCount={followingCount}
      viewer={viewerNav}
      collectionPhoto={collectionPhoto}
      compatibility={compatibility ? { score: compatibility.score, label: compatibility.label } : null}
      essentials={essentials}
      bcSyncTotal={bcSyncTotal}
      bcSyncDuplicates={bcSyncDuplicates}
      bcSyncDate={bcSyncDate}
    />
  );
}
