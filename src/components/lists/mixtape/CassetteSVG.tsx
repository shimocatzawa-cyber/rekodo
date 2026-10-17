"use client";

import { useRef } from "react";
import { SYMBOL_MAP, Stamp } from "./mixtapeSymbols";

interface Props {
  title: string;
  sideAFill: number;
  sideBFill: number;
  activeSide: "A" | "B";
  stamps: Stamp[];
  onStampsChange: (stamps: Stamp[]) => void;
  width?: number;
}

export default function CassetteSVG({ title, stamps, onStampsChange, width = 520 }: Props) {
  const height       = Math.round(width * (1024 / 1536));
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingId   = useRef<string | null>(null);
  const dragOffset   = useRef({ x: 0, y: 0 });

  const baseSize = width * 0.072;
  const fontSize = title.length > 22 ? baseSize * 0.48
                 : title.length > 16 ? baseSize * 0.58
                 : title.length > 10 ? baseSize * 0.72
                 : baseSize;

  const STAMP_SIZE = Math.round(width * 0.058);

  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const stamp = stamps.find(s => s.id === id);
    if (!stamp || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const stampPx = { x: stamp.x / 100 * width, y: stamp.y / 100 * height };
    const pointerPx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragOffset.current = { x: pointerPx.x - stampPx.x, y: pointerPx.y - stampPx.y };
    draggingId.current = id;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingId.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, (e.clientX - rect.left - dragOffset.current.x) / width * 100));
    const y = Math.max(2, Math.min(98, (e.clientY - rect.top  - dragOffset.current.y) / height * 100));
    onStampsChange(stamps.map(s => s.id === draggingId.current ? { ...s, x, y } : s));
  }

  function onPointerUp() {
    draggingId.current = null;
  }

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
        src="/cassette-tape.png"
        alt="Cassette tape"
        width={width}
        height={height}
        draggable={false}
        style={{ display: "block", width: "100%", height: "100%", userSelect: "none" }}
      />

      {/* Title — centred in the white label area */}
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "72%", textAlign: "center",
        fontFamily: '"Bradley Hand", "Caveat", "Kalam", cursive',
        fontSize: Math.round(fontSize), color: "#0d0d0d",
        lineHeight: 1.1, letterSpacing: "0.01em", pointerEvents: "none",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {title || "My Mixtape"}
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
            <svg
              viewBox="0 0 24 24"
              width={STAMP_SIZE}
              height={STAMP_SIZE}
              fill={sym.filled ? "#0d0d0d" : "none"}
              stroke={sym.filled ? "none" : "#0d0d0d"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={sym.d} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
