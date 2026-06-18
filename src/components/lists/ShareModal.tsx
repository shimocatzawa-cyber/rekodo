"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import type { ListSlot } from "@/app/lists/types";

// Inline font strings — NOT CSS variables — so html-to-image embeds them
const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG     = "#FDF6F0";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#888888";
const RULE   = "#e0e0da";

type Format  = "portrait" | "landscape";
type Covers  = Record<number, string | null>;

interface CardProps {
  title:    string;
  slots:    ListSlot[];
  username: string;
  covers:   Covers;
  /** When true, renders cover slots as plain gray divs (for capture) */
  forExport?: boolean;
}
interface Props {
  onClose:  () => void;
  title:    string;
  slots:    ListSlot[];
  username: string;
  listUrl:  string;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r   = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loadCovers(slots: ListSlot[]): Promise<Covers> {
  const entries = await Promise.all(
    [1, 2, 3, 4, 5].map(async (pos): Promise<[number, string | null]> => {
      const url = slots.find(s => s.position === pos)?.item?.cover_url;
      if (!url) return [pos, null];
      try {
        const r = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
        if (!r.ok) return [pos, null];
        const dataUrl = await blobToDataUrl(await r.blob());
        return [pos, dataUrl];
      } catch {
        return [pos, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

// ── Portrait card ─────────────────────────────────────────────────────────
// DOM: 540×675  →  export: 1080×1350 (pixelRatio 2)

function PortraitCard({ title, slots, username, covers, forExport }: CardProps) {
  const ART = 80;

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "20px 26px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Top row: title left | rekōdo wordmark + rekodo.co stacked right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {title}
        </span>
        <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "right", paddingTop: 3 }}>
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 5 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>
      </div>

      {/* 5 rows — space-around for even breathing room */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
        {[1, 2, 3, 4, 5].map(pos => {
          const item = slots.find(s => s.position === pos)?.item ?? null;
          const src  = covers[pos] ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 400, color: ORANGE, width: 22, flexShrink: 0, lineHeight: 1 }}>
                {pos}
              </span>
              {/* Cover slot: plain div in preview (bg-image), data-attr div for export */}
              {forExport ? (
                <div
                  data-cover-slot={pos}
                  style={{ width: ART, height: ART, flexShrink: 0, backgroundColor: "#e5e2dc" }}
                />
              ) : (
                <div style={{
                  width: ART, height: ART, flexShrink: 0,
                  backgroundImage: src ? `url(${src})` : "none",
                  backgroundSize: "cover", backgroundPosition: "center",
                  backgroundColor: "#e5e2dc",
                }} />
              )}
              {item ? (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
                    {item.artist}
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.song_title ?? item.album}
                  </div>
                </div>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 9, color: "#ccc", letterSpacing: "0.06em" }}>—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: @username only */}
      <div style={{ marginTop: 16, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</div>
      </div>

    </div>
  );
}

// ── Landscape card ────────────────────────────────────────────────────────
// DOM: 600×314  →  export: 1200×628 (pixelRatio 2)

function LandscapeCard({ title, slots, username, covers, forExport }: CardProps) {
  const LEFT_W = 172;
  const ART    = 42;

  return (
    <div style={{
      width: 600, height: 314, background: BG,
      display: "flex", overflow: "hidden",
    }}>

      {/* Left column: branding + title + username/rekodo.co */}
      <div style={{
        width: LEFT_W, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "20px 18px",
        borderRight: `1px solid ${RULE}`, flexShrink: 0, overflow: "hidden",
        boxSizing: "border-box",
      }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, marginBottom: 14, lineHeight: 1 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden" }}>
            {title}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.07em", marginBottom: 3 }}>@{username}</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#bbb", letterSpacing: "0.07em" }}>rekodo.co</div>
        </div>
      </div>

      {/* Right column: 5 rows */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "16px 0" }}>
        {[1, 2, 3, 4, 5].map(pos => {
          const item = slots.find(s => s.position === pos)?.item ?? null;
          const src  = covers[pos] ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: ORANGE, width: 18, flexShrink: 0, lineHeight: 1 }}>
                {pos}
              </span>
              {forExport ? (
                <div
                  data-cover-slot={pos}
                  style={{ width: ART, height: ART, flexShrink: 0, backgroundColor: "#e5e2dc" }}
                />
              ) : (
                <div style={{
                  width: ART, height: ART, flexShrink: 0,
                  backgroundImage: src ? `url(${src})` : "none",
                  backgroundSize: "cover", backgroundPosition: "center",
                  backgroundColor: "#e5e2dc",
                }} />
              )}
              {item && (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.09em", textTransform: "uppercase", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                    {item.artist}
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.song_title ?? item.album}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function ShareModal({ onClose, title, slots, username, listUrl }: Props) {
  const [format,        setFormat]        = useState<Format>("portrait");
  const [covers,        setCovers]        = useState<Covers>({});
  const [coversLoaded,  setCoversLoaded]  = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const [copyImgState,  setCopyImgState]  = useState<"idle" | "copied" | "failed">("idle");

  // Separate ref for the off-screen export card (natural size, no transform)
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCovers(slots).then(c => { setCovers(c); setCoversLoaded(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function capturePng(): Promise<string | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;

    const PR = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    // Step 1: capture layout — gray placeholder boxes where covers will go
    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });

    // Step 2: measure each cover slot's position relative to the card via BCR
    const cardBCR = exportRef.current.getBoundingClientRect();
    const slotRects: { pos: number; x: number; y: number; w: number; h: number }[] = [];
    exportRef.current.querySelectorAll<HTMLElement>("[data-cover-slot]").forEach(el => {
      const pos = parseInt(el.dataset.coverSlot!);
      const r = el.getBoundingClientRect();
      slotRects.push({
        pos,
        x: r.left - cardBCR.left,
        y: r.top  - cardBCR.top,
        w: r.width,
        h: r.height,
      });
    });

    // Step 3: build composite canvas
    const canvas = document.createElement("canvas");
    canvas.width  = naturalW * PR;
    canvas.height = naturalH * PR;
    const ctx = canvas.getContext("2d")!;

    // Step 4: draw the layout PNG
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0); resolve(); };
      img.onerror = reject;
      img.src = layoutDataUrl;
    });

    // Step 5: draw each cover image directly from data URL on top
    await Promise.all(slotRects.map(({ pos, x, y, w, h }) => {
      const dataUrl = covers[pos];
      if (!dataUrl) return Promise.resolve();
      return new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => { ctx.drawImage(img, x * PR, y * PR, w * PR, h * PR); resolve(); };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }));

    return canvas.toDataURL("image/png");
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const dataUrl = await capturePng();
      if (!dataUrl) return;
      const slug    = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const link    = document.createElement("a");
      link.download = `rekodo-${slug}-${format === "portrait" ? "portrait" : "landscape"}.png`;
      link.href     = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyImage() {
    setExporting(true);
    try {
      const dataUrl = await capturePng();
      if (!dataUrl) { setCopyImgState("failed"); return; }
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyImgState("copied");
    } catch {
      setCopyImgState("failed");
    } finally {
      setExporting(false);
      setTimeout(() => setCopyImgState("idle"), 2500);
    }
  }

  const CARD_W = format === "portrait" ? 540 : 600;
  const CARD_H = format === "portrait" ? 675 : 314;
  const SCALE  = Math.min(1, 508 / CARD_W);
  const PRV_W  = Math.round(CARD_W * SCALE);
  const PRV_H  = Math.round(CARD_H * SCALE);

  const busy = exporting || !coversLoaded;

  const cardProps = { title, slots, username, covers };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card — natural size, no transforms, used by toPng */}
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

        {/* Preview — scaled for display only, not used for export */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", justifyContent: "center" }}>
          {!coversLoaded ? (
            <p style={{ fontFamily: UI_MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading artwork…</p>
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
              {exporting ? "Exporting…" : !coversLoaded ? "Loading…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: busy ? "wait" : "pointer", padding: "10px 0", color: copyImgState === "copied" ? "#22c55e" : copyImgState === "failed" ? "#ef4444" : INK, opacity: busy ? 0.5 : 1 }}
            >
              {copyImgState === "copied" ? "Copied ✓" : copyImgState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
