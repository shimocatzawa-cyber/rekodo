import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CollectorsLikeYou from "@/components/collectors/CollectorsLikeYou";
import { ShareButton, GenerateSummaryBtn, UsernameSetupForm } from "./ProfilePageClient";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";

type Params = Promise<{ username: string }>;

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;

  // Scope this dynamic route to /@username URLs only
  if (!rawHandle.startsWith("@")) notFound();
  const username = rawHandle.slice(1);

  const supabase = await createClient();

  // Auth check (needed for owner detection + username-setup fallback)
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // Profile lookup — RLS allows public reads where is_public = true, plus owner reads
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, city, country, avatar_url, is_donor, taste_summary")
    .eq("username", username)
    .maybeSingle();

  // No profile: show username-setup form if the viewer has no username, else 404
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

  // Parallel fetch: collection, lists, social counts
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

  const followerCount  = followerRes.count  ?? 0;
  const followingCount = followingRes.count ?? 0;
  const userRecords    = userRecordsResult.data ?? [];
  const lists          = listsResult.data ?? [];

  // Record details for stats (genre, country, label added vs. old page)
  const recordIds = userRecords.map(r => r.record_id).filter(Boolean);
  const { data: recordDetails } = recordIds.length
    ? await supabase.from("records").select("id, year, country, genre, label").in("id", recordIds)
    : { data: [] };

  const totalRecords = userRecords.length;
  const details = recordDetails ?? [];

  function topOf(arr: (string | null)[]): string | null {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  const topGenre   = topOf(details.map(r => r.genre));
  const topCountry = topOf(details.map(r => r.country));
  const topLabel   = topOf(details.map(r => r.label));

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

  const hasSummary          = !!profile.taste_summary;
  const showSummaryBlock    = hasSummary || isOwner;

  const divider: React.CSSProperties = { height: 1, background: RULE };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 40px" }}>
        <Link href="/" aria-label="rekōdo home" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, textDecoration: "none" }}>
          ō
        </Link>
      </nav>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "64px 40px 80px" }}>

        {/* ── Identity bar ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", marginBottom: "40px" }}>

          {/* Left: avatar + names */}
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
              {profile.is_donor && (
                <span style={{ fontFamily: SERIF, fontSize: "0.85em", color: "#C9A84C" }} title="rekōdo supporter">ō</span>
              )}
              {(profile.city || profile.country) && <span style={{ color: "#dddddd" }}>·</span>}
              {(profile.city || profile.country) && (
                <span>{[profile.city, profile.country].filter(Boolean).join(", ")}</span>
              )}
              {isOwner && (
                <>
                  <span style={{ color: "#dddddd" }}>·</span>
                  <Link href="/settings/profile" style={{ color: "#cccccc", textDecoration: "none", fontSize: "9px", letterSpacing: "0.1em" }}>
                    Edit profile
                  </Link>
                </>
              )}
            </p>

            {(followerCount > 0 || followingCount > 0) && (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.05em", color: "#cccccc", margin: 0 }}>
                {followerCount > 0 && <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>}
                {followerCount > 0 && followingCount > 0 && <span style={{ margin: "0 8px" }}>·</span>}
                {followingCount > 0 && <span>following {followingCount}</span>}
              </p>
            )}
          </div>

          {/* Right: share button */}
          <div style={{ paddingTop: "4px" }}>
            <ShareButton />
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={divider} />

        {/* ── Taste summary block ── */}
        {showSummaryBlock && (
          <div style={{ padding: "32px 0" }}>
            {hasSummary ? (
              <>
                <p style={{
                  fontFamily: SERIF,
                  fontSize: "1.1rem",
                  fontStyle: "italic",
                  color: "#505050",
                  lineHeight: 1.8,
                  margin: "0 0 20px 0",
                  maxWidth: 620,
                }}>
                  {profile.taste_summary}
                </p>
                {isOwner && <GenerateSummaryBtn userId={profile.id} hasExisting />}
              </>
            ) : (
              // Owner with no summary yet
              <GenerateSummaryBtn userId={profile.id} hasExisting={false} />
            )}
          </div>
        )}

        {showSummaryBlock && <div style={divider} />}

        {/* ── Collection stats strip ── */}
        {totalRecords > 0 && (
          <div style={{ padding: "40px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <StatCell label="Total Records"        value={totalRecords.toLocaleString()} border={false} />
              <StatCell label="Top Genre"            value={topGenre   ?? "—"} />
              <StatCell label="Top Country"          value={topCountry ?? "—"} />
              <StatCell label="Most Collected Label" value={topLabel   ?? "—"} />
            </div>
          </div>
        )}

        {totalRecords > 0 && lists.length > 0 && <div style={divider} />}

        {/* ── Public Top 5 Lists ── */}
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

        {/* ── Collectors Like You ── */}
        <CollectorsLikeYou userId={profile.id} currentUserId={viewer?.id ?? null} />

      </main>
    </div>
  );
}

function StatCell({
  label,
  value,
  border = true,
}: {
  label: string;
  value: string;
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
    </div>
  );
}
