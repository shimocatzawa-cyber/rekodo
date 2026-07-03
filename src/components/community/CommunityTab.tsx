"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TrendingRecords from "./TrendingRecords";
import OpenToOffers from "./OpenToOffers";
import type { TrendingRecord } from "@/lib/trendingRecords";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0a0a0a";
const MUTED  = "#aaaaaa";
const GOLD   = "#C9A84C";

type SubTab = "matches" | "following" | "collectors" | "trending" | "offers" | "lists" | "saved";

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
  avatarUrl: string | null;
  location: string | null;
  recordCount: number;
  score: number;
  styleScore: number;
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
  collectionScore: number | null;
  styleScore: number | null;
};

type ActivityItem = {
  id: string;
  eventType: "play" | "wantlist_add" | "collection_add";
  createdAt: string;
  actor: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  record: { id: string; artist: string; album: string; coverUrl: string | null };
  match: { score: number; label: string } | null;
};

type ListEntry = {
  id: string;
  title: string;
  slug: string;
  userId: string;
  username: string;
  displayName: string | null;
  covers: (string | null)[];
  itemCount: number;
  recordCount: number;
  isSaved: boolean;
  matchScore?: number;
  matchLabel?: string;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

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
  return (
    <div style={{ border: `1px solid ${RULE}`, padding: "20px 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link href={`/@${match.username}`} style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}>
          <Avatar avatarUrl={match.avatarUrl} name={match.displayName} username={match.username} size={28} />
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.05em", color: INK }}>@{match.username}</span>
            {match.isDonor && <span style={{ fontFamily: SERIF, fontSize: "0.75rem", color: GOLD }} title="rekōdo supporter">ō</span>}
          </span>
        </Link>
      </div>

      <div>
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE }}>{match.score}% Collection Similarity</span>
        <br />
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>{match.styleScore}% Style Similarity</span>
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.85rem", color: "#505050", lineHeight: 1.4, margin: "5px 0 0" }}>
          {match.label}
        </p>
      </div>

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
        {(collector.collectionScore !== null || collector.styleScore !== null) && (
          <div style={{ marginTop: "4px" }}>
            {collector.collectionScore !== null && (
              <span style={{ fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.07em", textTransform: "uppercase", color: ORANGE }}>
                {collector.collectionScore}% Collection
              </span>
            )}
            {collector.collectionScore !== null && collector.styleScore !== null && (
              <span style={{ fontFamily: MONO, fontSize: "0.48rem", color: MUTED }}> · </span>
            )}
            {collector.styleScore !== null && (
              <span style={{ fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "#888" }}>
                {collector.styleScore}% Style
              </span>
            )}
          </div>
        )}
      </div>
      {canFollow && (
        <button onClick={onFollow} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: `1px solid ${isFollowing ? RULE : ORANGE}`, color: isFollowing ? MUTED : ORANGE, cursor: "pointer", padding: "4px 12px", flexShrink: 0 }}>
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

function ListCard({ list, isSaved, canSave, onSave }: {
  list: ListEntry;
  isSaved: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
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
          <Link href={`/@${list.username}/${list.slug}`} style={{ textDecoration: "none" }}>
            <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {list.title}
            </p>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Link href={`/@${list.username}`} style={{ textDecoration: "none" }}>
              <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.05em", color: ORANGE }}>@{list.username}</span>
            </Link>
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.04em" }}>
              {list.recordCount.toLocaleString()} records
            </span>
          </div>
          {list.matchScore !== undefined && (
            <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: ORANGE, margin: "4px 0 0", textTransform: "uppercase" }}>
              {list.matchScore}% collection similarity — {list.matchLabel}
            </p>
          )}
        </div>
        {canSave && (
          <button
            onClick={onSave}
            style={{
              fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase",
              background: "none", border: `1px solid ${isSaved ? RULE : ORANGE}`,
              color: isSaved ? MUTED : ORANGE, cursor: "pointer", padding: "3px 10px", flexShrink: 0,
            }}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function activityVerb(eventType: ActivityItem["eventType"]): string {
  if (eventType === "play") return "just logged a play of";
  if (eventType === "wantlist_add") return "added";
  return "added";
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const name = item.actor.displayName ?? item.actor.username;
  const suffix = item.eventType === "wantlist_add" ? " to their wantlist"
    : item.eventType === "collection_add" ? " to their collection"
    : "";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 0", borderBottom: `1px solid ${RULE}` }}>
      <Link href={`/@${item.actor.username}`} style={{ flexShrink: 0 }}>
        <Avatar avatarUrl={item.actor.avatarUrl} name={item.actor.displayName} username={item.actor.username} size={36} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.88rem", color: INK, margin: "0 0 4px", lineHeight: 1.45 }}>
          <Link href={`/@${item.actor.username}`} style={{ textDecoration: "none", color: INK, fontWeight: 600 }}>{name}</Link>
          {item.match && (
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: ORANGE, marginLeft: "6px" }}>
              ({item.match.score}% match)
            </span>
          )}
          {" "}{activityVerb(item.eventType)}{" "}
          <span style={{ fontStyle: "italic" }}>{item.record.album}</span>
          {" by "}{item.record.artist}{suffix}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: MUTED, margin: 0, textTransform: "uppercase" }}>
          {relativeTime(item.createdAt)}
        </p>
      </div>
      {item.record.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.record.coverUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0, background: "#f0ede8" }} />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CommunityTab({ profileOwnerId, hideSocialPanel = false, initialTrending }: { profileOwnerId: string; hideSocialPanel?: boolean; initialTrending?: TrendingRecord[] }) {
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const viewerUserIdRef  = useRef<string | null>(null);
  const pendingTogglesRef = useRef<Set<string>>(new Set());
  const [subTab,       setSubTab]       = useState<SubTab>("trending");
  const [searchQuery,  setSearchQuery]  = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Followers / Following sections
  const [followers,        setFollowers]        = useState<Follower[]>([]);
  const [following,        setFollowing]        = useState<Follower[]>([]);
  const [followersLoaded,  setFollowersLoaded]  = useState(false);

  // Matches
  const [matches,        setMatches]        = useState<Match[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchOffset,    setMatchOffset]    = useState(0);
  const [allMatchTotal,  setAllMatchTotal]  = useState(0);

  // Collectors I Follow — activity feed
  const [activityItems,     setActivityItems]     = useState<ActivityItem[]>([]);
  const [activityState,     setActivityState]     = useState<"idle" | "loading" | "done">("idle");
  const [activityCursor,    setActivityCursor]    = useState<string | null>(null);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);

  // All collectors
  const [collectors,        setCollectors]        = useState<Collector[]>([]);
  const [collectorsLoading, setCollectorsLoading] = useState(false);

  // Lists from network
  const [lists,      setLists]      = useState<ListEntry[]>([]);
  const [listsState, setListsState] = useState<"idle" | "loading" | "done">("idle");

  // Saved lists
  const [savedLists,      setSavedLists]      = useState<ListEntry[]>([]);
  const [savedListsState, setSavedListsState] = useState<"idle" | "loading" | "done">("idle");

  // Save state (list id → saved bool)
  const [saveState, setSaveState] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Follow state
  const [followState,  setFollowState]  = useState<Record<string, boolean>>({});
  const [followError,  setFollowError]  = useState<string | null>(null);

  const [socialOpen,       setSocialOpen]       = useState(true);
  const [followingExpanded, setFollowingExpanded] = useState(false);
  const [followersExpanded, setFollowersExpanded] = useState(false);
  const SOCIAL_CAP = 30;

  // Get viewer + load followers on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const id = user?.id ?? null;
      viewerUserIdRef.current = id;
      setViewerUserId(id);
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
    fetch(`/api/collectors/matches?userId=${encodeURIComponent(profileOwnerId)}&offset=${matchOffset}`)
      .then(r => r.ok ? r.json() : { matches: [] })
      .then(d => {
        const list: Match[] = d.matches ?? [];
        setMatches(list);
        setAllMatchTotal((d.allScores ?? []).length);
        const fs: Record<string, boolean> = {};
        for (const m of list) fs[m.userId] = m.isFollowing;
        setFollowState(prev => ({ ...prev, ...fs }));
      })
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, profileOwnerId, matches, matchOffset]);

  // Load Collectors I Follow activity feed when tab is active (lazy)
  useEffect(() => {
    if (subTab !== "following" || activityState !== "idle") return;
    setActivityState("loading");
    fetch("/api/community/following-activity")
      .then(r => r.ok ? r.json() : { items: [], nextCursor: null })
      .then(d => {
        setActivityItems(d.items ?? []);
        setActivityCursor(d.nextCursor ?? null);
        setActivityState("done");
      })
      .catch(() => setActivityState("done"));
  }, [subTab, activityState]);

  async function loadMoreActivity() {
    if (!activityCursor || activityLoadingMore) return;
    setActivityLoadingMore(true);
    try {
      const res = await fetch(`/api/community/following-activity?cursor=${encodeURIComponent(activityCursor)}`);
      const data = await res.json() as { items?: ActivityItem[]; nextCursor?: string | null };
      setActivityItems(prev => [...prev, ...(data.items ?? [])]);
      setActivityCursor(data.nextCursor ?? null);
    } finally {
      setActivityLoadingMore(false);
    }
  }

  // Load collectors with debounced search, excluding already-followed users.
  // Uses refs (not state) for viewerUserId and pendingToggles so this callback
  // is stable across renders and never triggers a spurious re-fetch.
  const loadCollectors = useCallback(async (query: string) => {
    setCollectorsLoading(true);
    try {
      const supabase = createClient();
      const vid = viewerUserIdRef.current;

      // Fetch who the viewer already follows so we can exclude them from the list
      const excludeIds = new Set<string>(vid ? [vid] : []);
      if (vid) {
        const { data: followedRows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", vid);
        for (const r of followedRows ?? []) excludeIds.add(r.following_id);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, city, country, is_donor")
        .eq("is_public", true)
        .eq("is_test", false)
        .limit(50);

      if (excludeIds.size > 0) {
        q = q.not("id", "in", `(${[...excludeIds].join(",")})`);
      }

      if (query.trim()) {
        q = q.or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`);
      } else {
        q = q.order("username", { ascending: true });
      }

      const { data } = await q;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profiles = (data ?? []).map((p: any) => ({ ...p, collectionScore: null, styleScore: null })) as Collector[];
      setCollectors(profiles);

      if (vid && profiles.length > 0) {
        const ids = profiles.map(c => c.id);

        const scoresRes = await fetch(`/api/collectors/batch-scores?targetIds=${ids.join(",")}`)
          .then(r => r.ok ? r.json() : { scores: [] });

        const scoreMap = new Map<string, { collectionScore: number | null; styleScore: number }>(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (scoresRes.scores ?? []).map((s: any) => [s.userId, { collectionScore: s.collectionScore, styleScore: s.styleScore }])
        );

        setCollectors(profiles.map(c => ({ ...c, ...(scoreMap.get(c.id) ?? {}) })));
      }
    } finally {
      setCollectorsLoading(false);
    }
  }, []); // stable — reads viewerUserId from ref, not closure

  useEffect(() => {
    if (subTab !== "collectors") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadCollectors(searchQuery), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subTab, searchQuery, loadCollectors]);

  async function toggleFollow(targetId: string, targetProfile?: Follower) {
    if (!viewerUserId || targetId === viewerUserId) return;
    if (pendingTogglesRef.current.has(targetId)) return;

    const prev = followState[targetId] ?? false;
    pendingTogglesRef.current.add(targetId);
    setFollowState(s => ({ ...s, [targetId]: !prev }));
    setFollowError(null);
    try {
      const res = await fetch("/api/collectors/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: targetId, action: prev ? "unfollow" : "follow" }),
      });
      const data = await res.json() as { isFollowing?: boolean; error?: string };
      if (!res.ok || typeof data.isFollowing !== "boolean") {
        setFollowState(s => ({ ...s, [targetId]: prev }));
        setFollowError(`Follow failed (${res.status}): ${data.error ?? "unknown error"}`);
        return;
      }
      setFollowState(s => ({ ...s, [targetId]: data.isFollowing! }));

      if (data.isFollowing && targetProfile) {
        setFollowing(p => p.some(f => f.id === targetId) ? p : [targetProfile, ...p]);
        // Remove from All Collectors immediately — that tab only shows un-followed users
        setCollectors(prev => prev.filter(c => c.id !== targetId));
      } else if (!data.isFollowing) {
        setFollowing(p => p.filter(f => f.id !== targetId));
      }
    } catch (err) {
      setFollowState(s => ({ ...s, [targetId]: prev }));
      setFollowError(`Network error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      pendingTogglesRef.current.delete(targetId);
    }
  }

  // Load lists when tab is active (lazy)
  useEffect(() => {
    if (subTab !== "lists" || listsState !== "idle") return;
    setListsState("loading");
    fetch("/api/lists/following")
      .then(r => r.ok ? r.json() : { lists: [] })
      .then(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries: ListEntry[] = (d.lists ?? []).map((l: any) => ({
          id: l.id, title: l.title, slug: l.slug,
          userId: l.userId ?? "",
          username: l.username, displayName: l.displayName ?? null,
          covers: l.covers ?? [], itemCount: l.itemCount ?? 0,
          recordCount: l.recordCount ?? 0,
          isSaved: l.isSaved ?? false,
          matchScore: l.matchScore, matchLabel: l.matchLabel,
        }));
        setLists(entries);
        const ss: Record<string, boolean> = {};
        for (const l of entries) ss[l.id] = l.isSaved;
        setSaveState(prev => ({ ...prev, ...ss }));
        setListsState("done");
      })
      .catch(() => setListsState("done"));
  }, [subTab, listsState]);

  // Load saved lists when tab is active (lazy)
  useEffect(() => {
    if (subTab !== "saved" || savedListsState !== "idle") return;
    setSavedListsState("loading");
    fetch("/api/lists/saved")
      .then(r => r.ok ? r.json() : { lists: [] })
      .then(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries: ListEntry[] = (d.lists ?? []).map((l: any) => ({
          id: l.id, title: l.title, slug: l.slug,
          userId: l.userId ?? "",
          username: l.username, displayName: l.displayName ?? null,
          covers: l.covers ?? [], itemCount: l.itemCount ?? 0,
          recordCount: l.recordCount ?? 0,
          isSaved: true,
          matchScore: l.matchScore, matchLabel: l.matchLabel,
        }));
        setSavedLists(entries);
        const ss: Record<string, boolean> = {};
        for (const l of entries) ss[l.id] = true;
        setSaveState(prev => ({ ...prev, ...ss }));
        setSavedListsState("done");
      })
      .catch(() => setSavedListsState("done"));
  }, [subTab, savedListsState]);

  async function toggleSaveList(listId: string) {
    if (!viewerUserId) return;
    const prev = saveState[listId] ?? false;
    setSaveState(s => ({ ...s, [listId]: !prev }));
    setSaveError(null);
    try {
      const res = await fetch("/api/lists/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
      });
      const data = await res.json() as { saved?: boolean; error?: string };
      if (typeof data.saved === "boolean") {
        setSaveState(s => ({ ...s, [listId]: data.saved! }));
        if (savedListsState === "done") setSavedListsState("idle");
      } else {
        setSaveError(`Save failed (${res.status}): ${data.error ?? "unknown"}`);
        setSaveState(s => ({ ...s, [listId]: prev }));
      }
    } catch (err) {
      setSaveError(`Network error: ${err instanceof Error ? err.message : "unknown"}`);
      setSaveState(s => ({ ...s, [listId]: prev }));
    }
  }

  const TABS: Array<{ key: SubTab; label: string }> = [
    { key: "trending",   label: "Popular" },
    { key: "matches",    label: "Top Matches" },
    { key: "following",  label: "Collectors I Follow" },
    { key: "offers",     label: "Open to Offers" },
    { key: "collectors", label: "Discover" },
    { key: "lists",      label: "Lists" },
    { key: "saved",      label: "Saved Lists" },
  ];

  return (
    <div style={{ width: "100%", padding: "24px 1.5rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* ── Followers + Following (collapsible) ───────────────────────────────── */}
        {!hideSocialPanel && followersLoaded && (
          <div style={{ marginBottom: "32px", paddingBottom: "28px", borderBottom: `1px solid ${RULE}` }}>
            <button
              onClick={() => setSocialOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}
            >
              <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0 }}>
                Connections
              </p>
              <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: MUTED }}>
                {following.length} following · {followers.length} followers
              </span>
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: "0.55rem", color: MUTED, lineHeight: 1 }}>
                {socialOpen ? "▲" : "▼"}
              </span>
            </button>

            {socialOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "16px" }}>
                {/* Following — who this profile follows */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
                    <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0 }}>Following</p>
                    <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED }}>{following.length}</span>
                  </div>
                  {following.length === 0 ? (
                    <p style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, lineHeight: 1.6 }}>Not following anyone yet.</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {(followingExpanded ? following : following.slice(0, SOCIAL_CAP)).map(f => (
                          <Link key={f.id} href={`/@${f.username}`} title={f.display_name ?? f.username} style={{ textDecoration: "none", position: "relative", display: "inline-block" }}>
                            <Avatar avatarUrl={f.avatar_url} name={f.display_name} username={f.username} size={38} />
                            {f.is_donor && <span style={{ position: "absolute", bottom: -1, right: -1, fontFamily: SERIF, fontSize: "9px", color: GOLD, lineHeight: 1, background: "#fff", borderRadius: "50%", padding: "1px" }} title="rekōdo supporter">ō</span>}
                          </Link>
                        ))}
                      </div>
                      {following.length > SOCIAL_CAP && (
                        <button onClick={() => setFollowingExpanded(e => !e)} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "8px 0 0", textDecoration: "underline" }}>
                          {followingExpanded ? "Show less" : `See all ${following.length}`}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Followers — who follows this profile */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
                    <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0 }}>Followers</p>
                    <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED }}>{followers.length}</span>
                  </div>
                  {followers.length === 0 ? (
                    <p style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, lineHeight: 1.6 }}>No followers yet.</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {(followersExpanded ? followers : followers.slice(0, SOCIAL_CAP)).map(f => (
                          <Link key={f.id} href={`/@${f.username}`} title={f.display_name ?? f.username} style={{ textDecoration: "none", position: "relative", display: "inline-block" }}>
                            <Avatar avatarUrl={f.avatar_url} name={f.display_name} username={f.username} size={38} />
                            {f.is_donor && <span style={{ position: "absolute", bottom: -1, right: -1, fontFamily: SERIF, fontSize: "9px", color: GOLD, lineHeight: 1, background: "#fff", borderRadius: "50%", padding: "1px" }} title="rekōdo supporter">ō</span>}
                          </Link>
                        ))}
                      </div>
                      {followers.length > SOCIAL_CAP && (
                        <button onClick={() => setFollowersExpanded(e => !e)} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "8px 0 0", textDecoration: "underline" }}>
                          {followersExpanded ? "Show less" : `See all ${followers.length}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Follow error banner — only visible when a follow action fails */}
        {followError && (
          <div style={{ fontFamily: MONO, fontSize: "0.58rem", color: "#c00", background: "#fff5f5", border: "1px solid #fcc", padding: "8px 12px", marginBottom: "16px", letterSpacing: "0.04em" }}>
            {followError}
          </div>
        )}

        {/* Search bar */}
        <input
          type="text"
          className="rk-form-input"
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

        {/* Sub-tabs — desktop: scrollable tab bar; mobile: dropdown select */}
        <div className="rk-community-tabs" style={{ display: "flex", borderBottom: `1px solid ${RULE}`, marginBottom: "28px" }}>
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
        <select
          className="rk-community-select"
          value={subTab}
          onChange={e => setSubTab(e.target.value as SubTab)}
          style={{
            width: "100%", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.06em",
            textTransform: "uppercase", color: INK, background: "#fafaf8",
            border: `1px solid ${RULE}`, padding: "10px 14px", outline: "none",
            boxSizing: "border-box", marginBottom: "24px", cursor: "pointer",
          }}
        >
          {TABS.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        {/* ── Top Matches ────────────────────────────────────────────────────── */}
        {subTab === "trending" && <TrendingRecords initialRecords={initialTrending} />}
        {subTab === "offers"   && <OpenToOffers />}

        {subTab === "matches" && (
          <>
            {!matchesLoading && matches !== null && allMatchTotal > 6 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginBottom: "14px" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.04em" }}>
                  {matchOffset + 1}–{Math.min(matchOffset + 6, allMatchTotal)} of {allMatchTotal}
                </span>
                <button
                  onClick={() => {
                    const next = matchOffset + 6 >= allMatchTotal ? 0 : matchOffset + 6;
                    setMatchOffset(next);
                    setMatches(null);
                  }}
                  style={{
                    fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase",
                    background: "none", border: `1px solid ${RULE}`, color: MUTED,
                    cursor: "pointer", padding: "5px 12px",
                  }}
                >
                  {matchOffset + 6 >= allMatchTotal ? "← Start" : "Next →"}
                </button>
              </div>
            )}
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
                    onFollow={() => toggleFollow(m.userId, { id: m.userId, username: m.username, display_name: m.displayName, avatar_url: m.avatarUrl, is_donor: null })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Collectors I Follow ────────────────────────────────────────────── */}
        {subTab === "following" && (
          <>
            {activityState === "loading" && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.08em" }}>Loading…</p>
            )}
            {activityState === "done" && activityItems.length === 0 && (
              <div style={{ paddingTop: "16px" }}>
                <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, marginBottom: "8px" }}>No activity yet.</p>
                <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
                  Follow some collectors to see when they log a play, or add to their wantlist or collection. Check All Collectors or Top Matches to find people to follow.
                </p>
              </div>
            )}
            {activityState === "done" && activityItems.length > 0 && (
              <div>
                {activityItems.map(item => <ActivityRow key={item.id} item={item} />)}
                {activityCursor && (
                  <div style={{ textAlign: "center", paddingTop: "18px" }}>
                    <button
                      onClick={loadMoreActivity}
                      disabled={activityLoadingMore}
                      style={{
                        fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase",
                        background: "none", border: `1px solid ${RULE}`, color: ORANGE,
                        cursor: activityLoadingMore ? "default" : "pointer", padding: "8px 18px",
                      }}
                    >
                      {activityLoadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
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

        {/* ── Lists ───────────────────────────────────────────────────────────── */}
        {subTab === "lists" && (
          <>
            {saveError && (
              <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#ef4444", letterSpacing: "0.04em", marginBottom: "12px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                {saveError}
              </p>
            )}
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
                {lists.map(list => (
                  <ListCard
                    key={list.id}
                    list={list}
                    isSaved={saveState[list.id] ?? list.isSaved}
                    canSave={!!viewerUserId}
                    onSave={() => toggleSaveList(list.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Saved Lists ─────────────────────────────────────────────────────── */}
        {subTab === "saved" && (
          <>
            {saveError && (
              <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#ef4444", letterSpacing: "0.04em", marginBottom: "12px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                {saveError}
              </p>
            )}
            {savedListsState === "loading" && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED, letterSpacing: "0.08em" }}>Loading…</p>
            )}
            {savedListsState === "done" && savedLists.length === 0 && (
              <div style={{ paddingTop: "16px" }}>
                <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, marginBottom: "8px" }}>No saved lists yet.</p>
                <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
                  Browse Lists to find Top 5s worth saving. Hit Save on any list to pin it here.
                </p>
              </div>
            )}
            {savedListsState === "done" && savedLists.length > 0 && (
              <div>
                {savedLists.map(list => (
                  <ListCard
                    key={list.id}
                    list={list}
                    isSaved={saveState[list.id] ?? true}
                    canSave={!!viewerUserId}
                    onSave={() => toggleSaveList(list.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
