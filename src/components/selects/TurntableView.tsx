"use client";

import { useState, useEffect } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

interface TurntablePost {
  id: string;
  published_at: string;
  artist: string;
  album: string;
  cover_url: string | null;
  body: string;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function TurntableEntry({ post, isFirst }: { post: TurntablePost; isFirst: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const coverSrc = post.cover_url
    ? (post.cover_url.startsWith("/") ? post.cover_url : `/api/image-proxy?url=${encodeURIComponent(post.cover_url)}`)
    : null;

  return (
    <div
      className="rk-turntable-entry"
      style={{
        display: "flex", gap: 40, alignItems: "flex-start",
        padding: "48px 0",
        borderTop: isFirst ? "none" : `1px solid ${RULE}`,
      }}
    >
      {/* Album art */}
      <div className="rk-turntable-art" style={{ width: 200, flexShrink: 0 }}>
        <div style={{
          width: 200, height: 200,
          background: "#f0ede8",
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {coverSrc && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={`${post.artist} — ${post.album}`}
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <span style={{ fontFamily: MONO, fontSize: "10px", color: "#bbbbbb", textAlign: "center", padding: "0 12px" }}>
              {post.artist}
            </span>
          )}
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em",
          textTransform: "uppercase", color: ORANGE, margin: "0 0 14px", fontWeight: 400,
        }}>
          {formatDate(post.published_at)}
        </p>

        <h2 style={{
          fontFamily: SERIF, fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 600,
          color: INK, margin: "0 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em",
        }}>
          {post.artist}
        </h2>

        <p style={{
          fontFamily: MONO, fontSize: "12px", color: "#888888",
          margin: "0 0 24px", fontWeight: 400, letterSpacing: "0.02em",
        }}>
          {post.album}
        </p>

        <div style={{ height: 1, background: RULE, margin: "0 0 24px" }} />

        <div>
          {post.body.split("\n\n").map((para, i) => (
            <p key={i} style={{
              fontFamily: MONO, fontSize: "12px", lineHeight: 1.85,
              color: INK, margin: i > 0 ? "16px 0 0" : 0, fontWeight: 400,
            }}>
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TurntableView() {
  const [posts, setPosts]     = useState<TurntablePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/turntable")
      .then(r => r.json())
      .then((data: { posts: TurntablePost[] }) => setPosts(data.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        {[1, 2].map(i => (
          <div key={i} style={{ display: "flex", gap: 40, padding: "48px 0", borderTop: i > 1 ? `1px solid ${RULE}` : "none" }}>
            <div className="nr-shimmer" style={{ width: 200, height: 200, background: "#f0ede8", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="nr-shimmer" style={{ height: 10, background: "#f0ede8", width: 120 }} />
              <div className="nr-shimmer" style={{ height: 28, background: "#f0ede8", width: "50%" }} />
              <div className="nr-shimmer" style={{ height: 12, background: "#f0ede8", width: 180 }} />
              <div style={{ height: 1, background: RULE }} />
              {[1, 2, 3].map(j => (
                <div key={j} className="nr-shimmer" style={{ height: 12, background: "#f0ede8", width: j === 3 ? "60%" : "100%" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div style={{ paddingTop: 24 }}>
        <p style={{
          fontFamily: MONO, fontSize: "11px", color: "#aaaaaa",
          lineHeight: 1.75, letterSpacing: "0.03em",
        }}>
          No entries yet. Posts published from the admin panel will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post, i) => (
        <TurntableEntry key={post.id} post={post} isFirst={i === 0} />
      ))}
    </div>
  );
}
