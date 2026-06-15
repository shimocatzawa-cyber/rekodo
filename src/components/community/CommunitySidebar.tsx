"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0d0d0d";
const MUTED  = "#aaaaaa";

const AVATAR_BG = ["#f0e8d8", "#e8ede8", "#e8edf5", "#f5e8f0", "#edf0e8"];

const CATEGORY_ORDER = [
  "Label Mate",
  "Bandmates",
  "A Side to my B",
  "Regular at the Same Shop",
  "Crate Rivals",
] as const;

const CATEGORY_COLOUR: Record<string, string> = {
  "Label Mate":               "#CC5500",
  "Bandmates":                "#8B5E3C",
  "A Side to my B":           "#3C6B8B",
  "Regular at the Same Shop": "#5A8B3C",
  "Crate Rivals":             "#8B3C6B",
};

interface FollowerRow {
  follower_id:      string;
  username:         string;
  display_name:     string | null;
  avatar_url:       string | null;
  collection_count: number;
  affinity_score:   number;
  affinity_category: string;
}

interface SuggestedRow {
  user_id:          string;
  username:         string;
  display_name:     string | null;
  avatar_url:       string | null;
  collection_count: number;
  affinity_score:   number;
  affinity_category: string;
  top_labels:       string[];
}

interface Props {
  profileOwnerId: string;
  isOwner: boolean;
}

function initials(name: string | null, username: string): string {
  if (!name) return (username[0] ?? "?").toUpperCase();
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function Avatar({
  avatarUrl, name, username, index, href,
}: {
  avatarUrl: string | null;
  name: string | null;
  username: string;
  index: number;
  href: string;
}) {
  const [hovered, setHovered] = useState(false);
  const bg = AVATAR_BG[index % AVATAR_BG.length];
  const handle = username.length > 6 ? username.slice(0, 6) + "…" : username;

  return (
    <Link
      href={href}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        border: `1.5px solid ${hovered ? ORANGE : RULE}`,
        overflow: "hidden", flexShrink: 0,
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "border-color 0.15s",
      }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: MONO, fontSize: "8px", color: "#666", userSelect: "none" }}>
            {initials(name, username)}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: MONO, fontSize: "0.42rem", color: MUTED,
        letterSpacing: "0.04em", whiteSpace: "nowrap",
      }}>
        @{handle}
      </span>
    </Link>
  );
}

