import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import CollectorsLikeYou from "@/components/collectors/CollectorsLikeYou";
import CollectionPhotos from "./CollectionPhotos";
import { FollowButton, GenerateSummaryBtn, UsernameSetupForm } from "./ProfilePageClient";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";

type Params = Promise<{ username: string }>;

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;

  // Proxy rewrites /@username → /p/username before routing
  const username = rawHandle;

  const supabase = await createClient();

  const { data: { user: viewer } } = await supabase.auth.getUser();

  // Profile lookup — cascades through fallbacks as columns are migrated in
  const { data: fullProfile, error: fullError } = await supabase
    .from("profiles")
    .select("id, username, display_name, city, country, avatar_url, taste_summary, is_donor, star_sign")
    .eq("username", username)
    .maybeSingle();

  const { data: profile } = fullError
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("username", username)
        .maybeSingle()
    : { data: fullProfile };

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

  const isOwner      = viewer?.id === profile.id;
  const tasteSummary = (profile as { taste_summary?: string | null }).taste_summary ?? null;
  const isDonor      = (profile as { is_donor?: boolean | null }).is_donor ?? false;
  const city         = (profile as { city?: string | null }).city ?? null;
  const country      = (profile as { country?: string | null }).country ?? null;
  const starSign     = (profile as { star_sign?: string | null }).star_sign ?? null;

  const locationLine = city && country ? `${city}, ${country}` : (city ?? null);

  // Paginate user_records (Supabase caps at 1000 rows per request)
  type UserRecord = { record_id: string; value: number | null; price_median: number | null; price_currency: string | null };
  const paginateUserRecords = async (): Promise<UserRecord[]> => {
    const all: UserRecord[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from("user_records")
        .select("record_id, value, price_median, price_currency")
        .eq("user_id", profile.id)
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all.push(...(data as UserRecord[]));
      if (data.length < PAGE) break;
    }
    return all;
  };

  // Parallel fetches — user_records paginates internally but runs alongside the rest
  const [userRecords, listsResult, followerRes, followingRes, photosResult, viewerProfileResult, followStateResult] = await Promise.all([
    paginateUserRecords(),
    supabase.from("lists")
      .select("id, title, slug, list_type")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .in("title", ["Top 5 All Time", "Top 5 Records That Changed My Life", "Top 5 Most Played"])
      .order("created_at"),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
    supabase
      .from("collection_photos")
      .select("storage_path, display_order")
      .eq("user_id", profile.id)
      .order("display_order"),
    viewer
      ? supabase.from("profiles").select("username, display_name, avatar_url").eq("id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer && !isOwner
      ? supabase.from("follows").select("id").eq("follower_id", viewer.id).eq("following_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const followerCount       = followerRes.count  ?? 0;
  const followingCount      = followingRes.count ?? 0;
  const LIST_ORDER = ["Top 5 All Time", "Top 5 Records That Changed My Life", "Top 5 Most Played"];
  const lists = (listsResult.data ?? []).sort(
    (a, b) => LIST_ORDER.indexOf(a.title) - LIST_ORDER.indexOf(b.title)
  );
  const viewerProfile       = (viewerProfileResult.data as { username: string; display_name: string | null; avatar_url: string | null } | null)?.username
    ? (viewerProfileResult.data as { username: string; display_name: string | null; avatar_url: string | null })
    : null;
  const initialIsFollowing  = !!(followStateResult as { data: { id: string } | null }).data;

  // Build initial photo (only slot 1 / display_order = 1)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const firstPhoto  = (photosResult.data ?? []).find(p => p.display_order === 1);
  const initialPhoto: string | null = firstPhoto
    ? `${supabaseUrl}/storage/v1/object/public/collection-photos/${firstPhoto.storage_path}`
    : null;

  // Batch-fetch record details (400 IDs per query to stay within Supabase limits)
  const recordIds = userRecords.map(r => r.record_id).filter(Boolean);
  const details: { id: string; genre: string | null; artist: string }[] = [];
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, genre, artist")
      .in("id", recordIds.slice(i, i + BATCH));
    if (data) details.push(...data);
  }

  const totalRecords = userRecords.length;

  function topOf(arr: (string | null)[]): string | null {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  const topGenre = topOf(details.map(r => r.genre));

  // Collection value stats
  let collectionValue = 0;
  let hasValue = false;
  let highestValue: { artist: string; amount: number } | null = null;

  for (const ur of userRecords) {
    const v = ur.value ?? ur.price_median ?? null;
    if (v == null) continue;
    const rec = details.find(d => d.id === ur.record_id);
    hasValue = true;
    collectionValue += v;
    if (!highestValue || v > highestValue.amount) {
      highestValue = { artist: rec?.artist ?? "Unknown", amount: v };
    }
  }

  function fmtValue(n: number): string {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }

  // List items + cover art
  const listIds = lists.map(l => l.id);
  const { data: allItems } = listIds.length
    ? await supabase
        .from("list_items")
        .select("list_id, position, item_type, record_id, song_cover_url, song_artist, song_album")
        .in("list_id", listIds)
        .order("position")
    : { data: [] };

  const itemRecordIds = (allItems ?? [])
    .filter(i => i.item_type !== "song" && i.record_id)
    .map(i => i.record_id as string);

  const { data: coverRecords } = itemRecordIds.length
    ? await supabase.from("records").select("id, cover_url, artist, album").in("id", itemRecordIds)
    : { data: [] };

  type ItemRow = NonNullable<typeof allItems>[number];
  const coverById   = new Map((coverRecords ?? []).map(r => [r.id, r]));
  const itemsByList = new Map<string, ItemRow[]>(listIds.map(id => [id, []]));
  for (const item of (allItems ?? [])) {
    itemsByList.get(item.list_id)?.push(item);
  }

  const hasSummary       = !!tasteSummary;
  const showSummaryBlock = hasSummary || isOwner;

  const divider: React.CSSProperties = { height: 1, background: RULE };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* ── Nav ── */}
      {viewerProfile ? (
        <AppNav
          username={viewerProfile.username}
          displayLabel={viewerProfile.display_name ?? undefined}
          avatarUrl={viewerProfile.avatar_url}
        />
      ) : (
        <nav style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 40px" }}>
          <Link href="/" aria-label="rekōdo home" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, textDecoration: "none" }}>
            ō
          </Link>
        </nav>
      )}

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "64px 40px 80px" }}>
        <div>

            {/* Identity bar */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", marginBottom: "40px" }}>

              <div>
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", marginBottom: "20px" }}
                  />
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", background: ORANGE,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: MONO, fontSize: "22px", fontWeight: 600,
                    color: "#ffffff", marginBottom: "20px",
                  }}>
                    {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                  </div>
                )}

                <h1 style={{
                  fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400,
                  color: "#0d0d0d", lineHeight: 1.1, margin: "0 0 12px 0",
                }}>
                  {profile.display_name || profile.username}
                </h1>

                <p style={{
                  fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em",
                  color: "#aaaaaa", margin: "0 0 6px 0",
                  display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px",
                }}>
                  <span>@{profile.username}</span>
                  {isDonor && (
                    <span style={{ fontFamily: SERIF, fontSize: "0.85em", color: "#C9A84C" }} title="rekōdo supporter">ō</span>
                  )}
                </p>

                {starSign && (
                  <p style={{
                    fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em",
                    color: "#aaaaaa", margin: "0 0 4px 0",
                  }}>
                    {starSign}
                  </p>
                )}

                {locationLine && (
                  <p style={{
                    fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em",
                    color: "#aaaaaa", margin: "0 0 4px 0",
                  }}>
                    {locationLine}
                  </p>
                )}

                <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#aaaaaa", margin: 0 }}>
                  {followerCount} {followerCount === 1 ? "follower" : "followers"}
                </p>
              </div>

              {viewerProfile && !isOwner && (
                <div style={{ paddingTop: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <Link
                    href={`/@${viewerProfile.username}`}
                    style={{
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "#0d0d0d",
                      border: "1px solid rgba(0,0,0,0.12)",
                      padding: "7px 14px", textDecoration: "none",
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}
                  >
                    My profile
                  </Link>
                  <FollowButton profileId={profile.id} initialIsFollowing={initialIsFollowing} />
                </div>
              )}
            </div>

            <div style={divider} />

            {/* Taste summary */}
            {showSummaryBlock && (
              <div style={{ padding: "32px 0" }}>
                {hasSummary ? (
                  <>
                    <p style={{
                      fontFamily: SERIF, fontSize: "1.1rem", fontStyle: "italic",
                      color: "#505050", lineHeight: 1.8, margin: "0 0 20px 0",
                    }}>
                      {tasteSummary}
                    </p>
                    {isOwner && <GenerateSummaryBtn userId={profile.id} hasExisting />}
                  </>
                ) : (
                  <GenerateSummaryBtn userId={profile.id} hasExisting={false} />
                )}
              </div>
            )}

            {showSummaryBlock && <div style={divider} />}

            {/* Collection stats strip */}
            {totalRecords > 0 && (
              <div style={{ padding: "40px 0" }}>
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <StatCell label="Items in Collection" value={totalRecords.toLocaleString()} border={false} />
                  <StatCell label="Top Genre"           value={topGenre ?? "—"} />
                  <StatCell label="Collection Value"    value={hasValue ? fmtValue(collectionValue) : "—"} />
                  <StatCell label="Highest Value"       value={highestValue?.artist ?? "—"} subValue={highestValue ? fmtValue(highestValue.amount) : undefined} />
                </div>
              </div>
            )}

            {/* Collectors Like You */}
            <CollectorsLikeYou userId={profile.id} currentUserId={viewer?.id ?? null} />

            {/* My Setup — photo */}
            {(isOwner || !!initialPhoto) && (
              <>
                <div style={divider} />
                <div style={{ padding: "40px 0" }}>
                  <CollectionPhotos
                    initialPhoto={initialPhoto}
                    userId={profile.id}
                    isOwner={isOwner}
                  />
                </div>
              </>
            )}

            {lists.length > 0 && <div style={divider} />}

            {/* Public Top 5 Lists */}
            {lists.length > 0 && (
              <section style={{ marginTop: "48px" }}>
                <p style={{
                  fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
                  textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 32px 0",
                }}>
                  Top 5 Lists
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
                  {lists.map(list => {
                    const items    = itemsByList.get(list.id) ?? [];
                    const maxSlots = list.list_type === "top5" ? 5 : Math.max(items.length, 1);

                    return (
                      <div key={list.id}>
                        <Link href={`/@${profile.username}/${list.slug}`} style={{ textDecoration: "none" }}>
                          <h2 style={{
                            fontFamily: SERIF, fontSize: "20px", fontWeight: 400,
                            color: "#0d0d0d", margin: "0 0 16px 0", lineHeight: 1.2,
                          }}>
                            {list.title}
                          </h2>
                        </Link>

                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(maxSlots, 5)}, 1fr)`, gap: "10px" }}>
                          {Array.from({ length: maxSlots }, (_, i) => {
                            const pos      = i + 1;
                            const item     = items.find(it => it.position === pos);
                            const rec      = item?.record_id ? coverById.get(item.record_id) : undefined;
                            const coverUrl = item?.item_type === "song"
                              ? item.song_cover_url
                              : (rec?.cover_url ?? null);

                            return (
                              <div key={pos}>
                                <div style={{
                                  aspectRatio: "1 / 1", position: "relative", overflow: "hidden",
                                  background: coverUrl ? "transparent" : "#f4f4f4",
                                  border: coverUrl ? "none" : "1px dashed rgba(0,0,0,0.10)",
                                }}>
                                  {coverUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={coverUrl}
                                      alt={item?.song_album ?? rec?.album ?? ""}
                                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                  ) : (
                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <span style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8" }}>—</span>
                                    </div>
                                  )}
                                  <span style={{
                                    position: "absolute", top: "7px", left: "7px",
                                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
                                    color: coverUrl ? "rgba(255,255,255,0.75)" : "#cccccc",
                                    textShadow: coverUrl ? "0 1px 3px rgba(0,0,0,0.5)" : "none",
                                    lineHeight: 1,
                                  }}>
                                    {pos}
                                  </span>
                                </div>

                                {item && (
                                  <div style={{ marginTop: "8px" }}>
                                    <p style={{
                                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
                                      textTransform: "uppercase", color: "#aaaaaa",
                                      margin: "0 0 3px 0",
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}>
                                      {item.item_type === "song" ? item.song_artist : rec?.artist}
                                    </p>
                                    <p style={{
                                      fontFamily: SERIF, fontSize: "12px", color: "#0d0d0d",
                                      lineHeight: 1.3, margin: 0,
                                      display: "-webkit-box", WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical", overflow: "hidden",
                                    }}>
                                      {item.item_type === "song" ? item.song_album : rec?.album}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

        </div>{/* end main content */}
      </main>
    </div>
  );
}

function StatCell({
  label,
  value,
  subValue,
  border = true,
}: {
  label: string;
  value: string;
  subValue?: string;
  border?: boolean;
}) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      paddingLeft:  border ? "20px" : 0,
      paddingRight: "20px",
      borderLeft:   border ? `1px solid ${RULE}` : "none",
    }}>
      <p style={{
        fontFamily: MONO,
        fontSize: "8px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#aaaaaa",
        margin: "0 0 8px 0",
        whiteSpace: "nowrap",
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: SERIF,
        fontSize: "clamp(16px, 2.2vw, 26px)",
        color: "#0d0d0d",
        margin: 0,
        lineHeight: 1.1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </p>
      {subValue && (
        <p style={{
          fontFamily: MONO,
          fontSize: "9px",
          letterSpacing: "0.06em",
          color: "#aaaaaa",
          margin: "5px 0 0 0",
        }}>
          {subValue}
        </p>
      )}
    </div>
  );
}
