"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG     = "#FDF6F0";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#888888";

interface CardProps {
  username:     string;
  totalRecords: number;
  topGenre:     string | null;
  topDecade:    string | null;
  topArtist:    string | null;
  topCountry:   string | null;
  topLabel:     string | null;
  holyGrails:   number;
}
interface Props extends CardProps {
  onClose: () => void;
}

// DOM: 540×675  →  export: 1080×1350 (pixelRatio 2)
function ProfileCard({ username, totalRecords, topGenre, topDecade, topArtist, topCountry, topLabel, holyGrails }: CardProps) {
  const stats = [
    { label: "Top Genre",              value: topGenre   ?? "—" },
    { label: "Top Decade",             value: topDecade  ?? "—" },
    { label: "Top Artist",             value: topArtist  ?? "—" },
    { label: "Top Label",              value: topLabel   ?? "—" },
    { label: "Most Collected Country", value: topCountry ?? "—" },
    { label: "Holy Grails",            value: holyGrails > 0 ? holyGrails.toLocaleString() : "—" },
  ];

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "20px 26px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Top row — mirrors Top5 share card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1.2, marginBottom: 5 }}>
            Collection Profile
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, letterSpacing: "0.1em" }}>
            @{username}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right", paddingTop: 3 }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 5 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>
      </div>

      {/* Hero stat */}
      <div style={{ flexShrink: 0, marginBottom: 28 }}>
        <div style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 400, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {totalRecords.toLocaleString()}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
          Releases
        </div>
      </div>

      {/* Stats — flex column, space-between fills remaining height */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>
              {label}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: INK, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function InsightsShareModal({ onClose, ...cardProps }: Props) {
  const [exporting,  setExporting]  = useState(false);
  const [copyState,  setCopyState]  = useState<"idle" | "copied" | "failed">("idle");
  const exportRef = useRef<HTMLDivElement>(null);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;

    const PR       = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    const dataUrl = await toPng(exportRef.current, { pixelRatio: PR });

    const canvas = document.createElement("canvas");
    canvas.width  = naturalW * PR;
    canvas.height = naturalH * PR;
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
      link.download = `rekodo-collection-profile.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyImage() {
    setExporting(true);
    try {
      const blobPromise: Promise<Blob> = buildCanvas().then(canvas => {
        if (!canvas) throw new Error("capture failed");
        return new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png"),
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

  const SCALE = Math.min(1, 508 / 540);
  const PRV_W = Math.round(540 * SCALE);
  const PRV_H = Math.round(675 * SCALE);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1, overflow: "hidden" }}>
        <div ref={exportRef}>
          <ProfileCard {...cardProps} />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Share Card</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
              <ProfileCard {...cardProps} />
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleDownload}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: exporting ? "wait" : "pointer", padding: "10px 0", opacity: exporting ? 0.5 : 1 }}
            >
              {exporting ? "Exporting…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: exporting ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK, opacity: exporting ? 0.5 : 1 }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
