"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { ARCHETYPES, JUNG_CORE_DESIRES } from "@/lib/archetypes/archetypeConfig";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG     = "#FDF6F0";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#888888";
const RULE   = "#e0e0da";

type Format = "portrait" | "landscape";

interface CardProps {
  archetypeId:  string;
  score:        number;
  username:     string;
  imageDataUrl: string | null;
  forExport?:   boolean;
}
interface Props {
  onClose:     () => void;
  archetypeId: string;
  score:       number;
  username:    string;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r   = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loadArchetypeImage(imagePath: string): Promise<string | null> {
  try {
    const r = await fetch(imagePath);
    if (!r.ok) return null;
    return blobToDataUrl(await r.blob());
  } catch {
    return null;
  }
}

// ── Portrait card ─────────────────────────────────────────────────────────
// DOM: 540×675  →  export: 1080×1350 (pixelRatio 2)

function PortraitCard({ archetypeId, score, username, forExport }: CardProps) {
  const def        = ARCHETYPES[archetypeId];
  const color      = def?.color ?? ORANGE;
  const jungPrimary = def ? def.jungianRoot.split("·")[0].trim() : "";
  const desire     = JUNG_CORE_DESIRES[jungPrimary] ?? null;
  const IMG_H      = 180;

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "20px 26px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Top row: page title left | rekōdo right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 400, color: INK, lineHeight: 1.35, flex: 1, minWidth: 0, paddingRight: 14 }}>
          What your collection says about you.
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 5 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>
      </div>

      {/* Horizontal rule */}
      <div style={{ height: 1, background: RULE, marginBottom: 14, flexShrink: 0 }} />

      {/* Archetype image — smaller accent */}
      {forExport ? (
        <div data-archetype-image style={{ width: "100%", height: IMG_H, flexShrink: 0, backgroundColor: "#e5e2dc" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={def?.imagePath} alt={def?.name}
          style={{ width: "100%", height: IMG_H, flexShrink: 0, objectFit: "cover", objectPosition: "center top", display: "block" }}
        />
      )}

      {/* Primary archetype block */}
      <div style={{ marginTop: 14, flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>
          Primary Archetype
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color, lineHeight: 1.1 }}>
            {def?.name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>
            {def?.japanese}
          </div>
        </div>
        {/* Score bar */}
        <div style={{ width: "100%", height: 2, background: "#e5e2dc", marginBottom: 4 }}>
          <div style={{ width: `${score}%`, height: "100%", background: color }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color }}>
            {score} / 100
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
            Jung: {jungPrimary}
          </div>
        </div>
        {desire && (
          <div style={{ fontFamily: MONO, fontSize: 9, fontStyle: "italic", color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>
            &ldquo;{desire}&rdquo;
          </div>
        )}
        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {def?.shortDescription}
        </div>
      </div>

      {/* Archetype sentence */}
      <div style={{ marginTop: 12, paddingLeft: 10, borderLeft: `2px solid ${color}`, flexShrink: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 11, fontStyle: "italic", color: INK, lineHeight: 1.55 }}>
          &ldquo;{def?.sentence}&rdquo;
        </div>
      </div>

      {/* Spacer + footer */}
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: "center", paddingTop: 10, flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</div>
      </div>

    </div>
  );
}

// ── Landscape card ────────────────────────────────────────────────────────
// DOM: 600×314  →  export: 1200×628 (pixelRatio 2)

function LandscapeCard({ archetypeId, score, username, forExport }: CardProps) {
  const def         = ARCHETYPES[archetypeId];
  const color       = def?.color ?? ORANGE;
  const jungPrimary = def ? def.jungianRoot.split("·")[0].trim() : "";
  const desire      = JUNG_CORE_DESIRES[jungPrimary] ?? null;
  const LEFT_W      = 175;
  const IMG_W       = 110;

  return (
    <div style={{
      width: 600, height: 314, background: BG,
      display: "flex", overflow: "hidden",
    }}>

      {/* Left column: branding + page title + username */}
      <div style={{
        width: LEFT_W, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "18px 16px",
        borderRight: `1px solid ${RULE}`, flexShrink: 0,
        boxSizing: "border-box", overflow: "hidden",
      }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 10 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 11, fontWeight: 400, color: INK, lineHeight: 1.4 }}>
            What your collection says about you.
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.07em", marginBottom: 3 }}>@{username}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#bbb", letterSpacing: "0.07em" }}>rekodo.co</div>
        </div>
      </div>

      {/* Archetype image — portrait crop */}
      {forExport ? (
        <div data-archetype-image style={{ width: IMG_W, height: 314, flexShrink: 0, backgroundColor: "#e5e2dc" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={def?.imagePath} alt={def?.name}
          style={{ width: IMG_W, height: 314, flexShrink: 0, objectFit: "cover", objectPosition: "center top", display: "block" }}
        />
      )}

      {/* Right content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "18px 16px", overflow: "hidden" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Primary Archetype
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color, lineHeight: 1.1 }}>
              {def?.name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
              {def?.japanese}
            </div>
          </div>
          <div style={{ width: "100%", height: 2, background: "#e5e2dc", marginBottom: 3 }}>
            <div style={{ width: `${score}%`, height: "100%", background: color }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color }}>{score} / 100</div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>Jung: {jungPrimary}</div>
          </div>
          {desire && (
            <div style={{ fontFamily: MONO, fontSize: 8, fontStyle: "italic", color: MUTED, lineHeight: 1.5, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              &ldquo;{desire}&rdquo;
            </div>
          )}
        </div>
        {/* Sentence */}
        <div style={{ paddingLeft: 8, borderLeft: `2px solid ${color}` }}>
          <div style={{ fontFamily: SERIF, fontSize: 10, fontStyle: "italic", color: INK, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            &ldquo;{def?.sentence}&rdquo;
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function ArchetypeShareModal({ onClose, archetypeId, score, username }: Props) {
  const [format,       setFormat]       = useState<Format>("portrait");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageLoaded,  setImageLoaded]  = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [copyState,    setCopyState]    = useState<"idle" | "copied" | "failed">("idle");
  const exportRef = useRef<HTMLDivElement>(null);

  const def = ARCHETYPES[archetypeId];

  useEffect(() => {
    if (!def) { setImageLoaded(true); return; }
    loadArchetypeImage(def.imagePath).then(url => {
      setImageDataUrl(url);
      setImageLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;

    const PR = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });

    const cardBCR   = exportRef.current.getBoundingClientRect();
    const imageSlot = exportRef.current.querySelector<HTMLElement>("[data-archetype-image]");

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

    if (imageSlot && imageDataUrl) {
      const r = imageSlot.getBoundingClientRect();
      const x = r.left - cardBCR.left;
      const y = r.top  - cardBCR.top;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => { ctx.drawImage(img, x * PR, y * PR, r.width * PR, r.height * PR); resolve(); };
        img.onerror = () => resolve();
        img.src = imageDataUrl;
      });
    }

    return canvas;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const canvas = await buildCanvas();
      if (!canvas) return;
      const slug = (def?.name ?? archetypeId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const link = document.createElement("a");
      link.download = `rekodo-archetype-${slug}-${format}.png`;
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

  const CARD_W = format === "portrait" ? 540 : 600;
  const CARD_H = format === "portrait" ? 675 : 314;
  const SCALE  = Math.min(1, 508 / CARD_W);
  const PRV_W  = Math.round(CARD_W * SCALE);
  const PRV_H  = Math.round(CARD_H * SCALE);

  const busy     = exporting || !imageLoaded;
  const cardProps = { archetypeId, score, username, imageDataUrl };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1, overflow: "hidden" }}>
        <div ref={exportRef}>
          {format === "portrait"
            ? <PortraitCard  {...cardProps} forExport />
            : <LandscapeCard {...cardProps} forExport />
          }
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Share Card</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Format toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          {(["portrait", "landscape"] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em",
                textTransform: "uppercase", padding: "10px 0", background: "none", border: "none",
                cursor: "pointer", borderBottom: `2px solid ${format === f ? ORANGE : "transparent"}`,
                color: format === f ? INK : MUTED,
              }}
            >
              {f === "portrait" ? "Instagram / Stories" : "Reddit / Twitter"}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", justifyContent: "center" }}>
          {!imageLoaded ? (
            <p style={{ fontFamily: UI_MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                {format === "portrait"
                  ? <PortraitCard  {...cardProps} />
                  : <LandscapeCard {...cardProps} />
                }
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleDownload}
              disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: busy ? "wait" : "pointer", padding: "10px 0", opacity: busy ? 0.5 : 1 }}
            >
              {exporting ? "Exporting…" : !imageLoaded ? "Loading…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: busy ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK, opacity: busy ? 0.5 : 1 }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
