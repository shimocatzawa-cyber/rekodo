"use client";

import { useState } from "react";
import type { GeneratedTrack } from "@/components/lists/PlaylistTab";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtTotal(ms: number) {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function openInSpotifyUrl(uri: string): string {
  const id = uri.split(":").pop() ?? "";
  return `https://open.spotify.com/track/${id}`;
}

interface Props {
  tracks:       GeneratedTrack[];
  onReorder:    (newTracks: GeneratedTrack[]) => void;
  resequencing: boolean;
}

export default function PlaylistTrackList({ tracks, onReorder, resequencing }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); setOverIndex(null); return; }
    const next = [...tracks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  const fromCollection = tracks.filter(t => t.source === "collection").length;
  const fromWantlist   = tracks.filter(t => t.source === "wantlist").length;
  const fromDiscover   = tracks.filter(t => t.source === "discover").length;
  const totalDurationMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

  return (
    <div style={{ background: "#ffffff", border: `1px solid ${RULE}` }}>
      {tracks.map((t, i) => {
        const dragging = dragIndex === i;
        const dragOver = overIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <div
            key={`${t.spotify_uri}-${i}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => { e.preventDefault(); setOverIndex(i); }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            onDrop={() => handleDrop(i)}
            className="rk-playlist-track-row"
            style={{
              display: "flex", alignItems: "flex-start", gap: "12px",
              padding: "12px 16px",
              borderBottom: i < tracks.length - 1 ? `1px solid ${RULE}` : "none",
              opacity: dragging ? 0.4 : 1,
              background: dragOver ? "#fdf6f0" : "transparent",
              cursor: "grab",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: "11px", color: "#cccccc", lineHeight: "20px", userSelect: "none" }} title="Drag to reorder">
              ⠿
            </span>
            <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, lineHeight: "20px", width: "16px", flexShrink: 0 }}>
              {i + 1}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                <p style={{ fontFamily: SERIF, fontSize: "14px", color: INK, margin: 0 }}>{t.title}</p>
                {t.source === "wantlist" && (
                  <span style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: "2px", padding: "1px 5px" }}>
                    wantlist
                  </span>
                )}
                {t.source === "discover" && (
                  <span style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: "2px", padding: "1px 5px" }}>
                    discovered
                  </span>
                )}
              </div>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", color: MUTED, margin: "3px 0 0" }}>
                {t.artist} — {t.album}{t.year ? ` — ${t.year}` : ""}
              </p>
              {t.rationale && (
                <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "12px", color: ORANGE, margin: "6px 0 0", opacity: resequencing ? 0.4 : 1 }}>
                  {resequencing ? "updating sequencing notes…" : t.rationale}
                </p>
              )}
            </div>

            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              <span style={{ fontFamily: MONO, fontSize: "9px", color: MUTED }}>
                {t.duration_ms ? fmt(t.duration_ms) : ""}
              </span>
              <a
                href={openInSpotifyUrl(t.spotify_uri)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.04em", color: "#bbbbbb", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                Spotify ↗
              </a>
            </div>
          </div>
        );
      })}

      <div className="rk-playlist-track-footer" style={{ padding: "10px 16px", background: "#fafafa", display: "flex", justifyContent: "space-between", gap: "12px" }}>
        <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: MUTED }}>
          {fromCollection} from your collection{fromWantlist > 0 ? ` · ${fromWantlist} from your wantlist` : ""}{fromDiscover > 0 ? ` · ${fromDiscover} discovered for you` : ""}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: MUTED, flexShrink: 0 }}>
          {tracks.length} track{tracks.length === 1 ? "" : "s"} · {fmtTotal(totalDurationMs)}
        </span>
      </div>
    </div>
  );
}
