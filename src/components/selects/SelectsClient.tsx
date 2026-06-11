"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const BG     = "#FDF6F0";

type SelectsTab = "artist" | "label";

const TABS: { key: SelectsTab; label: string }[] = [
  { key: "artist", label: "Artist" },
  { key: "label",  label: "Label"  },
];

const TAB_CONTENT: Record<SelectsTab, {
  eyebrow: string;
  heading: string;
  body:    string;
}> = {
  artist: {
    eyebrow: "ARTIST · アーティスト",
    heading: "Artist Spotlights",
    body:    "Deep dives into the artists that define your collection — their catalogue, their pressings, their place in the canon.",
  },
  label: {
    eyebrow: "LABEL · レーベル",
    heading: "Label Spotlights",
    body:    "The labels that shaped how music was made and heard. Blue Note, ECM, Soul Jazz, and beyond.",
  },
};

interface Props {
  username:     string;
  displayLabel: string;
  avatarUrl:    string | null;
}

export default function SelectsClient({ username, displayLabel, avatarUrl }: Props) {
  const [activeTab, setActiveTab] = useState<SelectsTab>("artist");

  const content = TAB_CONTENT[activeTab];

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
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
              cursor: "pointer", display: "inline-block",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <main style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>
        <div style={{
          background: BG,
          border: `1px solid ${RULE}`,
          padding: "40px 40px 36px",
        }}>
          {/* Eyebrow */}
          <p style={{
            fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: ORANGE, margin: "0 0 16px",
          }}>
            {content.eyebrow}
          </p>

          {/* Heading */}
          <h2 style={{
            fontFamily: SERIF, fontSize: "2rem", fontWeight: 400,
            color: INK, letterSpacing: "-0.025em", lineHeight: 1.15,
            margin: "0 0 20px",
          }}>
            {content.heading}
          </h2>

          {/* Body */}
          <p style={{
            fontFamily: MONO, fontSize: "0.75rem", color: INK,
            maxWidth: "480px", lineHeight: 1.75, margin: "0 0 28px",
            fontWeight: 400,
          }}>
            {content.body}
          </p>

          {/* Rule */}
          <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "24px" }} />

          {/* Status pill */}
          <span style={{
            fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em",
            textTransform: "uppercase", color: INK,
            border: `1px solid ${RULE}`,
            padding: "0.2rem 0.6rem",
            display: "inline-block",
          }}>
            Coming Soon
          </span>
        </div>
      </main>
    </div>
  );
}
