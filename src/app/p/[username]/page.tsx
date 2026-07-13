import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "@/app/[username]/ProfileClient";
import { UsernameSetupForm } from "@/app/[username]/ProfilePageClient";
import { getOrComputeCompatibility } from "@/lib/compatibility";
import { getPublicEssentials } from "@/lib/essentials";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

const SERIF  = "var(--font-editorial)";
const ORANGE = "#CC5500";

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_url, city, country")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return { title: "Profile not found" };

  const name = profile.display_name?.trim() || username;

  // Profiles are members-only — tell crawlers not to index them
  return {
    title: `${name} (@${username}) · rekōdo`,
    robots: { index: false, follow: false },
  };
}

// Production: Vercel rewrites /@username → /p/username before routing.
// This page is what actually serves public profiles.
export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username } = await params;

  const supabase = await createClient();
  const viewer = await getUserWithTimeout(supabase);

  // Profiles are members-only — redirect unauthenticated visitors to login
  if (!viewer) {
    redirect("/login");
  }

  type ProfileRow = {
    id: string; username: string; display_name: string | null;
    city: string | null; country: string | null; country_code: string | null;
    bio: string | null; avatar_url: string | null; is_donor: boolean; is_supporter: boolean | null;
    taste_summary: string | null; star_sign: string | null;
    bandcamp_username: string | null; role: string | null;
    spotify_connected: boolean | null; spotify_display_name: string | null;
    spotify_product: string | null;
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, city, country, country_code, bio, avatar_url, is_donor, is_supporter, taste_summary, star_sign, bandcamp_username, role, spotify_connected, spotify_display_name, spotify_product")
    .eq("username", username)
    .maybeSingle() as { data: ProfileRow | null; error: unknown };

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

  // Visibility flags — queried separately so a stale PostgREST schema cache
  // (which may not know about newly-added columns) never 404s the whole page.
  const { data: visData } = await supabase
    .from("profiles")
    .select("collection_public, wantlist_public")
    .eq("id", profile.id)
    .maybeSingle();
  const collectionPublic = (visData as { collection_public?: boolean | null } | null)?.collection_public ?? true;
  const wantlistPublic   = (visData as { wantlist_public?:   boolean | null } | null)?.wantlist_public   ?? true;

  // Fetch viewer's own profile info for AppNav (skip extra query if owner)
  let viewerInfo: { username: string; displayName: string | null; avatarUrl: string | null } | null = null;
  if (viewer) {
    if (isOwner) {
      viewerInfo = { username: profile.username, displayName: profile.display_name, avatarUrl: profile.avatar_url };
    } else {
      const { data: vp } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", viewer.id)
        .maybeSingle();
      if (vp?.username) {
        viewerInfo = { username: vp.username, displayName: vp.display_name, avatarUrl: vp.avatar_url };
      }
    }
  }

  // Get exact collection count first, then paginate to fetch all IDs
  // (PostgREST's server-side max_rows cap of 1000 can't be overridden by .limit())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: collectionCount } = await (supabase as any)
    .from("public_collection_summary")
    .select("record_id", { count: "exact", head: true })
    .eq("user_id", profile.id);

  const PAGE = 1000;
  const pageCount = Math.ceil((collectionCount ?? 0) / PAGE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userRecordsPages, followerRes, followingRes, collectionPhotoRes, photoLikeCountRes, viewerLikedRes, essLikeCountRes, viewerEssLikedRes] = await Promise.all([
    pageCount > 0
      ? Promise.all(
          Array.from({ length: pageCount }, (_, i) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any).from("public_collection_summary")
              .select("record_id, copies")
              .eq("user_id", profile.id)
              .range(i * PAGE, (i + 1) * PAGE - 1)
          )
        )
      : Promise.resolve([]),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
    supabase.from("collection_photos").select("storage_path").eq("user_id", profile.id).eq("display_order", 1).maybeSingle(),
    supabase.from("collection_photo_likes").select("id", { count: "exact", head: true }).eq("photo_owner_id", profile.id),
    viewer && !isOwner
      ? supabase.from("collection_photo_likes").select("id", { count: "exact", head: true }).eq("photo_owner_id", profile.id).eq("liker_id", viewer.id)
      : Promise.resolve({ count: 0 }),
    supabase.from("essentials_wall_likes").select("id", { count: "exact", head: true }).eq("essentials_owner_id", profile.id),
    viewer && !isOwner
      ? supabase.from("essentials_wall_likes").select("id", { count: "exact", head: true }).eq("essentials_owner_id", profile.id).eq("liker_id", viewer.id)
      : Promise.resolve({ count: 0 }),
  ]);

  const userRecords = (userRecordsPages as { data: { record_id: string; copies: number }[] | null }[]).flatMap(p => p.data ?? []);
  const followerCount  = followerRes.count  ?? 0;
  const followingCount = followingRes.count ?? 0;

  const collectionPhotoPath = collectionPhotoRes.data?.storage_path ?? null;
  let collectionPhoto: string | null = null;
  if (collectionPhotoPath) {
    const { data: { publicUrl } } = supabase.storage.from("collection-photos").getPublicUrl(collectionPhotoPath);
    collectionPhoto = publicUrl;
  }
  const totalRecords   = collectionCount ?? 0;
  const recordIds      = (userRecords as { record_id: string }[]).map((r) => r.record_id).filter(Boolean) as string[];

  // Batch into groups of 400 to stay under PostgREST URL length limits
  const BATCH = 400;
  const detailBatches = recordIds.length > 0
    ? await Promise.all(
        Array.from({ length: Math.ceil(recordIds.length / BATCH) }, (_, i) =>
          supabase.from("records").select("id, genre, country, label, artist, year, format")
            .in("id", recordIds.slice(i * BATCH, (i + 1) * BATCH))
        )
      )
    : [];
  const details = detailBatches.flatMap(b => b.data ?? []) as { id: string; genre: string | null; country: string | null; label: string | null; artist: string | null; year: number | null; format: string | null }[];

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

  // Copies-weighted most collected artist — vinyl only, matching Insights topVinylArtist
  const VINYL_FMTS = new Set(["LP", "VINYL", "7\"", "10\"", "12\"", "EP"]);
  const artistCopies = new Map<string, number>();
  for (const r of details) {
    const fmt = r.format?.toUpperCase().trim() ?? "";
    if (!VINYL_FMTS.has(fmt)) continue;
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
        collection_public:    collectionPublic,
        wantlist_public:      wantlistPublic,
      }}
      isOwner={isOwner}
      isSupporter={isOwner ? !!(profile.is_supporter || profile.is_donor || profile.role === "admin") : false}
      totalRecords={totalRecords}
      topGenre={topGenre}
      topCountry={topCountry}
      topLabel={topLabel}
      topArtist={topArtist}
      topGenrePct={topGenrePct}
      collectionSpan={collectionSpan}
      followerCount={followerCount}
      followingCount={followingCount}
      viewer={viewerInfo}
      collectionPhoto={collectionPhoto}
      photoLikeCount={photoLikeCountRes.count ?? 0}
      photoLiked={(viewerLikedRes.count ?? 0) > 0}
      viewerId={viewer?.id ?? null}
      compatibility={compatibility ? { score: compatibility.score, styleScore: compatibility.styleScore ?? null, label: compatibility.label } : null}
      top5AllTime={top5AllTime}
      essentials={essentials}
      essentialsLikeCount={essLikeCountRes.count ?? 0}
      essentialsLiked={(viewerEssLikedRes.count ?? 0) > 0}
    />
  );
}
