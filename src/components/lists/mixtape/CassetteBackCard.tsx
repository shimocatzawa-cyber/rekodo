"use client";

import { useRef } from "react";
import { SYMBOL_MAP, Stamp } from "./mixtapeSymbols";

interface TrackItem {
  title: string;
  artist: string;
  duration_ms: number;
}

interface Props {
  title: string;
  sideA: TrackItem[];
  sideB: TrackItem[];
  cassetteType: string;
  stamps: Stamp[];
  onStampsChange: (stamps: Stamp[]) => void;
  width?: number;
}

// Usable band inside the cassette-back.png white card area
// White card: left≈14%, right≈95%, top≈10%, bottom≈87%
// "Side A / Side B" headers printed at ~14–20%; tracks start below at 26%
const TRACK_TOP    = 26;
const TRACK_BOTTOM = 85;

const HAND = '"Bradley Hand", "Caveat", "Kalam", cursive';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function TrackColumn({
  tracks, left, right, fs, gap,
}: {
  tracks: TrackItem[];
  left: string; right: string;
  fs: number; gap: number;
}) {
  if (tracks.length === 0) return null;
  const fsArtist = Math.round(fs * 0.85);
  const fsDur    = Math.round(fs * 0.85);

  return (
    <div style={{
      position: "absolute",
      top: `${TRACK_TOP}%`,
      bottom: `${100 - TRACK_BOTTOM}%`,
      left, right,
      display: "flex",
      flexDirection: "column",
      gap,
      overflow: "hidden",
    }}>
      {tracks.map((t, i) => {
        const duration = t.duration_ms > 0 ? fmt(t.duration_ms) : "";
        return (
          <div key={i} style={{ flexShrink: 0 }}>
            {/* Title row with duration right-aligned */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: Math.round(fs * 0.3) }}>
              <span style={{
                fontFamily: HAND, fontSize: fs, color: "#0d0d0d", lineHeight: 1.3,
                flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}>
                {i + 1}. {t.title}
              </span>
              {duration && (
                <span style={{ fontFamily: HAND, fontSize: fsDur, color: "#555", lineHeight: 1.3, flexShrink: 0 }}>
                  {duration}
                </span>
              )}
            </div>
            {/* Artist on second line — never clip */}
            {t.artist && (
              <div style={{
                fontFamily: HAND, fontSize: fsArtist, color: "#444",
                lineHeight: 1.2, paddingLeft: Math.round(fs * 0.6),
              }}>
                {t.artist}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CassetteBackCard({
  sideA, sideB, stamps, onStampsChange, width = 520,
}: Props) {
  const height      = Math.round(width * (1024 / 1536));
  const n           = Math.max(sideA.length, sideB.length, 1);
  const containerH  = height * (TRACK_BOTTOM - TRACK_TOP) / 100;
  // Each track: title line (fs*1.3) + artist line (fs*0.85*1.2) + gap (fs*0.6)
  const fsRaw = containerH / (2.92 * n - 0.6);
  const fs    = Math.max(8, Math.min(Math.round(fsRaw), Math.round(width * 0.020)));
  const gap   = Math.round(fs * 0.7);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingId   = useRef<string | null>(null);
  const dragOffset   = useRef({ x: 0, y: 0 });
  const STAMP_SIZE   = Math.round(width * 0.058);

  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const stamp = stamps.find(s => s.id === id);
    if (!stamp || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left - stamp.x / 100 * width,
      y: e.clientY - rect.top  - stamp.y / 100 * height,
    };
    draggingId.current = id;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingId.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, (e.clientX - rect.left - dragOffset.current.x) / width  * 100));
    const y = Math.max(2, Math.min(98, (e.clientY - rect.top  - dragOffset.current.y) / height * 100));
    onStampsChange(stamps.map(s => s.id === draggingId.current ? { ...s, x, y } : s));
  }

  function onPointerUp() { draggingId.current = null; }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width, height, display: "inline-block", flexShrink: 0 }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cassette-back.png"
        alt="Cassette back"
        width={width}
        height={height}
        draggable={false}
        style={{ display: "block", width: "100%", height: "100%", userSelect: "none" }}
      />

      {/* Track columns — pointer events disabled so stamps can be dragged */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <TrackColumn tracks={sideA} left="13%" right="53%" fs={fs} gap={gap} />
        <TrackColumn tracks={sideB} left="46%" right="5%" fs={fs} gap={gap} />
      </div>

      {/* Draggable stamps */}
      {stamps.map(stamp => {
        const sym = SYMBOL_MAP[stamp.key];
        if (!sym) return null;
        return (
          <div
            key={stamp.id}
            onPointerDown={e => onPointerDown(e, stamp.id)}
            style={{
              position: "absolute",
              left: `${stamp.x}%`,
              top: `${stamp.y}%`,
              transform: "translate(-50%, -50%)",
              width: STAMP_SIZE,
              height: STAMP_SIZE,
              cursor: "grab",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <svg viewBox="0 0 24 24" width={STAMP_SIZE} height={STAMP_SIZE}
              fill={sym.filled ? "#0d0d0d" : "none"}
              stroke={sym.filled ? "none" : "#0d0d0d"}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={sym.d} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