export default function CommunitySidebar({ profileOwnerId, isOwner }: Props) {
  const [followers,  setFollowers]  = useState<FollowerRow[]>([]);
  const [suggested,  setSuggested]  = useState<SuggestedRow[]>([]);
  const [followed,   setFollowed]   = useState<Set<string>>(new Set());
  const [following,  setFollowing]  = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      if (!cancelled) setCurrentUserId(uid);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: fData }, { data: sData }] = await Promise.all([
        sb.rpc("get_follower_affinity",    { profile_owner_id: profileOwnerId }),
        sb.rpc("get_suggested_collectors", { profile_owner_id: profileOwnerId, limit_count: 4 }),
      ]);

      if (cancelled) return;

      const suggestedRows: SuggestedRow[] = (sData as unknown as SuggestedRow[]) ?? [];
      setFollowers((fData as unknown as FollowerRow[]) ?? []);
      setSuggested(suggestedRows);

      // Pre-populate which suggested users the current user already follows
      if (uid && suggestedRows.length > 0) {
        const ids = suggestedRows.map(r => r.user_id);
        const { data: existingFollows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", uid)
          .in("following_id", ids);
        if (!cancelled && existingFollows) {
          setFollowed(new Set(existingFollows.map((r: { following_id: string }) => r.following_id)));
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [profileOwnerId]);

  async function handleFollow(targetUserId: string) {
    if (!currentUserId) return;
    const isCurrentlyFollowed = followed.has(targetUserId);
    const action = isCurrentlyFollowed ? "unfollow" : "follow";

    setFollowing(prev => new Set(prev).add(targetUserId));

    const res = await fetch("/api/collectors/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followingId: targetUserId, action }),
    });

    if (res.ok) {
      const data = await res.json() as { isFollowing: boolean };
      setFollowed(prev => {
        const s = new Set(prev);
        if (data.isFollowing) s.add(targetUserId); else s.delete(targetUserId);
        return s;
      });
    }

    setFollowing(prev => { const s = new Set(prev); s.delete(targetUserId); return s; });
  }

  // Group followers by category
  const grouped = new Map<string, FollowerRow[]>();
  for (const f of followers) {
    const cat = f.affinity_category ?? "A Side to my B";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(f);
  }
  const totalFollowers = followers.length;

  const showFollowButton = !!currentUserId;

  return (
    <aside style={{ paddingRight: "1.5rem", paddingBottom: "3rem", paddingTop: "24px" }}>

      {/* ── Followers by affinity ──────────────────────────────────────────── */}
      <p style={{
        fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.12em",
        textTransform: "uppercase", color: ORANGE, marginBottom: 12,
      }}>
        Followers
      </p>

      {loading && (
        <p style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.08em" }}>Loading…</p>
      )}

      {!loading && totalFollowers === 0 && (
        <p style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.06em" }}>
          No followers yet.
        </p>
      )}

      {!loading && CATEGORY_ORDER.map(cat => {
        const rows = grouped.get(cat);
        if (!rows?.length) return null;
        const pct = Math.round((rows.length / totalFollowers) * 100);
        const fill = CATEGORY_COLOUR[cat] ?? ORANGE;
        const avatarRows = rows.slice(0, 5);
        const overflow = rows.length - avatarRows.length;

        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            {/* Label + count */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE }}>
                {cat}
              </span>
              <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: MUTED, letterSpacing: "0.06em" }}>
                {rows.length}
              </span>
            </div>

            {/* Bar */}
            <div style={{ height: 2, background: "#e0e0da", marginBottom: 10, borderRadius: 1 }}>
              <div style={{ height: 2, width: `${pct}%`, background: fill, borderRadius: 1 }} />
            </div>

            {/* Avatars */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
              {avatarRows.map((f, i) => (
                <Avatar
                  key={f.follower_id}
                  avatarUrl={f.avatar_url}
                  name={f.display_name}
                  username={f.username}
                  index={i}
                  href={`/p/@${f.username}`}
                />
              ))}
              {overflow > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 30, padding: "0 8px",
                  background: "#f5f5f3", border: `0.5px solid ${RULE}`,
                  borderRadius: 12,
                }}>
                  <span style={{ fontFamily: MONO, fontSize: "0.45rem", color: MUTED, letterSpacing: "0.04em" }}>
                    +{overflow} more
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Collectors you might know ────────────────────────────────────── */}
      {!loading && suggested.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${RULE}`, margin: "20px 0 16px" }} />

          <p style={{
            fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.12em",
            textTransform: "uppercase", color: ORANGE, marginBottom: 14,
          }}>
            Collectors you might know
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {suggested.map((s, i) => {
              const isFollowed  = followed.has(s.user_id);
              const isFollowing = following.has(s.user_id);

              return (
                <div key={s.user_id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Avatar
                    avatarUrl={s.avatar_url}
                    name={s.display_name}
                    username={s.username}
                    index={i}
                    href={`/p/@${s.username}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: SERIF, fontSize: "0.78rem", fontWeight: 600,
                      color: INK, margin: "0 0 2px", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.display_name ?? s.username}
                    </p>
                    <p style={{
                      fontFamily: MONO, fontSize: "0.5rem", color: ORANGE,
                      letterSpacing: "0.06em", margin: "0 0 4px",
                    }}>
                      {s.affinity_category} · {s.affinity_score}%
                    </p>
                    {s.top_labels.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {s.top_labels.map(lbl => (
                          <span key={lbl} style={{
                            fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.04em",
                            background: "#f7f7f5", border: "0.5px solid #e0e0da",
                            padding: "1px 5px",
                          }}>
                            {lbl}
                          </span>
                        ))}
                      </div>
                    )}
                    {showFollowButton && (
                      <button
                        onClick={() => handleFollow(s.user_id)}
                        disabled={isFollowing}
                        style={{
                          fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.08em",
                          color: isFollowed ? MUTED : ORANGE,
                          background: "none",
                          border: `0.5px solid ${isFollowed ? MUTED : ORANGE}`,
                          borderRadius: 0, cursor: isFollowing ? "default" : "pointer",
                          padding: "2px 8px",
                          opacity: isFollowing ? 0.5 : 1,
                          transition: "color 0.15s, border-color 0.15s",
                        }}
                      >
                        {isFollowing ? "…" : isFollowed ? "Following" : "Follow"}
                      </button>
                    )}
                    {!showFollowButton && (
                      <Link
                        href="/login"
                        style={{
                          fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.08em",
                          color: ORANGE, border: `0.5px solid ${ORANGE}`,
                          padding: "2px 8px", textDecoration: "none", display: "inline-block",
                        }}
                      >
                        Follow
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
