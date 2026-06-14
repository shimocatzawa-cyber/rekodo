"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0a0a0a";
const MUTED  = "#aaaaaa";
const GOLD   = "#C9A84C";

type SubTab = "matches" | "collectors" | "lists";

type Follower = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_donor: boolean | null;
};

type Match = {
  userId: string;
  username: string;
  displayName: string | null;
  location: string | null;
  recordCount: number;
  score: number;
  label: string;
  description: string;
  sharedTags: string[];
  isFollowing: boolean;
  isDonor: boolean;
};

type Collector = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  is_donor: boolean | null;
};

type ListEntry = {
  id: string;
  title: string;
  slug: string;
  username: string;
  displayName: string | null;
  covers: (string | null)[];
  itemCount: number;
};

function initials(name: string | null, username: string): string {
  if (!name) return (username[0] ?? "?").toUpperCase();
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

function Avatar({ avatarUrl, name, username, size = 36 }: {
  avatarUrl: string | null; name: string | null; username: string; size?: number;
}) {
  const init = initials(name, username);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f0ede8", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name ?? username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontFamily: MONO, fontSize: `${Math.floor(size * 0.28)}px`, color: "#666", fontWeight: 600 }}>{init}</span>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MatchCard({ match, isFollowing, canFollow, onFollow }: {
  match: Match; isFollowing: boolean; canFollow: boolean; onFollow: () => void;
}) {
  const init = (match.displayName || match.username).charAt(0).toUpperCase();
  return (
    <div style={{ border: `1px solid ${RULE}`, padding: "20px 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href={`/@${match.username}`} style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: ORANGE, color: "#fff", fontFamily: MONO, fontSize: "10px", fontWeight: 600, flexShrink: 0 }}>
            {init}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.05em", color: INK }}>@{match.username}</span>
            {match.isDonor && <span style={{ fontFamily: SERIF, fontSize: "0.75rem", color: GOLD }} title="rekōdo supporter">ō</span>}
          </span>
        </Link>
        <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: ORANGE, flexShrink: 0 }}>{match.score}%</span>
      </div>

      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.85rem", color: "#505050", lineHeight: 1.4, margin: 0 }}>
        {match.label}
      </p>

      {match.sharedTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {match.sharedTags.map(tag => (
            <span key={tag} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", border: `1px solid ${RULE}`, padding: "2px 6px" }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: `1px solid ${RULE}`, marginTop: "auto" }}>
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.04em" }}>
          {match.location ? `${match.location} · ` : ""}{match.recordCount.toLocaleString()} records
        </span>
        {canFollow && (
          <button onClick={onFollow} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: `1px solid ${isFollowing ? RULE : ORANGE}`, color: isFollowing ? MUTED : ORANGE, cursor: "pointer", padding: "3px 10px" }}>
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>
    </div>
  );
}

function CollectorRow({ collector, isLast, isFollowing, canFollow, onFollow }: {
  collector: Collector; isLast: boolean; isFollowing: boolean; canFollow: boolean; onFollow: () => void;
}) {
  const location = [collector.city, collector.country].filter(Boolean).join(", ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0", borderBottom: isLast ? "none" : `1px solid ${RULE}` }}>
      <Link href={`/@${collector.username}`} style={{ textDecoration: "none", flexShrink: 0 }}>
        <Avatar avatarUrl={collector.avatar_url} name={collector.display_name} username={collector.username} size={40} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/@${collector.username}`} style={{ textDecoration: "none" }}>
          <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 600, color: INK, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {collector.display_name ?? collector.username}
            {collector.is_donor && <span style={{ fontFamily: SERIF, fontSize: "0.75rem", color: GOLD, marginLeft: "5px" }} title="rekōdo supporter">ō</span>}
          </p>
          <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: MUTED, margin: 0 }}>
            @{collector.username}{location ? ` · ${location}` : ""}
          </p>
        </Link>
      </div>
      {canFollow && (
        <button onClick={onFollow} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: `1px solid ${isFollowing ? RULE : ORANGE}`, color: isFollowing ? MUTED : ORANGE, cursor: "pointer", padding: "4px 12px", flexShrink: 0 }}>
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

function ListCard({ list }: { list: ListEntry }) {
  const hasCover = list.covers.some(Boolean);
  return (
    <div style={{ borderBottom: `1px solid ${RULE}`, padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        {hasCover && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", width: 44, flexShrink: 0 }}>
            {list.covers.slice(0, 4).map((cover, i) => (
              <div key={i} style={{ width: 21, height: 21, background: "#f0ede8", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/@${list.username}/lists/${list.slug}`} style={{ textDecoration: "none" }}>
            <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {list.title}
            </p>
          </Link>
          <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.05em", margin: 0 }}>
            @{list.username} · {list.itemCount} record{list.itemCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CommunityTab({ profileOwnerId }: { profileOwnerId: string }) {
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [subTab,       setSubTab]       = useState<SubTab>("matches");
  const [searchQuery,  setSearchQuery]  = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Followers / Following sections
  const [followers,        setFollowers]        = useState<Follower[]>([]);
  const [following,        setFollowing]        = useState<Follower[]>([]);
  const [followersLoaded,  setFollowersLoaded]  = useState(false);

  // Matches
  const [matches,        setMatches]        = useState<Match[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // All collectors
  const [collectors,        setCollectors]        = useState<Collector[]>([]);
  const [collectorsLoading, setCollectorsLoading] = useState(false);

  // Lists from network
  const [lists,      setLists]      = useState<ListEntry[]>([]);
  const [listsState, setListsState] = useState<"idle" | "loading" | "done">("idle");

  // Follow state
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  // Get viewer + load followers on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setViewerUserId(user?.id ?? null);
    });

    async function loadFollowData() {
      const supabase = createClient();

      async function resolveProfiles(ids: string[]): Promise<Follower[]> {
        if (ids.length === 0) return [];
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, is_donor")
          .in("id", ids);
        const byId = new Map((data ?? []).map(p => [p.id, p]));
        return ids.map(id => byId.get(id)).filter(Boolean) as Follower[];
      }

      // Who follows this profile
      const { data: followerRows } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", profileOwnerId)
        .order("created_at", { ascending: false })
        .limit(100);

      // Who this profile follows
      const { data: followingRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", profileOwnerId)
        .order("created_at", { ascending: false })
        .limit(100);

      const [followerProfiles, followingProfiles] = await Promise.all([
        resolveProfiles((followerRows ?? []).map(r => r.follower_id)),
        resolveProfiles((followingRows ?? []).map(r => r.following_id)),
      ]);

      setFollowers(followerProfiles);
      setFollowing(followingProfiles);
      setFollowersLoaded(true);
    }

    loadFollowData();
  }, [profileOwnerId]);

  // Load top matches when tab is active (lazy)
  useEffect(() => {
    if (subTab !== "matches" || matches !== null) return;
    setMatchesLoading(true);
    fetch(`/api/collectors/matches?userId=${encodeURIComponent(profileOwnerId)}`)
      .then(r => r.ok ? r.json() : { matches: [] })
      .then(d => {
        const list: Match[] = d.matches ?? [];
        setMatches(list);
        const fs: Record<string, boolean> = {};
        for (const m of list) fs[m.userId] = m.isFollowing;
        setFollowState(prev => ({ ...prev, ...fs }));
      })
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  }, [subTab, profileOwnerId, matches]);

  // Load lists when tab is active (lazy)
  useEffect(() => {
    if (subTab !== "lists" || listsState !== "idle") return;
    setListsState("loading");
    fetch("/api/lists/following")
      .then(r => r.ok ? r.json() : { lists: [] })
      .then(d => { setLists(d.lists ?? []); setListsState("done"); })
      .catch(() => setListsState("done"));
  }, [subTab, listsState]);

  // Load collectors with debounced search, pre-populating follow state from DB
  const loadCollectors = useCallback(async (query: string) => {
    setCollectorsLoading(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, city, country, is_donor")
        .eq("is_public", true)
        .limit(50);
      if (query.trim()) {
        q = q.or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`);
      } else {
        q = q.order("username", { ascending: true });
      }
      const { data } = await q;
      const profiles = (data ?? []) as Collector[];
      setCollectors(profiles);

      // Fetch actual follow state so buttons reflect reality, not just session clicks
      if (viewerUserId && profiles.length > 0) {
        const ids = profiles.map(c => c.id);
        const { data: followRows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", viewerUserId)
          .in("following_id", ids);
        const followedSet = new Set((followRows ?? []).map(r => r.following_id as string));
        const fs: Record<string, boolean> = {};
        for (const id of ids) fs[id] = followedSet.has(id);
        setFollowState(prev => ({ ...prev, ...fs }));
      }
    } finally {
      setCollectorsLoading(false);
    }
  }, [viewerUserId]);

  useEffect(() => {
    if (subTab !== "collectors") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadCollectors(searchQuery), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subTab, searchQuery, loadCollectors]);

  async function toggleFollow(targetId: string, targetProfile?: Follower) {
    if (!viewerUserId || targetId === viewerUserId) return;
    const prev = followState[targetId] ?? false;
    setFollowState(s => ({ ...s, [targetId]: !prev }));
    try {
      const res = await fetch("/api/collectors/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: targetId }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.isFollowing !== "boolean") {
        // Server error — revert optimistic update
        setFollowState(s => ({ ...s, [targetId]: prev }));
        return;
      }
      setFollowState(s => ({ ...s, [targetId]: data.isFollowing }));

      // Keep the Following list in sync without a full reload
      if (data.isFollowing && targetProfile) {
        setFollowing(prev => prev.some(f => f.id === targetId) ? prev : [targetProfile, ...prev]);
      } else if (!data.isFollowing) {
        setFollowing(prev => prev.filter(f => f.id !== targetId));
      }
    } catch {
      setFollowState(s => ({ ...s, [targetId]: prev }));
    }
  }

  const TABS: Array<{ key: SubTab; label: string }> = [
    { key: "matches",    label: "Top Matches" },
    { key: "collectors", label: "All Collectors" },
    { key: "lists",      label: "Lists" },
  ];

  return (
    <div style={{ width: "100%", padding: "24px 1.5rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* ── Followers + Following ──────────────────────────────────────────────── */}
        {followersLoaded && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px", paddingBottom: "28px", borderBottom: `1px solid ${RULE}` }}>
            {/* Following — who this profile follows */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
                <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0 }}>Following</p>
                <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED }}>{following.length}</span>
              </div>
              {following.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, lineHeight: 1.6 }}>
                  Not following anyone yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {following.map(f => (
                    <Link key={f.id} href={`/@${f.username}`} title={f.display_name ?? f.username} style={{ textDecoration: "none", position: "relative", display: "inline-block" }}>
                      <Avatar avatarUrl={f.avatar_url} name={f.display_name} username={f.username} size={38} />
                      {f.is_donor && <span style={{ position: "absolute", bottom: -1, right: -1, fontFamily: SERIF, fontSize: "9px", color: GOLD, lineHeight: 1, background: "#fff", borderRadius: "50%", padding: "1px" }} title="rekōdo supporter">ō</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Followers — who follows this profile */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
                <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0 }}>Followers</p>
                <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED }}>{followers.length}</span>
              </div>
              {followers.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, lineHeight: 1.6 }}>
                  No followers yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {followers.map(f => (
                    <Link key={f.id} href={`/@${f.username}`} title={f.display_name ?? f.username} style={{ textDecoration: "none", position: "relative", display: "inline-block" }}>
                      <Avatar avatarUrl={f.avatar_url} name={f.display_name} username={f.username} size={38} />
                      {f.is_donor && <span style={{ position: "absolute", bottom: -1, right: -1, fontFamily: SERIF, fontSize: "9px", color: GOLD, lineHeight: 1, background: "#fff", borderRadius: "50%", padding: "1px" }} title="rekōdo supporter">ō</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search bar */}
        <input
          type="text"
          placeholder="Search collectors by name or username…"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim()) setSubTab("collectors");
          }}
          style={{
            width: "100%", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em",
            color: INK, background: "#fafaf8", border: `1px solid ${RULE}`,
            padding: "10px 14px", outline: "none", boxSizing: "border-box",
            marginBottom: "24px",
          }}
        />

        {/* Sub-tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${RULE}`, marginBottom: "28px" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              style={{
                fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: subTab === t.key ? ORANGE : MUTED,
                background: "none", border: "none",
                borderBottom: subTab === t.key ? `1.5px solid ${ORANGE}` : "1.5px solid transparent",
                padding: "8px 20px 10px", cursor: "pointer", marginBottom: "-1px",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Top Matches ────────────────────────────────────────────────────── */}
        {subTab === "matches" && (
          <>
            {matchesLoading && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.08em" }}>
                Finding closest matches…
              </p>
            )}
            {!matchesLoading && matches !== null && matches.length === 0 && (
              <div style={{ paddingTop: "16px" }}>
                <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, marginBottom: "8px" }}>No matches yet.</p>
                <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
                  Matches are computed from shared artists, genres and decades across the rekōdo community. As more collectors join, your closest matches will appear here.
                </p>
              </div>
            )}
            {!matchesLoading && matches && matches.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
                {matches.map(m => (
                  <MatchCard
                    key={m.userId}
                    match={m}
                    isFollowing={followState[m.userId] ?? m.isFollowing}
                    canFollow={!!viewerUserId && viewerUserId !== m.userId}
                    onFollow={() => toggleFollow(m.userId, { id: m.userId, username: m.username, display_name: m.displayName, avatar_url: null, is_donor: null })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── All Collectors ─────────────────────────────────────────────────── */}
        {subTab === "collectors" && (
          <>
            {collectorsLoading && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.08em" }}>Loading…</p>
            )}
            {!collectorsLoading && collectors.length === 0 && (
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, paddingTop: "8px" }}>
                {searchQuery.trim() ? `No collectors found for "${searchQuery}".` : "No public collectors yet."}
              </p>
            )}
            {!collectorsLoading && collectors.length > 0 && (
              <div>
                {collectors.map((c, i) => (
                  <CollectorRow
                    key={c.id}
                    collector={c}
                    isLast={i === collectors.length - 1}
                    isFollowing={followState[c.id] ?? false}
                    canFollow={!!viewerUserId && viewerUserId !== c.id}
                    onFollow={() => toggleFollow(c.id, { id: c.id, username: c.username, display_name: c.display_name, avatar_url: c.avatar_url, is_donor: c.is_donor })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Lists from Network ──────────────────────────────────────────────── */}
        {subTab === "lists" && (
          <>
            {listsState === "loading" && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.08em" }}>Loading…</p>
            )}
            {listsState === "done" && lists.length === 0 && (
              <div style={{ paddingTop: "16px" }}>
                <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, marginBottom: "8px" }}>No lists yet.</p>
                <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
                  Follow collectors to see their lists here. Use Top Matches to find collectors with similar taste.
                </p>
              </div>
            )}
            {listsState === "done" && lists.length > 0 && (
              <div>
                {lists.map(list => <ListCard key={list.id} list={list} />)}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
