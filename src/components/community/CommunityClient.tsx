"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CommunitySidebar from "./CommunitySidebar";
import CommunityTab from "./CommunityTab";
import type { TrendingRecord } from "@/lib/trendingRecords";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";
const GOLD   = "#C9A84C";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";

type TierItem = { userId: string; score: number; sharedTags: string[] };

type EnrichedUser = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isDonor: boolean;
  location: string | null;
  recordCount: number;
  score: number;
  styleScore: number;
  label: string;
  description: string;
  sharedTags: string[];
  isFollowing: boolean;
};

function compatLabel(score: number): { label: string; description: string } {
  if (score >= 55) return { label: "Twins",                          description: "One of you is the other's alt account. Uncanny." };
  if (score >= 35) return { label: "Same Record, Different Pressing", description: "Same music. Different origin story." };
  if (score >= 20) return { label: "Bandmates",                      description: "You're making the same music, just in different rooms." };
  if (score >= 10) return { label: "Label Mate",                     description: "Same label, different artist. You get it." };
  if (score >=  5) return { label: "The A Side to My B",             description: "Different but part of the same record." };
  if (score >=  2) return { label: "Regular at the Same Shop",       description: "You've definitely flipped through the same crates." };
  if (score >=  1) return { label: "Passing Acquaintance",           description: "You'd nod at each other in a record shop." };
  return               { label: "Complete Stranger",                  description: "Your collections have almost nothing in common. Interesting." };
}

function Avatar({ avatarUrl, name, username, size = 28 }: {
  avatarUrl: string | null; name: string | null; username: string; size?: number;
}) {
  const init = name
    ? name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase()
    : (username[0] ?? "?").toUpperCase();
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

function MatchCard({ user, onFollow }: { user: EnrichedUser; onFollow: () => void }) {
  return (
    <div style={{ border: `1px solid ${RULE}`, padding: "20px 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link href={`/@${user.username}`} style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}>
          <Avatar avatarUrl={user.avatarUrl} name={user.displayName} username={user.username} size={28} />
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.05em", color: INK }}>@{user.username}</span>
            {user.isDonor && <span style={{ fontFamily: SERIF, fontSize: "0.75rem", color: GOLD }} title="rekōdo supporter">ō</span>}
          </span>
        </Link>
      </div>

      <div>
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE }}>{user.score}% Collection Similarity</span>
        <br />
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>{user.styleScore}% Style Similarity</span>
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.85rem", color: "#505050", lineHeight: 1.4, margin: "5px 0 0" }}>
          {user.label}
        </p>
      </div>

      {user.sharedTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {user.sharedTags.map(tag => (
            <span key={tag} style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", border: `1px solid ${RULE}`, padding: "2px 6px" }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: `1px solid ${RULE}`, marginTop: "auto" }}>
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.04em" }}>
          {user.location ? `${user.location} · ` : ""}{user.recordCount.toLocaleString()} records
        </span>
        <button
          onClick={onFollow}
          style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: `1px solid ${user.isFollowing ? RULE : ORANGE}`, color: user.isFollowing ? MUTED : ORANGE, cursor: "pointer", padding: "3px 10px" }}
        >
          {user.isFollowing ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}

function TierPanel({ tier, items, viewerId, onClose }: {
  tier: string; items: TierItem[]; viewerId: string; onClose: () => void;
}) {
  const [users,    setUsers]   = useState<EnrichedUser[]>([]);
  const [loading,  setLoading] = useState(true);
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (items.length === 0) { setLoading(false); return; }
    const supabase = createClient();
    const ids = items.map(i => i.userId);

    const PAGE = 1000;
    async function fetchRecordCounts(userIds: string[]): Promise<Map<string, number>> {
      const map = new Map<string, number>();
      for (let from = 0; ; from += PAGE) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("public_collection_summary")
          .select("user_id")
          .in("user_id", userIds)
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        for (const r of data) map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
        if (data.length < PAGE) break;
      }
      return map;
    }

    Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, is_donor, city, country").in("id", ids),
      supabase.from("follows").select("following_id").eq("follower_id", viewerId).in("following_id", ids),
      fetchRecordCounts(ids),
      fetch(`/api/collectors/batch-scores?targetIds=${ids.join(",")}`).then(r => r.ok ? r.json() : { scores: [] }),
    ]).then(([profilesRes, followsRes, recCount, scoresData]) => {
      const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const followedSet = new Set((followsRes.data ?? []).map((f: any) => f.following_id));
      const styleMap = new Map<string, number>(
        (scoresData.scores ?? []).map((s: any) => [s.userId, s.styleScore])
      );

      const fs: Record<string, boolean> = {};
      const enriched: EnrichedUser[] = [];
      for (const item of items) {
        const p = profileMap.get(item.userId);
        if (!p) continue;
        const { label, description } = compatLabel(item.score);
        fs[item.userId] = followedSet.has(item.userId);
        enriched.push({
          userId:      item.userId,
          username:    p.username,
          displayName: p.display_name,
          avatarUrl:   p.avatar_url,
          isDonor:     p.is_donor ?? false,
          location:    p.city && p.country ? `${p.city}, ${p.country}` : (p.city ?? null),
          recordCount: recCount.get(item.userId) ?? 0,
          score:       item.score,
          styleScore:  styleMap.get(item.userId) ?? 0,
          label,
          description,
          sharedTags:  item.sharedTags,
          isFollowing: followedSet.has(item.userId),
        });
      }
      setUsers(enriched);
      setFollowState(fs);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  async function toggleFollow(userId: string) {
    const isFollowing = followState[userId] ?? false;
    setFollowState(prev => ({ ...prev, [userId]: !isFollowing }));
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, isFollowing: !isFollowing } : u));
    await fetch("/api/collectors/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: userId, follow: !isFollowing }),
    });
  }

  return (
    <div style={{ padding: "24px 1.5rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "24px", paddingBottom: "12px", borderBottom: `1px solid ${RULE}` }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: "0 0 4px" }}>Collection Similarity</p>
            <p style={{ fontFamily: SERIF, fontSize: "1.3rem", color: INK, margin: 0 }}>{tier}</p>
          </div>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>
            ← back
          </button>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ border: `1px solid ${RULE}`, padding: "20px 18px", height: 140 }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED }}>No collectors in this tier yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {users.map(u => (
              <MatchCard key={u.userId} user={u} onFollow={() => toggleFollow(u.userId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityClient({ profileId, username, displayName, avatarUrl, initialTrending }: {
  profileId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  initialTrending?: TrendingRecord[];
}) {
  const [activeTier,   setActiveTier]   = useState<string | null>(null);
  const [tierItems,    setTierItems]    = useState<Map<string, TierItem[]>>(new Map());
  const [searchQuery,  setSearchQuery]  = useState("");

  return (
    <div className="rk-community-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "24px", maxWidth: 1280, margin: "0 auto", paddingLeft: "0", paddingRight: "32px" }}>
      <CommunitySidebar
        profileOwnerId={profileId}
        onTierClick={(tier, items) => {
          setTierItems(prev => new Map(prev).set(tier, items));
          setActiveTier(prev => prev === tier ? null : tier);
        }}
        activeTier={activeTier}
        onTierData={setTierItems}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div style={{ minWidth: 0 }}>
        {activeTier ? (
          <TierPanel
            tier={activeTier}
            items={tierItems.get(activeTier) ?? []}
            viewerId={profileId}
            onClose={() => setActiveTier(null)}
          />
        ) : (
          <CommunityTab profileOwnerId={profileId} hideSocialPanel initialTrending={initialTrending} searchQuery={searchQuery} />
        )}
      </div>
    </div>
  );
}
