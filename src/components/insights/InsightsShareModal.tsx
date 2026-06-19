"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG      = "#FBF7F2";
const CHARCOAL = "#1C1C1A";
const ACCENT  = "#C96A2B";
const MUTED   = "#9A8F84";

interface CardProps {
  username:     string;
  totalRecords: number;
  topGenre:     string | null;
  topDecade:    string | null;
  topArtist:    string | null;
  topLabel:     string | null;
  oneLiner:     string | null;
}
interface Props extends CardProps {
  onClose: () => void;
}

// DOM: 540×675 → export: 1080×1350 (pixelRatio 2)
function ProfileCard({ username, totalRecords, topGenre, topDecade, topArtist, topLabel, oneLiner }: CardProps) {
  const highlights = [
    { label: "Top Genre",  value: topGenre  ?? "—" },
    { label: "Top Artist", value: topArtist ?? "—" },
    { label: "Top Decade", value: topDecade ?? "—" },
    { label: "Top Label",  value: topLabel  ?? "—" },
  ];

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "32px 44px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* 1. Logo */}
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: CHARCOAL, letterSpacing: "0.01em" }}>
          rek<span style={{ color: ACCENT }}>ō</span>do
        </span>
      </div>

      {/* 2. Eyebrow */}
      <div style={{ marginTop: 36, flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, letterSpacing: "0.3em", textTransform: "uppercase" }}>
          Collection Profile
        </div>
      </div>

      {/* 3. Hero release count */}
      <div style={{ marginTop: 14, flexShrink: 0 }}>
        <div style={{
          fontFamily: SERIF, fontSize: 80, fontWeight: 400, color: CHARCOAL,
          lineHeight: 0.9, letterSpacing: "-0.025em",
        }}>
          {totalRecords.toLocaleString()}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 8, color: ACCENT,
          letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 10,
        }}>
          Releases
        </div>
      </div>

      {/* 4. AI insight */}
      {oneLiner && (
        <div style={{ marginTop: 28, flexShrink: 0, paddingRight: 16 }}>
          <div style={{
            fontFamily: SERIF, fontSize: 11, fontStyle: "italic",
            color: MUTED, lineHeight: 1.8,
          }}>
            {oneLiner}
          </div>
        </div>
      )}

      {/* 5. Four collection highlights */}
      <div style={{ marginTop: oneLiner ? 28 : 32, flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 22, columnGap: 24 }}>
          {highlights.map(({ label, value }) => (
            <div key={label}>
              <div style={{
                fontFamily: MONO, fontSize: 7, color: MUTED,
                letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6,
              }}>
                {label}
              </div>
              <div style={{
                fontFamily: SERIF, fontSize: 14, fontWeight: 500, color: CHARCOAL,
                lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* 6+7. Username + rekodo.co */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.1em" }}>
          @{username}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.08em" }}>
          rekodo.co
        </div>
      </div>

    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function InsightsShareModal({ onClose, ...cardProps }: Props) {
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
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
      link.download = "rekodo-collection-profile.png";
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1, overflow: "hidden" }}>
        <div ref={exportRef}>
          <ProfileCard {...cardProps} />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Collection Profile</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
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
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: CHARCOAL, color: "#fff", border: "none", cursor: exporting ? "wait" : "pointer", padding: "10px 0", opacity: exporting ? 0.5 : 1 }}
            >
              {exporting ? "Exporting…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.15)", cursor: exporting ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : CHARCOAL, opacity: exporting ? 0.5 : 1 }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
