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
// Two columns: photo left (220px, full bleed) | content right

function PortraitCard({ archetypeId, score, username, forExport }: CardProps) {
  const def         = ARCHETYPES[archetypeId];
  const color       = def?.color ?? ORANGE;
  const jungPrimary = def ? def.jungianRoot.split("·")[0].trim() : "";
  const desire      = JUNG_CORE_DESIRES[jungPrimary] ?? null;
  const PHOTO_W     = 220;

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      display: "flex", overflow: "hidden",
    }}>

      {/* Left: photo — full card height, 3:4 source crops to top-center */}
      {forExport ? (
        <div data-archetype-image style={{ width: PHOTO_W, height: 675, flexShrink: 0, backgroundColor: "#e5e2dc" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={def?.imagePath} alt={def?.name}
          style={{ width: PHOTO_W, height: 675, flexShrink: 0, objectFit: "cover", objectPosition: "center top", display: "block" }}
        />
      )}

      {/* Right: all content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px 20px 20px 18px", overflow: "hidden",
      }}>

        {/* Branding */}
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 4 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>

        {/* Page title */}
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
          What your collection says about you.
        </div>

        {/* Primary archetype block */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>
            Primary Archetype
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color, lineHeight: 1.1, marginBottom: 2 }}>
            {def?.name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.04em", marginBottom: 8 }}>
            {def?.japanese}
          </div>
          <div style={{ width: "100%", height: 2, background: "#e5e2dc", marginBottom: 4 }}>
            <div style={{ width: `${score}%`, height: "100%", background: color }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color }}>{score} / 100</div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>Jung: {jungPrimary}</div>
          </div>
          {desire && (
            <div style={{ fontFamily: MONO, fontSize: 8, fontStyle: "italic", color: MUTED, lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              &ldquo;{desire}&rdquo;
            </div>
          )}
          <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {def?.shortDescription}
          </div>
        </div>

        {/* Sentence */}
        <div style={{ paddingLeft: 8, borderLeft: `2px solid ${color}` }}>
          <div style={{ fontFamily: SERIF, fontSize: 10, fontStyle: "italic", color: INK, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            &ldquo;{def?.sentence}&rdquo;
          </div>
        </div>

        {/* Footer */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>@{username}</div>
        </div>

      </div>
    </div>
  );
}

// ── Landscape card ────────────────────────────────────────────────────────
// DOM: 600×314  →  export: 1200×628 (pixelRatio 2)
// Three columns: branding left | photo centre (3:4 at 314px height ≈ 235px wide, minimal crop) | content right

function LandscapeCard({ archetypeId, score, username, forExport }: CardProps) {
  const def         = ARCHETYPES[archetypeId];
  const color       = def?.color ?? ORANGE;
  const jungPrimary = def ? def.jungianRoot.split("·")[0].trim() : "";
  const desire      = JUNG_CORE_DESIRES[jungPrimary] ?? null;
  const BRAND_W     = 138;
  // 3:4 image at 314px height = 235.5px → use 234px so content col gets 228px
  const PHOTO_W     = 234;

  return (
    <div style={{
      width: 600, height: 314, background: BG,
      display: "flex", overflow: "hidden",
    }}>

      {/* Left: branding */}
      <div style={{
        width: BRAND_W, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "18px 14px", borderRight: `1px solid ${RULE}`,
        boxSizing: "border-box", overflow: "hidden",
      }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 10 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 10, color: INK, lineHeight: 1.45 }}>
            What your collection says about you.
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.07em", marginBottom: 3 }}>@{username}</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#bbb", letterSpacing: "0.07em" }}>rekodo.co</div>
        </div>
      </div>

      {/* Centre: photo — 3:4 source at 314px height needs ~235px width, minimal crop */}
      {forExport ? (
        <div data-archetype-image style={{ width: PHOTO_W, height: 314, flexShrink: 0, backgroundColor: "#e5e2dc" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={def?.imagePath} alt={def?.name}
          style={{ width: PHOTO_W, height: 314, flexShrink: 0, objectFit: "cover", objectPosition: "center top", display: "block" }}
        />
      )}

      {/* Right: content — 600 - 138 - 1 - 234 = 227px */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "18px 16px", overflow: "hidden",
        borderLeft: `1px solid ${RULE}`,
      }}>

        {/* Primary archetype */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Primary Archetype
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color, lineHeight: 1.1, marginBottom: 2 }}>
            {def?.name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.04em", marginBottom: 7 }}>
            {def?.japanese}
          </div>
          <div style={{ width: "100%", height: 2, background: "#e5e2dc", marginBottom: 3 }}>
            <div style={{ width: `${score}%`, height: "100%", background: color }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color }}>{score} / 100</div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED }}>Jung: {jungPrimary}</div>
          </div>
          {desire && (
            <div style={{ fontFamily: MONO, fontSize: 7, fontStyle: "italic", color: MUTED, lineHeight: 1.5, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              &ldquo;{desire}&rdquo;
            </div>
          )}
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {def?.shortDescription}
          </div>
        </div>

        {/* Sentence */}
        <div style={{ paddingLeft: 7, borderLeft: `2px solid ${color}` }}>
          <div style={{ fontFamily: SERIF, fontSize: 9, fontStyle: "italic", color: INK, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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

    // Measure BCR before toPng — toPng is async and can cause reflows that shift the element
    const cardBCR   = exportRef.current.getBoundingClientRect();
    const imageSlot = exportRef.current.querySelector<HTMLElement>("[data-archetype-image]");
    const slotBCR   = imageSlot?.getBoundingClientRect() ?? null;

    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });

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
      const r = slotBCR;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => {
          // Draw image with cover behaviour: scale to fill slot, anchor top-center
          const slotW = r.width  * PR;
          const slotH = r.height * PR;
          const imgAspect  = 1440 / 1920; // known 3:4
          const slotAspect = slotW / slotH;
          let drawW: number, drawH: number, offX: number, offY: number;
          if (slotAspect > imgAspect) {
            drawW = slotW;
            drawH = slotW / imgAspect;
          } else {
            drawH = slotH;
            drawW = slotH * imgAspect;
          }
          offX = (slotW - drawW) / 2; // centre horizontally
          offY = 0;                    // anchor top
          ctx.save();
          ctx.beginPath();
          ctx.rect(x * PR, y * PR, slotW, slotH);
          ctx.clip();
          ctx.drawImage(img, x * PR + offX, y * PR + offY, drawW, drawH);
          ctx.restore();
          resolve();
        };
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

  const busy      = exporting || !imageLoaded;
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

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Share Card</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

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
