"use client";

import { useState } from "react";
import Link from "next/link";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const WARM   = "#FDF6F0";

export type ArtistRecord = {
  id: string;
  album: string;
  year: number | null;
  format: string | null;
};

type Section = "rankings" | "podcasts" | "books" | "interviews";

const TABS: { id: Section; label: string }[] = [
  { id: "rankings",   label: "Rankings" },
  { id: "podcasts",   label: "Podcasts" },
  { id: "books",      label: "Books & Audiobooks" },
  { id: "interviews", label: "Interviews" },
];

// ── Skeleton shimmer ───────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, style }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(90deg, ${WARM} 25%, #f5ece4 50%, ${WARM} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

function SkeletonBlock() {
  return (
    <div style={{ padding: "24px 0", borderBottom: `1px solid ${RULE}` }}>
      <Skeleton width="40%" height={14} style={{ marginBottom: 12 }} />
      <Skeleton width="65%" height={20} style={{ marginBottom: 10 }} />
      <Skeleton width="90%" height={12} style={{ marginBottom: 6 }} />
      <Skeleton width="80%" height={12} />
    </div>
  );
}

// ── Pill badge ─────────────────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: MONO,
      fontSize: "0.58rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: ORANGE,
      background: WARM,
      padding: "2px 7px",
      display: "inline-block",
    }}>
      {label}
    </span>
  );
}

// ── Generate button ────────────────────────────────────────────────────────────

