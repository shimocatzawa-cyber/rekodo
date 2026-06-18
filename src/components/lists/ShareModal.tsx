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
const RULE   = "#e0e0da";   // used only for the vertical separator in landscape

type Format  = "portrait" | "landscape";
type Covers  = Record<number, string | null>; // position → base64 data URL or null

interface CardProps {
  title:    string;
  slots:    ListSlot[];
  username: string;
  covers:   Covers;
}
interface Props {
  onClose:  () => void;
  title:    string;
  slots:    ListSlot[];
  username: string;
  listUrl:  string;
}

// Pre-fetch cover art as base64 data URLs so html-to-image doesn't need
// to make any network requests during capture (avoids cross-origin failures).
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

function PortraitCard({ title, slots, username, covers }: CardProps) {
  const ART = 80;

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "20px 26px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>rekodo.co</span>
      </div>

      {/* List title */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {title}
        </span>
      </div>

      {/* 5 rows — no dividers, space-around for even breathing room */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
        {[1, 2, 3, 4, 5].map(pos => {
          const item = slots.find(s => s.position === pos)?.item ?? null;
          const src  = covers[pos] ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 400, color: ORANGE, width: 22, flexShrink: 0, lineHeight: 1 }}>
                {pos}
              </span>
              {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" style={{ width: ART, height: ART, objectFit: "cover", flexShrink: 0, display: "block" }} />
                : <div style={{ width: ART, height: ART, background: "#e5e2dc", flexShrink: 0 }} />
              }
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

      {/* Footer */}
      <div style={{ marginTop: 18, textAlign: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</span>
      </div>

    </div>
  );
}

// ── Landscape card ────────────────────────────────────────────────────────
// DOM: 600×314  →  export: 1200×628 (pixelRatio 2)

function LandscapeCard({ title, slots, username, covers }: CardProps) {
  const LEFT_W = 172;
  const ART    = 42;

  const m        = title.match(/^Top\s+5\s+(.*)/i);
  const subTitle = m ? m[1] : title;

  return (
    <div style={{
      width: 600, height: 314, background: BG,
      display: "flex", overflow: "hidden",
    }}>

      {/* Left column: branding + title stacked + username */}
      <div style={{
        width: LEFT_W, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "20px 18px",
        borderRight: `1px solid ${RULE}`, flexShrink: 0, overflow: "hidden",
        boxSizing: "border-box",
      }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: INK, marginBottom: 14, lineHeight: 1 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>
            Top 5
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden" }}>
            {subTitle}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.07em", marginBottom: 3 }}>@{username}</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: "#bbb", letterSpacing: "0.07em" }}>rekodo.co</div>
        </div>
      </div>

      {/* Right column: 5 rows, no horizontal rules */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "16px 0" }}>
        {[1, 2, 3, 4, 5].map(pos => {
          const item = slots.find(s => s.position === pos)?.item ?? null;
          const src  = covers[pos] ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: ORANGE, width: 18, flexShrink: 0, lineHeight: 1 }}>
                {pos}
              </span>
              {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" style={{ width: ART, height: ART, objectFit: "cover", flexShrink: 0, display: "block" }} />
                : <div style={{ width: ART, height: ART, background: "#e5e2dc", flexShrink: 0 }} />
              }
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
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied">("idle");
  const [canWebShare,   setCanWebShare]   = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanWebShare(typeof navigator !== "undefined" && !!navigator.share);
    loadCovers(slots).then(c => { setCovers(c); setCoversLoaded(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function capturePng(): Promise<string | null> {
    if (!cardRef.current) return null;
    await document.fonts.ready;
    return toPng(cardRef.current, { pixelRatio: 2 });
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

  async function handleWebShare() {
    setExporting(true);
    try {
      const dataUrl = await capturePng();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file  = new File([blob], "rekodo-list.png", { type: "image/png" });
      await navigator.share({ files: [file], title: `${title} — rekōdo`, url: listUrl });
    } catch { /* dismissed */ } finally {
      setExporting(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(listUrl);
      setCopyLinkState("copied");
      setTimeout(() => setCopyLinkState("idle"), 2500);
    } catch { /* ignore */ }
  }

  const enc  = encodeURIComponent;
  const text = enc(`"${title}" — rekōdo`);
  const url  = enc(listUrl);

  // Scale preview to fit modal without horizontal scroll
  const CARD_W = format === "portrait" ? 540 : 600;
  const CARD_H = format === "portrait" ? 675 : 314;
  const SCALE  = Math.min(1, 508 / CARD_W);
  const PRV_W  = Math.round(CARD_W * SCALE);
  const PRV_H  = Math.round(CARD_H * SCALE);

  const busy = exporting || !coversLoaded;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
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
          {!coversLoaded ? (
            <p style={{ fontFamily: UI_MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading artwork…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                <div ref={cardRef}>
                  {format === "portrait"
                    ? <PortraitCard  title={title} slots={slots} username={username} covers={covers} />
                    : <LandscapeCard title={title} slots={slots} username={username} covers={covers} />
                  }
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>

          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", alignItems: "center" }}>
            {canWebShare && (
              <button
                onClick={handleWebShare}
                disabled={busy}
                style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Share to apps ↗
              </button>
            )}
            <a href={`https://x.com/intent/tweet?text=${text}&url=${url}`} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textDecoration: "none" }}>
              X ↗
            </a>
            <a href={`https://bsky.app/intent/compose?text=${enc(`"${title}" — rekōdo\n${listUrl}`)}`} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textDecoration: "none" }}>
              Bluesky ↗
            </a>
            <a href={`https://www.reddit.com/submit?url=${url}&title=${text}`} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textDecoration: "none" }}>
              Reddit ↗
            </a>
            <button
              onClick={handleCopyLink}
              style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: copyLinkState === "copied" ? "#22c55e" : MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {copyLinkState === "copied" ? "Link Copied ✓" : "Copy Link"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
