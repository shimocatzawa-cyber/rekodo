"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const GOLD   = "#C9A84C";

type Match = {
  userId:        string;
  username:      string;
  displayName:   string | null;
  location:      string | null;
  recordCount:   number;
  followerCount: number;
  score:         number;
  label:         string;
  description:   string;
  sharedTags:    string[];
  isFollowing:   boolean;
  isDonor:       boolean;
};

interface Props {
  userId:        string;   // whose matches to show
  currentUserId: string | null;  // viewer (null = anonymous)
}

export default function CollectorsLikeYou({ userId, currentUserId }: Props) {
  const [matches,     setMatches]     = useState<Match[] | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/collectors/matches?userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : { matches: [] })
      .then(d => {
        const list: Match[] = d.matches ?? [];
        setMatches(list);
        const state: Record<string, boolean> = {};
        for (const m of list) state[m.userId] = m.isFollowing;
        setFollowState(state);
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [userId]);

  async function toggleFollow(targetId: string) {
    const prev = followState[targetId] ?? false;
    setFollowState(s => ({ ...s, [targetId]: !prev }));
    try {
      const res = await fetch("/api/collectors/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: targetId, action: prev ? "unfollow" : "follow" }),
      });
      if (!res.ok) setFollowState(s => ({ ...s, [targetId]: prev }));
    } catch {
      setFollowState(s => ({ ...s, [targetId]: prev }));
    }
  }

  if (loading) {
    return (
      <section style={{ marginTop: "56px" }}>
        <p style={{
          fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#dddddd", margin: 0,
        }}>
          Finding collectors like you…
        </p>
      </section>
    );
  }

  if (!matches || matches.length === 0) return null;

  return (
    <section style={{ marginTop: "56px" }}>
      <p style={{
        fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
        textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 24px 0",
      }}>
        Collectors Like You
      </p>

      <div className="rk-collectors-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {matches.map(match => (
          <CollectorCard
            key={match.userId}
            match={match}
            isFollowing={followState[match.userId] ?? false}
            canFollow={!!currentUserId && currentUserId !== match.userId}
            onFollow={() => toggleFollow(match.userId)}
          />
        ))}
      </div>
    </section>
  );
}

function CollectorCard({ match, isFollowing, canFollow, onFollow }: {
  match:       Match;
  isFollowing: boolean;
  canFollow:   boolean;
  onFollow:    () => void;
}) {
  const initial = (match.displayName || match.username).charAt(0).toUpperCase();

  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.08)",
      padding: "18px 18px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}>

      {/* Header: avatar + username + score */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href={`/@${match.username}`} style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: "50%",
            background: ORANGE, color: "#ffffff",
            fontFamily: MONO, fontSize: "10px", fontWeight: 600,
            textTransform: "uppercase", flexShrink: 0,
          }}>
            {initial}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.05em", color: "#0d0d0d" }}>
              @{match.username}
            </span>
            {match.isDonor && (
              <span style={{ fontFamily: SERIF, fontSize: "0.8em", color: GOLD }} title="rekōdo supporter">ō</span>
            )}
          </span>
        </Link>
        <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.03em", color: ORANGE, flexShrink: 0 }}>
          {match.score}%
        </span>
      </div>

      {/* Compatibility label */}
      <p style={{
        fontFamily: SERIF, fontStyle: "italic", fontSize: "13px",
        color: "#505050", lineHeight: 1.4, margin: 0,
      }}>
        {match.label}
      </p>

      {/* Shared tags */}
      {match.sharedTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {match.sharedTags.map(tag => (
            <span key={tag} style={{
              fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#888888",
              border: "1px solid rgba(0,0,0,0.10)",
              padding: "2px 6px",
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: meta + follow button */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginTop: "auto",
        paddingTop: "6px", borderTop: "1px solid rgba(0,0,0,0.05)",
      }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#cccccc", margin: 0 }}>
          {match.location && `${match.location} · `}{match.recordCount} records
        </p>
        {canFollow && (
          <button
            onClick={onFollow}
            style={{
              fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em",
              textTransform: "uppercase", background: "none",
              border: `1px solid ${isFollowing ? "rgba(0,0,0,0.12)" : ORANGE}`,
              color: isFollowing ? "#aaaaaa" : ORANGE,
              cursor: "pointer", padding: "3px 9px",
              transition: "all 0.15s", flexShrink: 0,
            }}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>

    </div>
  );
}