function GenerateButton({ artist, section, onLoad }: { artist: string; section: Section; onLoad: () => void }) {
  return (
    <div style={{ padding: "48px 0", textAlign: "center" }}>
      <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.1em", color: "#aaaaaa", marginBottom: 20, textTransform: "uppercase" }}>
        Ready to analyse
      </p>
      <button
        onClick={onLoad}
        style={{
          fontFamily: MONO,
          fontSize: "0.72rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: ORANGE,
          background: "none",
          border: `1px solid ${ORANGE}`,
          borderRadius: 0,
          padding: "10px 24px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = ORANGE;
          (e.currentTarget as HTMLElement).style.color = "#ffffff";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "none";
          (e.currentTarget as HTMLElement).style.color = ORANGE;
        }}
      >
        Analyse {artist}
      </button>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────────

function ErrorState({ section, onRetry }: { section: Section; onRetry: () => void }) {
  const labels: Record<Section, string> = {
    rankings: "Rankings",
    podcasts: "Podcasts",
    books: "Books & Audiobooks",
    interviews: "Interviews",
  };
  return (
    <div style={{ padding: "48px 0" }}>
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.08em", color: "#aaaaaa", marginBottom: 16 }}>
        Unable to load {labels[section]} right now.
      </p>
      <button
        onClick={onRetry}
        style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, borderRadius: 0, padding: "8px 18px", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}

// ── Rankings ───────────────────────────────────────────────────────────────────

type Album = { rank: number; title: string; year: number; review: string; collectorNote: string };

function Rankings({ data }: { data: { albums?: Album[] } }) {
  const albums = data.albums ?? [];
  if (albums.length === 0) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.08em", color: "#aaaaaa", padding: "32px 0" }}>
        rekōdo couldn&apos;t find discography data for this artist. Try a more widely documented artist.
      </p>
    );
  }
  return (
    <div>
      {albums.map((a) => (
        <div key={a.rank} style={{ padding: "24px 0", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <span style={{ fontFamily: MONO, fontSize: "1.5rem", fontWeight: 400, color: ORANGE, lineHeight: 1, minWidth: 36, flexShrink: 0 }}>
              {String(a.rank).padStart(2, "0")}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 500, color: INK, letterSpacing: "-0.01em" }}>
                  {a.title}
                </span>
                <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", color: "#aaaaaa" }}>
                  {a.year}
                </span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, lineHeight: 1.6, margin: "0 0 12px" }}>
                {a.review}
              </p>
              <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: "#777777", fontStyle: "italic", lineHeight: 1.5, margin: 0 }}>
                  {a.collectorNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Podcasts ───────────────────────────────────────────────────────────────────

type Episode = { show: string; episode: string; year: number; type: string; note: string };

function Podcasts({ data, artist }: { data: { episodes?: Episode[] }; artist: string }) {
  const eps = data.episodes ?? [];
  return (
    <div>
      {eps.map((ep, i) => (
        <div key={i} style={{ padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 500, color: INK }}>{ep.show}</span>
            <span style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.08em", color: "#aaaaaa" }}>{ep.year}</span>
            <Badge label={ep.type} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 6px" }}>{ep.episode}</p>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: "#777777", margin: 0, lineHeight: 1.5 }}>{ep.note}</p>
        </div>
      ))}
      {eps.length < 3 && (
        <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: "#aaaaaa", marginTop: 20, lineHeight: 1.6 }}>
          Podcast coverage of this artist may be limited. Try searching {artist} on Spotify Podcasts or Apple Podcasts.
        </p>
      )}
    </div>
  );
}

// ── Books ──────────────────────────────────────────────────────────────────────

type BookItem = { title: string; author: string; year: number; type: string; format: string; note: string };

function Books({ data }: { data: { items?: BookItem[] } }) {
  const items = data.items ?? [];
  return (
    <div>
      {items.map((b, i) => (
        <div key={i} style={{ padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 500, color: INK }}>{b.title}</span>
            <span style={{ fontFamily: MONO, fontSize: "0.62rem", color: "#aaaaaa", letterSpacing: "0.08em" }}>{b.year}</span>
            <Badge label={b.type} />
            <Badge label={b.format} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: "#888888", margin: "0 0 6px" }}>
            {b.author}
          </p>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: "#777777", margin: "0 0 8px", lineHeight: 1.5 }}>{b.note}</p>
          {b.format.toLowerCase().includes("audiobook") && (
            <a
              href={`https://www.audible.com/search?keywords=${encodeURIComponent(b.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", color: ORANGE, textDecoration: "none" }}
            >
              Find on Audible →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Interviews ─────────────────────────────────────────────────────────────────

type Interview = { publication: string; title: string; year: number; format: string; note: string };

function Interviews({ data }: { data: { interviews?: Interview[] } }) {
  const items = data.interviews ?? [];
  return (
    <div>
      {items.map((iv, i) => (
        <div key={i} style={{ padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 500, color: INK }}>{iv.publication}</span>
            <span style={{ fontFamily: MONO, fontSize: "0.62rem", color: "#aaaaaa", letterSpacing: "0.08em" }}>{iv.year}</span>
            <Badge label={iv.format} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 6px" }}>{iv.title}</p>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: "#777777", margin: 0, lineHeight: 1.5 }}>{iv.note}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ArtistDeepDive({
  artist,
  records,
}: {
  artist: string;
  records: ArtistRecord[];
}) {
  const [activeTab, setActiveTab] = useState<Section>("rankings");
  const [loadingTab, setLoadingTab] = useState<Section | null>(null);
  const [errorTab, setErrorTab] = useState<Section | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cache, setCache] = useState<Partial<Record<Section, any>>>({});

  async function fetchSection(section: Section) {
    setLoadingTab(section);
    setErrorTab(null);
    try {
      const res = await fetch("/api/deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist, section }),
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json() as { data: unknown };
      setCache((prev) => ({ ...prev, [section]: json.data }));
    } catch {
      setErrorTab(section);
    } finally {
      setLoadingTab(null);
    }
  }

  function renderContent(section: Section) {
    if (loadingTab === section) {
      return (
        <div>
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      );
    }
    if (errorTab === section) {
      return <ErrorState section={section} onRetry={() => fetchSection(section)} />;
    }
    if (!cache[section]) {
      return <GenerateButton artist={artist} section={section} onLoad={() => fetchSection(section)} />;
    }

    if (section === "rankings")   return <Rankings data={cache[section]} />;
    if (section === "podcasts")   return <Podcasts data={cache[section]} artist={artist} />;
    if (section === "books")      return <Books data={cache[section]} />;
    if (section === "interviews") return <Interviews data={cache[section]} />;
    return null;
  }

  return (
    <>
      {/* Shimmer keyframes */}
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Back link */}
        <Link
          href="/deep-dive"
          style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", textDecoration: "none", display: "inline-block", marginBottom: 32 }}
        >
          ← All Artists
        </Link>

        {/* Two-column layout on desktop */}
        <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>

          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <div
            className="hidden md:block"
            style={{ width: 260, flexShrink: 0, position: "sticky", top: 32 }}
          >
            <p style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 10px" }}>
              ディープダイブ
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: "2.2rem", fontWeight: 700, color: INK, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 8px" }}>
              {artist}
            </h1>
            <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", color: "#aaaaaa", textTransform: "uppercase", margin: "0 0 24px" }}>
              {records.length} {records.length === 1 ? "record" : "records"} in your collection
            </p>

            <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: 16 }} />

            {records.map((r) => (
              <div key={r.id} style={{ padding: "10px 0", borderBottom: `1px solid ${RULE}` }}>
                <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 400, color: INK, margin: "0 0 3px", letterSpacing: "-0.01em" }}>
                  {r.album}
                </p>
                <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.08em", color: "#aaaaaa", margin: 0, textTransform: "uppercase" }}>
                  {[r.year, r.format].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 24, paddingTop: 12 }}>
              <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.1em", color: ORANGE, textTransform: "uppercase", margin: 0 }}>
                Powered by Claude
              </p>
            </div>
          </div>

          {/* ── Main content ─────────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mobile: artist name inline */}
            <div className="md:hidden" style={{ marginBottom: 32 }}>
              <p style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 8px" }}>
                ディープダイブ
              </p>
              <h1 style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 700, color: INK, letterSpacing: "-0.025em", margin: "0 0 6px" }}>
                {artist}
              </h1>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", color: "#aaaaaa", textTransform: "uppercase", margin: 0 }}>
                {records.length} {records.length === 1 ? "record" : "records"} in your collection
              </p>
            </div>

            {/* Tabs */}
            <div style={{
              display: "flex",
              gap: 0,
              borderBottom: `1px solid ${RULE}`,
              marginBottom: 32,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.68rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: activeTab === tab.id ? INK : "#aaaaaa",
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === tab.id ? `2px solid ${ORANGE}` : "2px solid transparent",
                    padding: "10px 16px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    marginBottom: -1,
                    transition: "color 0.12s, border-color 0.12s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {renderContent(activeTab)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
