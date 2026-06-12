"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

type SelectsTab = "artist" | "label";

const TABS: { key: SelectsTab; label: string }[] = [
  { key: "artist", label: "Artist" },
  { key: "label",  label: "Label"  },
];

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

const SPOTLIGHT: Record<SelectsTab, SpotlightData> = {
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

function SpotlightCard({ data, tab }: { data: SpotlightData; tab: SelectsTab }) {
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
  const [activeTab, setActiveTab] = useState<SelectsTab>("artist");

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <style>{`
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

      {/* ── Content ── */}
      <main style={{ padding: "36px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>
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
      </main>
    </div>
  );
}
