"use client";

import { useState, useEffect } from "react";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

// ─── Label feed types ─────────────────────────────────────────────────────────

type LabelFeedItem = {
  id: string;
  gmail_message_id: string | null;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  artist: string | null;
  album: string | null;
  release_type: "new_release" | "repress" | "preorder" | "announcement" | "unknown" | null;
  format: string | null;
  label: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string | null;
};

// ─── Selects tabs ─────────────────────────────────────────────────────────────

type SelectsTab = "new_releases" | "artist" | "label";

const TABS: { key: SelectsTab; label: string }[] = [
  { key: "new_releases", label: "New Releases" },
  { key: "artist",       label: "Artist"       },
  { key: "label",        label: "Label"        },
];

// ─── Buy link helper ──────────────────────────────────────────────────────────

function getBuyLink(label: string | null, artist: string | null): string {
  const lbl = (label ?? "").toUpperCase();
  const q = encodeURIComponent(artist ?? "");
  if (lbl.includes("BOOMKAT"))     return `https://boomkat.com/products/search?q=${q}`;
  if (lbl.includes("ROUGH TRADE")) return `https://roughtrade.com/search?q=${q}`;
  if (lbl.includes("JUNO"))        return `https://www.juno.co.uk/search/?q=${q}`;
  if (lbl.includes("SACRED BONES")) return "https://sacredbonesrecords.com";
  if (lbl.includes("FUZZ CLUB"))   return "https://fuzzclub.com";
  return `https://www.discogs.com/search/?q=${q}&type=release`;
}

// ─── Badge config ─────────────────────────────────────────────────────────────

function getBadge(type: LabelFeedItem["release_type"]): { text: string; bg: string; color: string } {
  switch (type) {
    case "new_release": return { text: "OUT NOW",   bg: "#fde8d8", color: "#CC5500" };
    case "preorder":    return { text: "PRE-ORDER", bg: "#e8f5eb", color: "#2d7a3a" };
    case "repress":     return { text: "REPRESS",   bg: "#e8f0fd", color: "#2d4a9a" };
    default:            return { text: "RELEASE",   bg: "#f0f0f0", color: "#666666" };
  }
}

function getCardBorder(type: LabelFeedItem["release_type"]): string {
  switch (type) {
    case "new_release": return "#CC5500";
    case "preorder":    return "#2d7a3a";
    case "repress":     return "#2d4a9a";
    default:            return "#e0e0da";
  }
}

// ─── Static filter labels ─────────────────────────────────────────────────────

const STATIC_FILTERS = [
  { key: "ALL",       label: "ALL" },
  { key: "OUT NOW",   label: "OUT NOW" },
  { key: "PRE-ORDER", label: "PRE-ORDER" },
  { key: "REPRESS",   label: "REPRESS" },
];

const TYPE_FILTER_MAP: Record<string, LabelFeedItem["release_type"]> = {
  "OUT NOW":   "new_release",
  "PRE-ORDER": "preorder",
  "REPRESS":   "repress",
};

// ─── Release card ─────────────────────────────────────────────────────────────

