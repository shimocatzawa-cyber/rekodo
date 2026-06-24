"use client";

import { FEELINGS } from "@/lib/feelings";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";

export const MOODS = FEELINGS;
export type Mood = typeof MOODS[number];

export type MatchStatus = { total: number; matched: number; pending: number; percentComplete: number };

interface Props {
  mood:            Mood | null;
  setMood:         (m: Mood) => void;
  refinement:      string;
  setRefinement:   (s: string) => void;
  includeOutsideCollection: boolean;
  setIncludeOutsideCollection: (b: boolean) => void;
  trackCount:      number;
  setTrackCount:   (n: number) => void;
  onGenerate:      () => void;
  generating:      boolean;
  matchStatus:     MatchStatus | null;
  spotifyConnected: boolean | null;
}

export default function PlaylistPromptPanel({
  mood, setMood, refinement, setRefinement, includeOutsideCollection, setIncludeOutsideCollection,
  trackCount, setTrackCount, onGenerate, generating, matchStatus, spotifyConnected,
}: Props) {
  const matching = !!matchStatus && matchStatus.pending > 0;
  const noMatches = !!matchStatus && matchStatus.pending === 0 && matchStatus.matched === 0;
  const canGenerate = !!mood && !generating && !matching && !noMatches && spotifyConnected !== false;

  return (
    <div style={{ background: "#ffffff", border: `1px solid ${RULE}`, padding: "28px 28px 24px" }}>
      {spotifyConnected === false && (
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em", color: "#cc3300", marginBottom: "18px" }}>
          Connect Spotify in Settings to build playlists from your collection.
        </p>
      )}

      {spotifyConnected !== false && matching && matchStatus && (
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: MUTED, marginBottom: "6px" }}>
            Matching your collection with Spotify… ({matchStatus.total - matchStatus.pending}/{matchStatus.total})
          </p>
          <div style={{ height: "2px", background: RULE }}>
            <div style={{ height: "100%", width: `${matchStatus.percentComplete}%`, background: ORANGE, transition: "width 0.5s ease" }} />
          </div>
        </div>
      )}

      {spotifyConnected !== false && noMatches && (
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em", color: "#cc3300", marginBottom: "18px" }}>
          No tracks from your collection matched on Spotify yet.
        </p>
      )}

      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: "10px" }}>
        Mood
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${RULE}`, marginBottom: "20px" }}>
        {MOODS.map((m, i) => {
          const selected = mood === m;
          const lastCol  = (i + 1) % 3 === 0;
          const lastRow  = i >= MOODS.length - 3;
          return (
            <button
              key={m}
              onClick={() => setMood(m)}
              style={{
                fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.05em", textTransform: "uppercase",
                color: selected ? "#FDF6F0" : INK,
                background: selected ? ORANGE : "transparent",
                border: "none",
                borderRight: lastCol ? "none" : `1px solid ${RULE}`,
                borderBottom: lastRow ? "none" : `1px solid ${RULE}`,
                padding: "11px 4px", cursor: "pointer", textAlign: "center",
              }}
            >
              {m}
            </button>
          );
        })}
      </div>

      <label style={{ display: "block", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: "8px" }}>
        Refinement (optional)
      </label>
      <textarea
        value={refinement}
        onChange={e => setRefinement(e.target.value)}
        placeholder="e.g. skip anything too upbeat"
        maxLength={300}
        rows={2}
        style={{
          width: "100%", fontFamily: SERIF, fontSize: "13px", color: INK,
          border: `1px solid ${RULE}`, padding: "10px 12px", resize: "vertical",
          marginBottom: "20px", outline: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <button
          onClick={() => setIncludeOutsideCollection(!includeOutsideCollection)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.06em", textTransform: "uppercase",
            color: includeOutsideCollection ? ORANGE : MUTED, background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <span style={{
            width: "28px", height: "16px", borderRadius: "8px", position: "relative",
            background: includeOutsideCollection ? ORANGE : RULE, transition: "background 0.15s",
          }}>
            <span style={{
              position: "absolute", top: "2px", left: includeOutsideCollection ? "14px" : "2px",
              width: "12px", height: "12px", borderRadius: "50%", background: "#fff", transition: "left 0.15s",
            }} />
          </span>
          Include tracks outside my collection
        </button>

        <div className="rk-playlist-stepper" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
            Tracks
          </span>
          <button
            onClick={() => setTrackCount(Math.max(5, trackCount - 1))}
            style={{ width: "20px", height: "20px", border: `1px solid ${RULE}`, background: "none", cursor: "pointer", fontFamily: MONO, fontSize: "12px", color: INK }}
          >
            −
          </button>
          <span style={{ fontFamily: MONO, fontSize: "11px", color: INK, minWidth: "16px", textAlign: "center" }}>{trackCount}</span>
          <button
            onClick={() => setTrackCount(Math.min(15, trackCount + 1))}
            style={{ width: "20px", height: "20px", border: `1px solid ${RULE}`, background: "none", cursor: "pointer", fontFamily: MONO, fontSize: "12px", color: INK }}
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        style={{
          width: "100%", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
          background: canGenerate ? INK : "#cccccc", color: "#ffffff", border: "none",
          cursor: canGenerate ? "pointer" : "default", padding: "13px 0",
        }}
      >
        {generating ? "Generating…" : "Generate"}
      </button>
    </div>
  );
}
