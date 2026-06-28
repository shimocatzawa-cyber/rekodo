"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";
const BG      = "#F6F3EB";
const ORANGE  = "#C96A2B";
const INK     = "#1a1a1a";
const MUTED   = "#888888";
const RULE    = "#dddad2";

// Vibrant palette for genre slices
const SLICE_COLORS = [
  "#C96A2B", "#2B5C8A", "#8B2252", "#2B7A4B", "#7B3FA0",
  "#C4A020", "#1F6B7A", "#B03A2E", "#3D6B3A", "#8A5C1A",
  "#2E4A8A", "#A0522D", "#1A6B5C", "#7A2B4A", "#4A6741",
];

interface GenreEntry { genre: string; count: number; pct: number }
interface CardProps {
  username:       string;
  totalRecords:   number;
  genreBreakdown: GenreEntry[];
}
interface Props extends CardProps { onClose: () => void }

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number, innerR: number): string {
  const sweep = Math.min(endDeg - startDeg, 359.999);
  const o  = polarToCartesian(cx, cy, r,      startDeg);
  const i  = polarToCartesian(cx, cy, r,      startDeg + sweep);
  const oi = polarToCartesian(cx, cy, innerR, startDeg);
  const ii = polarToCartesian(cx, cy, innerR, startDeg + sweep);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${o.x} ${o.y}`,
    `A ${r} ${r} 0 ${large} 1 ${i.x} ${i.y}`,
    `L ${ii.x} ${ii.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${oi.x} ${oi.y}`,
    "Z",
  ].join(" ");
}

function GenreMapCard({ username, totalRecords, genreBreakdown, forExport = false }: CardProps & { forExport?: boolean }) {
  const CX = 252, CY = 240, R = 200, INNER = 85;
  const W = 560, H_SVG = 500;

  // Filter out Unknown/empty, take top 7, group rest as "Other"
  const known = genreBreakdown.filter(g => g.genre && g.genre !== "Unknown");
  const top = known.slice(0, 5);
  const otherCount = known.slice(5).reduce((s, x) => s + x.count, 0);
  const total = known.reduce((s, x) => s + x.count, 0) || 1;
  const slices: { label: string; pct: number; color: string }[] = [
    ...top.map((g, i) => ({ label: g.genre, pct: (g.count / total) * 100, color: SLICE_COLORS[i] })),
    ...(otherCount > 0 ? [{ label: "Other", pct: (otherCount / total) * 100, color: SLICE_COLORS[7] }] : []),
  ];

  // Give each slice a minimum visual angle so small genres stay readable
  const MIN_DEG = 28;
  const reserved = slices.length * MIN_DEG;
  const remaining = 360 - reserved;
  const totalPct = slices.reduce((s, x) => s + x.pct, 0) || 1;

  let cursor = 0;
  const arcs = slices.map((s) => {
    const visualDeg = MIN_DEG + (s.pct / totalPct) * remaining;
    const start = cursor;
    const end   = cursor + visualDeg;
    cursor = end;
    return { ...s, start, end };
  });

  return (
    <div style={{ width: W, background: BG, boxSizing: "border-box", minHeight: 660 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 28px 0" }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: INK, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            Collection Genre Map
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: RULE, margin: "16px 28px 0" }} />

      {/* Donut chart */}
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
        <svg viewBox={`0 0 ${W - 56} ${H_SVG}`} width={W - 56} height={H_SVG} style={{ overflow: "visible" }}>
          {arcs.map((a, i) => (
            <path key={i} d={arcPath(CX, CY, R, a.start, a.end, INNER)} fill={a.color} />
          ))}

          {/* Centre label */}
          <text x={CX} y={CY - 2} textAnchor="middle" fontFamily={SERIF} fontSize={38} fontWeight={600} fill={INK}>{totalRecords.toLocaleString()}</text>
          <text x={CX} y={CY + 20} textAnchor="middle" fontFamily={MONO} fontSize={10} letterSpacing="0.1em" fill={MUTED}>ITEMS IN</text>
          <text x={CX} y={CY + 34} textAnchor="middle" fontFamily={MONO} fontSize={10} letterSpacing="0.1em" fill={MUTED}>COLLECTION</text>

          {/* Slice labels — pct + genre name, centred in ring */}
          {arcs.filter(a => a.pct >= 1).map((a, i) => {
            const sweep = a.end - a.start;
            const mid = a.start + sweep / 2;
            const labelR = (INNER + R) / 2;
            const lp = polarToCartesian(CX, CY, labelR, mid);

            const words = a.label.split(" ");
            let line1 = a.label, line2 = "";
            if (words.length > 1) {
              const mid2 = Math.ceil(words.length / 2);
              line1 = words.slice(0, mid2).join(" ");
              line2 = words.slice(mid2).join(" ");
            }
            const hasTwo = line2.length > 0;

            return (
              <g key={i}>
                <text x={lp.x} y={lp.y - (hasTwo ? 14 : 6)} textAnchor="middle" fontFamily={MONO} fontSize={13} fontWeight={600} fill="#fff">
                  {Math.round(a.pct)}%
                </text>
                <text x={lp.x} y={lp.y + (hasTwo ? 3 : 9)} textAnchor="middle" fontFamily={MONO} fontSize={10} letterSpacing="0.05em" fill="rgba(255,255,255,0.85)" style={{ textTransform: "uppercase" }}>
                  {line1}
                </text>
                {hasTwo && (
                  <text x={lp.x} y={lp.y + 16} textAnchor="middle" fontFamily={MONO} fontSize={10} letterSpacing="0.05em" fill="rgba(255,255,255,0.85)" style={{ textTransform: "uppercase" }}>
                    {line2}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer */}
      <div style={{ padding: "4px 28px 24px" }}>
        <div style={{ height: 1, background: RULE, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>What's your Genre Map?</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.08em", color: MUTED }}>@{username} · rekodo.co</div>
        </div>
      </div>
    </div>
  );
}

export default function CollectionGenreMapModal({ onClose, ...cardProps }: Props) {
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const exportRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState<number | null>(null);

  useEffect(() => {
    document.fonts.ready.then(() => {
      if (exportRef.current) setCardH(exportRef.current.offsetHeight);
    });
  }, []);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;
    const PR = 2;
    const dataUrl = await toPng(exportRef.current, { pixelRatio: PR });
    const canvas = document.createElement("canvas");
    canvas.width  = exportRef.current.offsetWidth  * PR;
    canvas.height = exportRef.current.offsetHeight * PR;
    const ctx = canvas.getContext("2d")!;
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0); resolve(); };
      img.onerror = reject;
      img.src = dataUrl;
    });
    return canvas;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const canvas = await buildCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "rekodo-genre-map.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally { setExporting(false); }
  }

  async function handleCopy() {
    setExporting(true);
    try {
      const blobPromise: Promise<Blob> = buildCanvas().then(canvas => {
        if (!canvas) throw new Error("failed");
        return new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), "image/png"));
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      await blobPromise;
      setCopyState("copied");
    } catch { setCopyState("failed"); }
    finally { setExporting(false); setTimeout(() => setCopyState("idle"), 2500); }
  }

  const SCALE = Math.min(1, 508 / 560);
  const PRV_W = Math.round(560 * SCALE);
  const PRV_H = cardH != null ? Math.round(cardH * SCALE) : 460;
  const busy  = exporting || cardH == null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>

      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}><GenreMapCard {...cardProps} forExport /></div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Collection Genre Map</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: 18, color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {cardH == null ? (
            <p style={{ fontFamily: UI_MONO, fontSize: 10, color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                <GenreMapCard {...cardProps} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleDownload} disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: busy ? "wait" : "pointer", padding: "10px 0", opacity: busy ? 0.5 : 1 }}>
              {exporting ? "Exporting…" : busy ? "Loading…" : "Download PNG"}
            </button>
            <button onClick={handleCopy} disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.15)", cursor: busy ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK, opacity: busy ? 0.5 : 1 }}>
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