function ReleaseCard({ item }: { item: LabelFeedItem }) {
  const [hovered, setHovered] = useState(false);
  const badge = getBadge(item.release_type);
  const borderColor = getCardBorder(item.release_type);
  const buyHref = getBuyLink(item.label, item.artist);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#f0ebe4" : "#FDF6F0",
        padding: "1rem",
        borderLeft: `3px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
        transition: "background 0.15s",
      }}
    >
      {/* Top row: badge + source */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <span style={{
          fontFamily: MONO, fontSize: "0.44rem", letterSpacing: "0.1em",
          textTransform: "uppercase", background: badge.bg, color: badge.color,
          padding: "0.1rem 0.35rem",
        }}>
          {badge.text}
        </span>
        {item.label && (
          <span style={{
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em",
            textTransform: "uppercase", color: ORANGE,
          }}>
            {item.label.toUpperCase()}
          </span>
        )}
      </div>

      {/* Artist */}
      {item.artist && (
        <p style={{
          fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600,
          color: INK, margin: 0, lineHeight: 1.2,
        }}>
          {item.artist}
        </p>
      )}

      {/* Album */}
      {item.album && (
        <p style={{
          fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: 0,
        }}>
          {item.album}
        </p>
      )}

      {/* Format */}
      {item.format && (
        <p style={{
          fontFamily: MONO, fontSize: "0.6rem", color: INK,
          opacity: 0.55, margin: 0,
        }}>
          {item.format}
        </p>
      )}

      {/* Description */}
      {item.description && (
        <p style={{
          fontFamily: MONO, fontSize: "0.58rem", color: INK,
          opacity: 0.7, margin: 0, lineHeight: 1.55,
        }}>
          {item.description}
        </p>
      )}

      {/* Buy link */}
      <a
        href={buyHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: MONO, fontSize: "0.55rem", color: ORANGE,
          textDecoration: "none", marginTop: "auto",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
      >
        BUY →
      </a>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: "#FDF6F0", padding: "1rem",
      borderLeft: `3px solid ${RULE}`,
      display: "flex", flexDirection: "column", gap: "0.5rem",
    }}>
      <div className="nr-shimmer" style={{ height: "0.75rem", width: "40%", background: "#e8e3dc" }} />
      <div className="nr-shimmer" style={{ height: "1rem",   width: "70%", background: "#e8e3dc" }} />
      <div className="nr-shimmer" style={{ height: "0.7rem", width: "55%", background: "#e8e3dc" }} />
      <div className="nr-shimmer" style={{ height: "0.6rem", width: "90%", background: "#e8e3dc" }} />
      <div className="nr-shimmer" style={{ height: "0.6rem", width: "80%", background: "#e8e3dc" }} />
    </div>
  );
}

// ─── New Releases section ─────────────────────────────────────────────────────

function NewReleasesSection() {
  const [items, setItems]       = useState<LabelFeedItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("label_feed")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(48)
      .then(({ data }) => {
        setItems((data as unknown as LabelFeedItem[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Dynamic source filters from unique label values
  const sourceFilters: string[] = Array.from(
    new Set(items.map(i => (i.label ?? "").toUpperCase()).filter(Boolean))
  ).sort();

  const allFilters = [
    ...STATIC_FILTERS,
    ...sourceFilters.map(s => ({ key: s, label: s })),
  ];

  // Apply filter
  const filtered = activeFilter === "ALL"
    ? items
    : TYPE_FILTER_MAP[activeFilter]
      ? items.filter(i => i.release_type === TYPE_FILTER_MAP[activeFilter])
      : items.filter(i => (i.label ?? "").toUpperCase() === activeFilter);

  return (
    <section style={{ marginBottom: "0" }}>
      {/* Filter strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {allFilters.map(({ key, label }) => {
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              style={{
                fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: isActive ? INK : "transparent",
                color: isActive ? "#ffffff" : INK,
                border: `1px solid ${isActive ? INK : RULE}`,
                borderRadius: 0,
                padding: "0.3rem 0.75rem",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="nr-grid">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <p style={{
          fontFamily: MONO, fontSize: "0.65rem", color: INK,
          opacity: 0.5, margin: 0,
        }}>
          No releases yet. The feed updates daily once labels@rekodo.co is subscribed to label newsletters.
        </p>
      ) : filtered.length === 0 ? (
        <p style={{
          fontFamily: MONO, fontSize: "0.65rem", color: INK,
          opacity: 0.5, margin: 0,
        }}>
          No releases match this filter.
        </p>
      ) : (
        <div className="nr-grid">
          {filtered.map(item => <ReleaseCard key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}

// ─── Placeholder image ────────────────────────────────────────────────────────

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", minHeight: "inherit",
      background: "#0e0e0e",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg viewBox="0 0 400 400" width="100%" height="100%"
        preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: "block" }}>
        <rect width="400" height="400" fill="#0e0e0e" />
        {Array.from({ length: 32 }, (_, i) => (
          <line key={i} x1="0" y1={i * 13} x2="400" y2={i * 13}
            stroke="#161616" strokeWidth="0.6" />
        ))}
        <text x="200" y="218" textAnchor="middle"
          fontFamily="var(--font-editorial)" fontSize="64"
          fill="#1e1e1e" letterSpacing="-2">
          {label.slice(0, 2).toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

// ─── Content data ─────────────────────────────────────────────────────────────

type SpotlightData = {
  eyebrow:  string;
  name:     string;
  meta:     string[];
  body:     string[];
  links:    { label: string; href: string }[];
  imageUrl: string | null;
};

const SPOTLIGHT: Record<"artist" | "label", SpotlightData> = {
  artist: {
    eyebrow:  "ARTIST SELECT - JUNE",
    name:     "Alice Coltrane",
    meta:     ["Jazz · Spiritual · Avant-Garde", "1937 – 2007 · Detroit"],
    body: [
      "Few artists reshaped the grammar of the instrument as radically as Alice Coltrane. Moving from hard bop to free jazz to a transcendent spiritual music all her own, her recordings for Impulse! in the early 1970s — Ptah, the El Daoud; Journey in Satchidananda; A Monastic Trio — remain among the most singular documents in the American catalogue.",
      "Her later work, produced privately for her Sai Anantam Ashram in California and distributed almost by hand, has become one of the great rediscoveries of recent years. The archival compilations Astral Meditations and World Spirituality Classics 1: The Ecstatic Music of Alice Coltrane Turiyasangitananda introduced these recordings to a new generation.",
    ],
    links: [
      { label: "Discogs ↗",    href: "https://www.discogs.com/artist/266049-Alice-Coltrane" },
      { label: "Wikipedia ↗",  href: "https://en.wikipedia.org/wiki/Alice_Coltrane" },
    ],
    imageUrl: null,
  },
  label: {
    eyebrow:  "LABEL SELECT - JUNE",
    name:     "Blue Note Records",
    meta:     ["Jazz · Soul · Funk · Avant-Garde", "Founded 1939 · New York"],
    body: [
      "Blue Note was not merely a record label — it was a commitment to a particular idea about what jazz could be. Founded by Alfred Lion and Francis Wolff in 1939, it became the home of hard bop, post-bop, and some of the most celebrated album artwork in recorded music history, under the eye of designer Reid Miles.",
      "Sonny Rollins, Thelonious Monk, Miles Davis, Lee Morgan, Herbie Hancock, Wayne Shorter — the Blue Note catalogue reads like a map of an entire era. Its pressings, particularly the original New York issues with Van Gelder's lacquer etchings, remain among the most sought-after in any crate.",
    ],
    links: [
      { label: "Discogs ↗",       href: "https://www.discogs.com/label/39-Blue-Note-Records" },
      { label: "Official site ↗", href: "https://www.bluenote.com" },
    ],
    imageUrl: null,
  },
};

// ─── Main spotlight card ──────────────────────────────────────────────────────

function SpotlightCard({ data, tab }: { data: SpotlightData; tab: "artist" | "label" }) {
  return (
    <div
      className="selects-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
        minHeight: 460,
      }}
    >
      {/* ── Left: photo ── */}
      <div className="selects-img" style={{ background: "#0e0e0e", overflow: "hidden", minHeight: 460 }}>
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.imageUrl}
            alt={data.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <PlaceholderPanel label={data.name} />
        )}
      </div>

      {/* ── Right: editorial ── */}
      <div
        className="selects-text"
        style={{ padding: "28px 32px", display: "flex", flexDirection: "column", background: "#ffffff" }}
      >
        {/* Eyebrow */}
        <p style={{
          fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.16em",
          textTransform: "uppercase", color: ORANGE, margin: "0 0 20px",
        }}>
          {data.eyebrow}
        </p>

        {/* Name */}
        <h2 style={{
          fontFamily: SERIF, fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)", fontWeight: 400,
          color: INK, lineHeight: 1.1, letterSpacing: "-0.02em",
          margin: "0 0 14px",
        }}>
          {data.name}
        </h2>

        {/* Meta tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
          {data.meta.map((m, i) => (
            <p key={i} style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em",
              color: "#888888", margin: 0,
            }}>
              {m}
            </p>
          ))}
        </div>

        {/* Rule */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", marginBottom: "20px" }} />

        {/* Body */}
        <div style={{ flex: 1 }}>
          {data.body.map((para, i) => (
            <p key={i} style={{
              fontFamily: SERIF, fontSize: "0.85rem", fontStyle: "italic",
              color: "#505050", lineHeight: 1.75,
              margin: i < data.body.length - 1 ? "0 0 14px" : 0,
            }}>
              {para}
            </p>
          ))}
        </div>

        {/* Links — pinned to bottom */}
        <div style={{
          marginTop: "24px", paddingTop: "16px",
          borderTop: `1px solid ${RULE}`,
          display: "flex", gap: "20px", flexWrap: "wrap",
        }}>
          {data.links.map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em",
                color: ORANGE, textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  username:     string;
  displayLabel: string;
  avatarUrl:    string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SelectsClient({ username, displayLabel, avatarUrl }: Props) {
  const [activeTab, setActiveTab] = useState<SelectsTab>("new_releases");

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <style>{`
        @keyframes nr-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .nr-shimmer { animation: nr-pulse 1.4s ease-in-out infinite; }

        .nr-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: ${RULE};
        }
        @media (max-width: 1023px) {
          .nr-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 639px) {
          .nr-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 767px) {
          .selects-card {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }
          .selects-img {
            min-height: 0 !important;
            aspect-ratio: 1 / 1;
            max-height: 360px;
          }
          .selects-text {
            padding: 24px 20px !important;
          }
        }
      `}</style>

      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Sub-navigation ── */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "24px",
        paddingTop: "14px", paddingBottom: "2px",
        background: "#ffffff",
      }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", background: "none", border: "none",
              borderBottom: `1.5px solid ${activeTab === key ? ORANGE : "transparent"}`,
              padding: "6px 0",
              color: activeTab === key ? INK : "#bbbbbb",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <main style={{ padding: "36px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "new_releases" ? (
          <NewReleasesSection />
        ) : (
          <>
            <SpotlightCard data={SPOTLIGHT[activeTab]} tab={activeTab} />

            {/* Coming next */}
            <div style={{
              marginTop: "48px",
              paddingTop: "24px",
              borderTop: `1px solid ${RULE}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <p style={{
                fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.12em",
                textTransform: "uppercase", color: "#bbbbbb", margin: 0,
              }}>
                More {activeTab === "artist" ? "artist" : "label"} spotlights coming soon
              </p>
              <span style={{
                fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em",
                textTransform: "uppercase", color: INK,
                border: `1px solid ${RULE}`,
                padding: "0.2rem 0.6rem",
              }}>
                01 / —
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
