"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import type { SpectrumData } from "@/components/insights/TasteProfile";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG     = "#1B3A66";
const ORANGE = "#CC5500";
const INK    = "#ffffff";
const MUTED  = "rgba(255,255,255,0.50)";
const BAR_BG = "rgba(255,255,255,0.18)";

interface Props {
  onClose:  () => void;
  username: string;
  spectrum: SpectrumData;
}

const AXES: { left: string; right: string; key: keyof SpectrumData }[] = [
  { left: "Ambient",     right: "Abrasive",        key: "abrasivePosition" },
  { left: "Canon",       right: "Obscure",         key: "rarityPosition" },
  { left: "Nostalgic",   right: "Contemporary",    key: "nostalgicPosition" },
  { left: "Broad",       right: "Completist",      key: "completistPosition" },
  { left: "Western",     right: "Non-western",     key: "nonWesternPosition" },
  { left: "Accumulator", right: "Curator",         key: "curatorPosition" },
  { left: "Vinyl pure",  right: "Format agnostic", key: "formatAgnosticPosition" },
];

function SpectrumCard({ username, spectrum }: { username: string; spectrum: SpectrumData }) {
  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "22px 28px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Top row: title left | rekōdo + rekodo.co right — same as Top5 portrait */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, marginBottom: 7 }}>
            Taste Profile
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: INK, lineHeight: 1.2 }}>
            Spectrum Dimensions
          </div>
        </div>
        <div style={{ flexShrink: 0, marginLeft: 14, textAlign: "right", paddingTop: 3 }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 5 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>
      </div>

      {/* Axis rows */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
        {AXES.map(({ left, right, key }) => {
          const value = spectrum[key];
          const hasData = value != null;
          const pos = hasData ? Math.max(5, Math.min(95, value as number)) : 50;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{
                width: 76, flexShrink: 0, textAlign: "right",
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.02em",
                color: hasData ? INK : MUTED,
              }}>
                {left}
              </span>
              <div style={{ flex: 1, height: 2, background: BAR_BG, position: "relative" }}>
                <div style={{
                  position: "absolute", top: "50%", left: `${pos}%`,
                  transform: "translate(-50%, -50%)",
                  width: 10, height: 10,
                  border: `2px solid ${ORANGE}`,
                  background: hasData ? ORANGE : "transparent",
                  opacity: hasData ? 1 : 0.4,
                }} />
              </div>
              <span style={{
                width: 76, flexShrink: 0, textAlign: "left",
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.02em",
                color: hasData ? INK : MUTED,
              }}>
                {right}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer: @username — same position as Top5 portrait */}
      <div style={{ marginTop: 18, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</div>
      </div>

    </div>
  );
}

export default function SpectrumShareModal({ onClose, username, spectrum }: Props) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting,  setExporting]  = useState(false);
  const [copyState,  setCopyState]  = useState<"idle" | "copied" | "failed">("idle");

  const CARD_W = 540;
  const CARD_H = 675;
  const SCALE  = Math.min(1, 508 / CARD_W);
  const PRV_W  = Math.round(CARD_W * SCALE);
  const PRV_H  = Math.round(CARD_H * SCALE);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;
    const PR       = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;
    const dataUrl  = await toPng(exportRef.current, { pixelRatio: PR });
    const canvas   = document.createElement("canvas");
    canvas.width   = naturalW * PR;
    canvas.height  = naturalH * PR;
    const ctx = canvas.getContext("2d")!;
    await new Promise<void>((resolve, reject) => {
      const img    = new Image();
      img.onload   = () => { ctx.drawImage(img, 0, 0); resolve(); };
      img.onerror  = reject;
      img.src      = dataUrl;
    });
    return canvas;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const canvas = await buildCanvas();
      if (!canvas) return;
      const link      = document.createElement("a");
      link.download   = `rekodo-spectrum-${username}.png`;
      link.href       = canvas.toDataURL("image/png");
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

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card — natural size, no transform */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1, overflow: "hidden" }}>
        <div ref={exportRef}>
          <SpectrumCard username={username} spectrum={spectrum} />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Spectrum Share Card</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
              <SpectrumCard username={username} spectrum={spectrum} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleDownload}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "#0d0d0d", color: "#fff", border: "none", cursor: exporting ? "wait" : "pointer", padding: "10px 0", opacity: exporting ? 0.5 : 1 }}
            >
              {exporting ? "Exporting…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: exporting ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : "#0d0d0d", opacity: exporting ? 0.5 : 1 }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
