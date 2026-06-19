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

interface CardProps {
  archetypeId:  string;
  score:        number;
  shadowId:     string;
  shadowScore:  number;
  username:     string;
  forExport?:   boolean;
}
interface Props {
  onClose:     () => void;
  archetypeId: string;
  score:       number;
  shadowId:    string;
  shadowScore: number;
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

// ── Card ─────────────────────────────────────────────────────────────────
// DOM: 600×314  →  export: 1200×628 (pixelRatio 2)
// branding left (138px) | photo centre (234px) | content right (227px)

function LandscapeCard({ archetypeId, score, shadowId, shadowScore, username, forExport }: CardProps) {
  const def         = ARCHETYPES[archetypeId];
  const shadow      = ARCHETYPES[shadowId];
  const color       = def?.color    ?? ORANGE;
  const shadowColor = shadow?.color ?? ORANGE;
  const jungPrimary = def    ? def.jungianRoot.split("·")[0].trim()    : "";
  const jungShadow  = shadow ? shadow.jungianRoot.split("·")[0].trim() : "";
  const desirePrimary = JUNG_CORE_DESIRES[jungPrimary] ?? null;
  const desireShadow  = JUNG_CORE_DESIRES[jungShadow]  ?? null;

  return (
    <div style={{ width: 600, height: 314, background: BG, display: "flex", overflow: "hidden" }}>

      {/* Left: branding */}
      <div style={{
        width: 138, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "16px 14px",
        boxSizing: "border-box",
      }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 8 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 9, color: INK, lineHeight: 1.5 }}>
            What your collection says about you.
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, letterSpacing: "0.07em", marginBottom: 3 }}>@{username}</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: "#bbb", letterSpacing: "0.07em" }}>rekodo.co</div>
        </div>
      </div>

      {/* Centre: photo */}
      {forExport ? (
        <div data-archetype-image style={{ width: 234, height: 314, flexShrink: 0, backgroundColor: "#e5e2dc" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={def?.imagePath} alt={def?.name}
          style={{ width: 234, height: 314, flexShrink: 0, objectFit: "cover", objectPosition: "center top", display: "block" }}
        />
      )}

      {/* Right: content */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "14px 14px 14px 12px",
        overflow: "hidden",
      }}>

        {/* Primary archetype */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 6, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Primary
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 700, color, lineHeight: 1.1, marginBottom: 2 }}>
            {def?.name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, letterSpacing: "0.04em", marginBottom: 6 }}>
            {def?.japanese}
          </div>
          <div style={{ width: 60, height: 2, background: "#e5e2dc", marginBottom: 3 }}>
            <div style={{ width: `${score}%`, height: "100%", background: color }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color, marginBottom: 3 }}>
            {score} / 100
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, marginBottom: 2 }}>
            Jung: {jungPrimary}
          </div>
          {desirePrimary && (
            <div style={{ fontFamily: MONO, fontSize: 7, fontStyle: "italic", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              &ldquo;{desirePrimary}&rdquo;
            </div>
          )}
        </div>

        {/* Archetype description */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 6, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
            {def?.name} Archetype
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {def?.shortDescription}
          </div>
        </div>

        {/* Shadow archetype */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 6, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Shadow Side
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 12, fontWeight: 700, color: shadowColor, lineHeight: 1.1, marginBottom: 2 }}>
            {shadow?.name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, letterSpacing: "0.04em", marginBottom: 6 }}>
            {shadow?.japanese}
          </div>
          <div style={{ width: 60, height: 2, background: "#e5e2dc", marginBottom: 3 }}>
            <div style={{ width: `${shadowScore}%`, height: "100%", background: shadowColor }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: shadowColor, marginBottom: 3 }}>
            {shadowScore} / 100
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, marginBottom: 2 }}>
            Jung: {jungShadow}
          </div>
          {desireShadow && (
            <div style={{ fontFamily: MONO, fontSize: 7, fontStyle: "italic", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              &ldquo;{desireShadow}&rdquo;
            </div>
          )}
        </div>

        {/* Archetypal sentence */}
        <div style={{ paddingLeft: 6, borderLeft: `2px solid ${color}` }}>
          <div style={{ fontFamily: SERIF, fontSize: 8, fontStyle: "italic", color: INK, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            &ldquo;{def?.sentence}&rdquo;
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function ArchetypeShareModal({ onClose, archetypeId, score, shadowId, shadowScore, username }: Props) {
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

    const PR       = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });

    const cardBCR = exportRef.current.getBoundingClientRect();
    const slot    = exportRef.current.querySelector<HTMLElement>("[data-archetype-image]");
    const slotBCR = slot?.getBoundingClientRect();

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

    if (slotBCR && imageDataUrl) {
      const x = slotBCR.left - cardBCR.left;
      const y = slotBCR.top  - cardBCR.top;
      const w = slotBCR.width;
      const h = slotBCR.height;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => { ctx.drawImage(img, x * PR, y * PR, w * PR, h * PR); resolve(); };
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
      link.download = `rekodo-archetype-${slug}.png`;
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

  const SCALE = Math.min(1, 508 / 600);
  const PRV_W = Math.round(600 * SCALE);
  const PRV_H = Math.round(314 * SCALE);

  const busy      = exporting || !imageLoaded;
  const cardProps = { archetypeId, score, shadowId, shadowScore, username };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1, overflow: "hidden" }}>
        <div ref={exportRef}>
          <LandscapeCard {...cardProps} forExport />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Share Card</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          {!imageLoaded ? (
            <p style={{ fontFamily: UI_MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                <LandscapeCard {...cardProps} />
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
