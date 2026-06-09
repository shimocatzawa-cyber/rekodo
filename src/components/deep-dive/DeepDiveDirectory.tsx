"use client";

import { useState } from "react";
import Link from "next/link";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const JP     = "var(--font-noto-jp), sans-serif";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

export type ArtistEntry = {
  artist: string;
  count: number;
};

export default function DeepDiveDirectory({
  artists,
  username,
  displayLabel,
  avatarUrl,
}: {
  artists: ArtistEntry[];
  username: string;
  displayLabel?: string;
  avatarUrl?: string | null;
}) {
  const [query, setQuery] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void displayLabel; void avatarUrl;

  const filtered = query.trim()
    ? artists.filter((a) =>
        a.artist.toLowerCase().includes(query.trim().toLowerCase())
      )
    : artists;

  if (artists.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, marginBottom: 16 }}>
          ディープダイブ
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "2.8rem", fontWeight: 600, color: INK, letterSpacing: "-0.025em", marginBottom: 24 }}>
          Deep Dive
        </h1>
        <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#888", letterSpacing: "0.06em", marginBottom: 32 }}>
          Sync your Discogs collection first to unlock Deep Dive.
        </p>
        <Link
          href="/collection"
          style={{ fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none", borderBottom: `1px solid ${ORANGE}`, paddingBottom: 2 }}
        >
          Go to Collection →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 80px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 10px" }}>
          ディープダイブ
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "3rem", fontWeight: 600, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 12px" }}>
          Deep Dive
        </h1>
        <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.08em", color: "#888888", margin: "0 0 32px" }}>
          Every artist in your collection. AI-powered intelligence on demand.
        </p>
        <div style={{ borderTop: `1px solid ${RULE}` }} />
      </div>

      {/* Search + count */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists..."
          style={{
            fontFamily: MONO,
            fontSize: "0.8rem",
            letterSpacing: "0.06em",
            color: INK,
            background: "#FEFBF8",
            border: `1px solid ${RULE}`,
            borderRadius: 0,
            padding: "10px 14px",
            width: 280,
            outline: "none",
          }}
        />
        <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", color: "#aaaaaa", textTransform: "uppercase" }}>
          {filtered.length} {filtered.length === 1 ? "artist" : "artists"}
        </span>
      </div>

      {/* Artist grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 0,
        border: `1px solid ${RULE}`,
      }}>
        {filtered.map((a, i) => {
          const artistId = encodeURIComponent(a.artist);
          return (
            <Link
              key={a.artist}
              href={`/deep-dive/${artistId}`}
              style={{
                display: "block",
                padding: "20px",
                borderRight: `1px solid ${RULE}`,
                borderBottom: `1px solid ${RULE}`,
                textDecoration: "none",
                background: "#ffffff",
                transition: "background 0.12s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#FDF6F0"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
            >
              <p style={{
                fontFamily: SERIF,
                fontSize: "1rem",
                fontWeight: 500,
                color: INK,
                margin: "0 0 6px",
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
              }}>
                {a.artist}
              </p>
              <p style={{
                fontFamily: MONO,
                fontSize: "0.62rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#aaaaaa",
                margin: 0,
              }}>
                {a.count} {a.count === 1 ? "record" : "records"}
              </p>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && query && (
        <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#aaaaaa", letterSpacing: "0.08em", marginTop: 32 }}>
          No artists match &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}
