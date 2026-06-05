import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CollectorsLikeYou from "@/components/collectors/CollectorsLikeYou";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

type Params = Promise<{ username: string }>;

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username: rawUsername } = await params;
  const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const supabase = await createClient();

  // ── Profile ───────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, location, bio, avatar_url, is_donor")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  // ── Auth: is the viewer logged in? ────────────────────────────────────────
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // ── Collection + Lists + Social counts in parallel ────────────────────────
  const [userRecordsResult, listsResult, followerRes, followingRes] = await Promise.all([
    supabase.from("user_records").select("price_low, record_id").eq("user_id", profile.id),
    supabase.from("lists").select("id, title, slug, list_type").eq("user_id", profile.id).eq("is_public", true).order("created_at"),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id",  profile.id),
  ]);

  const followerCount  = followerRes.count  ?? 0;
  const followingCount = followingRes.count ?? 0;

  const userRecords = userRecordsResult.data ?? [];
  const lists       = listsResult.data ?? [];

  // ── Record details for stats (years + countries) ──────────────────────────
  const recordIds = userRecords.map(r => r.record_id).filter(Boolean);
  const { data: recordDetails } = recordIds.length
    ? await supabase.from("records").select("id, year, country").in("id", recordIds)
    : { data: [] };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalRecords = userRecords.length;
  const pricedRows   = userRecords.filter(r => (r.price_low ?? 0) > 0);
  const estValue     = pricedRows.reduce((s, r) => s + (r.price_low ?? 0), 0);
  const details      = recordDetails ?? [];
  const countries    = new Set(details.map(r => r.country).filter(Boolean)).size;
  const years        = details.map(r => r.year).filter((y): y is number => y != null);
  const yearMin      = years.length ? Math.min(...years) : null;
  const yearMax      = years.length ? Math.max(...years) : null;

  // ── List items ────────────────────────────────────────────────────────────
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

  // ── Shared styles ─────────────────────────────────────────────────────────
  const rule: React.CSSProperties = { height: 1, background: "rgba(0,0,0,0.07)", margin: "28px 0" };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* ── Nav: wordmark only ── */}
      <nav style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 40px" }}>
        <Link
          href="/"
          aria-label="rekōdo home"
          style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, textDecoration: "none" }}
        >
          ō
        </Link>
      </nav>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "64px 40px 80px" }}>

        {/* ── Header ── */}
        {/* Avatar */}
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
            color: "#ffffff", marginBottom: "20px", flexShrink: 0,
          }}>
            {(profile.display_name || profile.username).charAt(0).toUpperCase()}
          </div>
        )}
        <h1 style={{
          fontFamily: SERIF, fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 400,
          color: "#0d0d0d", lineHeight: 1.1, margin: "0 0 12px 0",
        }}>
          {profile.display_name || profile.username}
        </h1>
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: "#aaaaaa", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>@{profile.username}</span>
          {profile.is_donor && (
            <span style={{ fontFamily: SERIF, fontSize: "0.8em", color: "#C9A84C" }} title="rekōdo supporter">ō</span>
          )}
          {profile.location && (
            <span style={{ color: "#cccccc" }}>· {profile.location}</span>
          )}
        </p>
        {(followerCount > 0 || followingCount > 0) && (
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.05em", color: "#cccccc", margin: 0 }}>
            {followerCount > 0 && (
              <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>
            )}
            {followerCount > 0 && followingCount > 0 && <span style={{ margin: "0 8px" }}>·</span>}
            {followingCount > 0 && (
              <span>following {followingCount}</span>
            )}
          </p>
        )}

        <div style={rule} />

        {/* ── Stats row ── */}
        {totalRecords > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0", flexWrap: "wrap" }}>
            <StatItem value={totalRecords.toLocaleString()} label="Records" />
            {estValue > 0 && (
              <>
                <StatDot />
                <StatItem value={fmt(estValue)} label="Est. value" />
              </>
            )}
            {countries > 0 && (
              <>
                <StatDot />
                <StatItem value={String(countries)} label={countries === 1 ? "Country" : "Countries"} />
              </>
            )}
            {yearMin != null && yearMax != null && (
              <>
                <StatDot />
                <StatItem value={yearMin === yearMax ? String(yearMin) : `${yearMin}–${yearMax}`} label="Years" />
              </>
            )}
          </div>
        )}

        {totalRecords > 0 && <div style={rule} />}

        {/* ── Bio / taste essay ── */}
        <p style={{
          fontFamily: SERIF, fontSize: "16px", fontStyle: "italic",
          color: profile.bio ? "#505050" : "#cccccc",
          lineHeight: 1.7, margin: 0, maxWidth: 620,
        }}>
          {profile.bio || "No taste essay yet."}
        </p>

        {/* ── Public Top 5 Lists ── */}
        {lists.length > 0 && (
          <section style={{ marginTop: "56px" }}>
            <p style={{
              fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
              textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 32px 0",
            }}>
              Top 5 Lists
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
              {lists.map(list => {
                const items = itemsByList.get(list.id) ?? [];
                const maxSlots = list.list_type === "top5" ? 5 : Math.max(items.length, 1);

                return (
                  <div key={list.id}>
                    <Link
                      href={`/@${profile.username}/${list.slug}`}
                      style={{ textDecoration: "none" }}
                    >
                      <h2 style={{
                        fontFamily: SERIF, fontSize: "20px", fontWeight: 400,
                        color: "#0d0d0d", margin: "0 0 16px 0", lineHeight: 1.2,
                      }}>
                        {list.title}
                      </h2>
                    </Link>

                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${maxSlots}, 1fr)`, gap: "10px" }}>
                      {Array.from({ length: maxSlots }, (_, i) => {
                        const pos  = i + 1;
                        const item = items.find(it => it.position === pos);
                        const rec  = item?.record_id ? coverById.get(item.record_id) : undefined;
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
        <CollectorsLikeYou
          userId={profile.id}
          currentUserId={viewer?.id ?? null}
        />

      </main>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ paddingRight: "20px" }}>
      <span style={{ fontFamily: SERIF, fontSize: "20px", color: "#0d0d0d" }}>{value}</span>
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#aaaaaa", marginLeft: "6px" }}>
        {label}
      </span>
    </div>
  );
}

function StatDot() {
  return (
    <span style={{
      width: 3, height: 3, borderRadius: "50%", background: "#d8d8d8",
      display: "inline-block", flexShrink: 0, marginRight: "20px", marginBottom: "2px",
    }} />
  );
}
