"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0a0a0a";
const MUTED  = "#aaaaaa";
const GOLD   = "#C9A84C";

type ShelfPost = {
  id:          string;
  imageUrl:    string;
  createdAt:   string;
  userId:      string;
  username:    string;
  displayName: string | null;
  avatarUrl:   string | null;
  isDonor:     boolean;
  likeCount:   number;
  likedByMe:   boolean;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? ORANGE : "none"} stroke={filled ? ORANGE : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShelfLightbox({ post, onClose, onLike, viewerLoggedIn }: {
  post: ShelfPost;
  onClose: () => void;
  onLike: () => void;
  viewerLoggedIn: boolean;
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ background: "#fff", maxWidth: 600, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${RULE}`, flexShrink: 0 }}>
          <Link href={`/@${post.username}`} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.06em", color: INK }}>@{post.username}</span>
            {post.isDonor && <span style={{ fontFamily: SERIF, fontSize: "0.75rem", color: GOLD }} title="rekōdo supporter">ō</span>}
          </Link>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "1.1rem", color: MUTED, background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Image */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={`${post.username}'s record shelf`} style={{ width: "100%", display: "block" }} />
        </div>

        {/* Footer: like */}
        <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${RULE}`, flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          {viewerLoggedIn ? (
            <button
              onClick={onLike}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: `1px solid ${post.likedByMe ? ORANGE : RULE}`, padding: "6px 14px", cursor: "pointer" }}
            >
              <HeartIcon filled={post.likedByMe} />
              <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", color: post.likedByMe ? ORANGE : MUTED }}>
                {post.likeCount > 0 ? post.likeCount : ""} {post.likedByMe ? "Liked" : "Like"}
              </span>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <HeartIcon filled={false} />
              <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", color: MUTED }}>{post.likeCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShelfWall({ viewerLoggedIn }: { viewerLoggedIn: boolean }) {
  const [posts,   setPosts]   = useState<ShelfPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [active,  setActive]  = useState<ShelfPost | null>(null);

  useEffect(() => {
    fetch("/api/shelf/wall")
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(d => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleLike(postId: string) {
    if (!viewerLoggedIn) return;
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1 }
        : p
    ));
    if (active?.id === postId) {
      setActive(prev => prev ? { ...prev, likedByMe: !prev.likedByMe, likeCount: prev.likedByMe ? prev.likeCount - 1 : prev.likeCount + 1 } : prev);
    }
    await fetch("/api/shelf/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
  }

  if (loading) {
    return (
      <div style={{ padding: "28px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "12px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: "560/660", background: "#f0ede8" }} className="nr-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, margin: "0 0 8px" }}>No shelves shared yet.</p>
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
          Open your Record Shelf card on the Insights page and hit &ldquo;Share with Rekōdo&rsquo;s Community&rdquo; to be first.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "12px" }}>
        {posts.map(post => (
          <div key={post.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Card thumbnail */}
            <button
              onClick={() => setActive(post)}
              style={{ all: "unset", cursor: "pointer", display: "block", position: "relative", aspectRatio: "560/660", background: "#f0ede8", overflow: "hidden", outline: `1px solid ${RULE}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl}
                alt={`${post.username}'s record shelf`}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", display: "block", transition: "transform 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
              />
            </button>

            {/* Username + likes */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
              <Link href={`/@${post.username}`} style={{ textDecoration: "none", minWidth: 0, overflow: "hidden" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.06em", color: INK, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  @{post.username}
                  {post.isDonor && <span style={{ fontFamily: SERIF, fontSize: "0.65rem", color: GOLD, marginLeft: "3px" }}>ō</span>}
                </span>
              </Link>
              <button
                onClick={() => toggleLike(post.id)}
                disabled={!viewerLoggedIn}
                style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: viewerLoggedIn ? "pointer" : "default", padding: "2px 0", flexShrink: 0 }}
              >
                <HeartIcon filled={post.likedByMe} />
                {post.likeCount > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: "0.48rem", color: post.likedByMe ? ORANGE : MUTED, letterSpacing: "0.04em" }}>{post.likeCount}</span>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <ShelfLightbox
          post={active}
          onClose={() => setActive(null)}
          onLike={() => toggleLike(active.id)}
          viewerLoggedIn={viewerLoggedIn}
        />
      )}
    </div>
  );
}
