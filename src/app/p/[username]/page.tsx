import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "@/app/[username]/ProfileClient";
import { UsernameSetupForm } from "@/app/[username]/ProfilePageClient";

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
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const description = profile.bio?.trim()
    || `Explore ${name}'s vinyl collection on rekōdo${location ? ` — based in ${location}` : ""}.`;

  return {
    title: `${name} (@${username})`,
    description,
    alternates: { canonical: `https://rekodo.co/@${username}` },
    openGraph: {
      title: `${name} on rekōdo`,
      description,
      url: `https://rekodo.co/@${username}`,
      type: "profile",
      ...(profile.avatar_url
        ? { images: [{ url: profile.avatar_url, alt: `${name}'s avatar` }] }
        : {}),
    },
    twitter: {
      card: "summary",
      title: `${name} on rekōdo`,
      description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
  };
}

// Production: Vercel rewrites /@username → /p/username before routing.
// This page is what actually serves public profiles.
export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username } = await params;

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

  const [userRecordsResult, listsResult, followerRes, followingRes, collectionPhotoRes] = await Promise.all([
    supabase.from("user_records").select("record_id").eq("user_id", profile.id),
    supabase.from("lists")
      .select("id, title, slug, list_type")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("created_at"),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
    supabase.from("collection_photos").select("storage_path").eq("user_id", profile.id).eq("display_order", 1).maybeSingle(),
  ]);

  const userRecords    = userRecordsResult.data ?? [];
  const lists          = listsResult.data ?? [];
  const followerCount  = followerRes.count  ?? 0;
  const followingCount = followingRes.count ?? 0;

  const collectionPhotoPath = collectionPhotoRes.data?.storage_path ?? null;
  let collectionPhoto: string | null = null;
  if (collectionPhotoPath) {
    const { data: { publicUrl } } = supabase.storage.from("collection-photos").getPublicUrl(collectionPhotoPath);
    collectionPhoto = publicUrl;
  }
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
      isSupporter={isOwner ? !!(profile.is_donor || profile.role === "admin") : false}
      totalRecords={totalRecords}
      topGenre={topGenre}
      topCountry={topCountry}
      topLabel={topLabel}
      followerCount={followerCount}
      followingCount={followingCount}
      viewer={viewerInfo}
      collectionPhoto={collectionPhoto}
    />
  );
}
