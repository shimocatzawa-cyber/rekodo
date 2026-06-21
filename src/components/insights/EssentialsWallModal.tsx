"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";

// Inline font strings — NOT CSS variables — so html-to-image embeds them
const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG     = "#ffffff";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const MUTED  = "#888888";
const RULE   = "#e0e0da";
const ART_BG = "#e5e2dc";

const MAX_COVERS = 36;
const COLS       = 6;
const CARD_W     = 560;
const GRID_PAD   = 28;
const GAP        = 4;
const CELL       = Math.floor((CARD_W - GRID_PAD * 2 - GAP * (COLS - 1)) / COLS);

interface Cover { artist: string; album: string; coverUrl: string | null }
type CoverSrcs = Record<number, string | null>;

interface CardProps {
  username:        string;
  total:           number;
  primaryGenre:    string | null;
  primaryGenrePct: number;
  covers:          Cover[];
  coverSrcs:       CoverSrcs;
  forExport?:      boolean;
}
interface Props {
  onClose:         () => void;
  username:        string;
  covers:          Cover[];
  total:           number;
  primaryGenre:    string | null;
  primaryGenrePct: number;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loadCovers(covers: Cover[]): Promise<CoverSrcs> {
  const entries = await Promise.all(
    covers.map(async (c, i): Promise<[number, string | null]> => {
      if (!c.coverUrl) return [i, null];
      try {
        const r = await fetch(`/api/image-proxy?url=${encodeURIComponent(c.coverUrl)}`);
        if (!r.ok) return [i, null];
        const dataUrl = await blobToDataUrl(await r.blob());
        return [i, dataUrl];
      } catch {
        return [i, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

// ── Card ─────────────────────────────────────────────────────────────────
// White-framed "wall" of essential covers, with a museum-plaque footer.

function WallCard({ username, total, primaryGenre, primaryGenrePct, covers, coverSrcs, forExport = false }: CardProps) {
  const rows  = Math.max(1, Math.ceil(covers.length / COLS));
  const gridH = rows * CELL + (rows - 1) * GAP;

  const footerStats = [
    { label: "Records",       value: total > 0 ? total.toLocaleString() : "—" },
    { label: "Primary Genre", value: primaryGenre ? `${primaryGenrePct}% ${primaryGenre}` : "—" },
  ];

  return (
    <div style={{ width: CARD_W, background: BG, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 28px 18px", boxSizing: "border-box" }}>
        <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE }}>
          Essentials Wall
        </div>
        <div style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 600, color: INK, lineHeight: 1, flexShrink: 0, marginLeft: 16 }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: `0 ${GRID_PAD}px`, boxSizing: "border-box" }}>
        {covers.length === 0 ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: ART_BG }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>No essentials tagged yet</span>
          </div>
        ) : (
          <div style={{ position: "relative", width: CARD_W - GRID_PAD * 2, height: gridH }}>
            {covers.map((c, i) => {
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              const x   = col * (CELL + GAP);
              const y   = row * (CELL + GAP);
              const src = coverSrcs[i] ?? null;
              return forExport ? (
                <div
                  key={i}
                  data-cover-slot={i}
                  style={{ position: "absolute", left: x, top: y, width: CELL, height: CELL, background: ART_BG }}
                />
              ) : (
                <div
                  key={i}
                  style={{
                    position: "absolute", left: x, top: y, width: CELL, height: CELL,
                    backgroundImage: src ? `url(${src})` : "none",
                    backgroundSize: "cover", backgroundPosition: "center",
                    backgroundColor: ART_BG,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — two-column stat strip, then collector credit below */}
      <div style={{ display: "flex", marginTop: 24, borderTop: `1px solid ${RULE}` }}>
        {footerStats.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1, padding: "14px 6px", textAlign: "center", minWidth: 0,
              borderRight: i < footerStats.length - 1 ? `1px solid ${RULE}` : "none",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: SERIF, fontWeight: 600,
              fontSize: "0.95rem", color: INK,
              lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 6px", textAlign: "center", borderTop: `1px solid ${RULE}` }}>
        <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>
          @{username} - rekodo.co
        </span>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function EssentialsWallModal({ onClose, username, covers, total, primaryGenre, primaryGenrePct }: Props) {
  const shownCovers = covers.slice(0, MAX_COVERS);

  const [coverSrcs,    setCoverSrcs]    = useState<CoverSrcs>({});
  const [coversLoaded, setCoversLoaded] = useState(shownCovers.length === 0);
  const [exporting,    setExporting]    = useState(false);
  const [copyState,    setCopyState]    = useState<"idle" | "copied" | "failed">("idle");
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shownCovers.length === 0) return;
    loadCovers(shownCovers).then((c) => { setCoverSrcs(c); setCoversLoaded(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;

    const PR       = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });

    const cardBCR = exportRef.current.getBoundingClientRect();
    const slotRects: { idx: number; x: number; y: number; w: number; h: number }[] = [];
    exportRef.current.querySelectorAll<HTMLElement>("[data-cover-slot]").forEach((el) => {
      const idx = parseInt(el.dataset.coverSlot!);
      const r = el.getBoundingClientRect();
      slotRects.push({ idx, x: r.left - cardBCR.left, y: r.top - cardBCR.top, w: r.width, h: r.height });
    });

    const canvas = document.createElement("canvas");
    canvas.width  = naturalW * PR;
    canvas.height = naturalH * PR;
    const ctx = canvas.getContext("2d")!;

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0); resolve(); };
      img.onerror = reject;
      img.src = layoutDataUrl;
    });

    await Promise.all(slotRects.map(({ idx, x, y, w, h }) => {
      const dataUrl = coverSrcs[idx];
      if (!dataUrl) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload  = () => { ctx.drawImage(img, x * PR, y * PR, w * PR, h * PR); resolve(); };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }));

    return canvas;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const canvas = await buildCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "rekodo-essentials-wall.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyImage() {
    setExporting(true);
    try {
      const blobPromise: Promise<Blob> = buildCanvas().then((canvas) => {
        if (!canvas) throw new Error("capture failed");
        return new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
        );
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      await blobPromise;
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      setExporting(false);
      setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  const rows   = Math.max(1, Math.ceil(shownCovers.length / COLS));
  const CARD_H = 28 + 46 + (shownCovers.length === 0 ? 200 : rows * CELL + (rows - 1) * GAP) + 24 + 58 + 36 + 24;
  const SCALE  = Math.min(1, 508 / CARD_W);
  const PRV_W  = Math.round(CARD_W * SCALE);
  const PRV_H  = Math.round(CARD_H * SCALE);

  const busy = exporting || !coversLoaded;
  const cardProps = { username, total, primaryGenre, primaryGenrePct, covers: shownCovers, coverSrcs };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}>
          <WallCard {...cardProps} forExport />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Essentials Wall</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {!coversLoaded ? (
            <p style={{ fontFamily: UI_MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading artwork…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                <WallCard {...cardProps} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleDownload}
              disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: busy ? "wait" : "pointer", padding: "10px 0", opacity: busy ? 0.5 : 1 }}
            >
              {exporting ? "Exporting…" : !coversLoaded ? "Loading…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.15)", cursor: busy ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK, opacity: busy ? 0.5 : 1 }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
