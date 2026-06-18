"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import type { ListSlot } from "@/app/lists/types";

// Direct font family strings on every card element so html-to-image captures them
const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';

// CSS-variable versions for the modal shell UI only (not the card)
const UI_MONO = "var(--font-mono)";

const BG     = "#FDF6F0";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#888888";
const RULE   = "#e0e0da";

type Format = "portrait" | "landscape";

interface CardProps { title: string; slots: ListSlot[]; username: string }
interface Props {
  onClose:  () => void;
  title:    string;
  slots:    ListSlot[];
  username: string;
  listUrl:  string;
}

function proxyUrl(raw: string | null | undefined): string | null {
  return raw ? `/api/image-proxy?url=${encodeURIComponent(raw)}` : null;
}

// ── Portrait card: rendered at 540×675, exported at 1080×1350 (scale ×2) ──

function PortraitCard({ title, slots, username }: CardProps) {
  const HEADER = 40;
  const TITLE  = 38;
  const FOOTER = 36;
  // 1px rule after header, 1px rule after title, 1px rule before footer
  const ROWS_H = 675 - HEADER - 1 - TITLE - 1 - 1 - FOOTER; // 558
  // 5 rows, 4 × 1px dividers between them
  const ROW_H  = Math.floor((ROWS_H - 4) / 5);               // 110
  const ART    = ROW_H - 16;                                  // 94

  return (
    <div style={{ width: 540, height: 675, background: BG, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ height: HEADER, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>rekodo.co</span>
      </div>
      <div style={{ height: 1, background: RULE, flexShrink: 0 }} />

      {/* List title */}
      <div style={{ height: TITLE, display: "flex", alignItems: "center", padding: "0 18px", flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: INK, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </div>
      <div style={{ height: 1, background: RULE, flexShrink: 0 }} />

      {/* 5 rows */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {[1, 2, 3, 4, 5].map((pos, i) => {
          const item  = slots.find(s => s.position === pos)?.item ?? null;
          const cover = proxyUrl(item?.cover_url);
          return (
            <div key={pos} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {i > 0 && <div style={{ height: 1, background: RULE, flexShrink: 0 }} />}
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 18px", gap: 10, minHeight: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, width: 18, flexShrink: 0, lineHeight: 1 }}>
                  {String(pos).padStart(2, "0")}
                </span>
                {cover
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={cover} alt="" style={{ width: ART, height: ART, objectFit: "cover", flexShrink: 0, display: "block" }} />
                  : <div style={{ width: ART, height: ART, background: "#e5e2dc", flexShrink: 0 }} />
                }
                {item ? (
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                      {item.artist}
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.song_title ?? item.album}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontFamily: MONO, fontSize: 8, color: "#ccc", letterSpacing: "0.06em" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ height: 1, background: RULE, flexShrink: 0 }} />
      <div style={{ height: FOOTER, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</span>
      </div>

    </div>
  );
}

// ── Landscape card: rendered at 600×314, exported at 1200×628 (scale ×2) ──

function LandscapeCard({ title, slots, username }: CardProps) {
  const LEFT_W  = 162;
  const HEADER  = 28;
  const MAIN_H  = 314 - HEADER;                    // 286
  const ROW_H   = Math.floor((MAIN_H - 4) / 5);   // 56
  const ART     = ROW_H - 12;                       // 44

  const m       = title.match(/^Top\s+5\s+(.*)/i);
  const subTitle = m ? m[1] : title;

  return (
    <div style={{ width: 600, height: 314, background: BG, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Top bar: rekodo.co right */}
      <div style={{ height: HEADER, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 14px", borderBottom: `1px solid ${RULE}`, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>rekodo.co</span>
      </div>

      {/* Two columns */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* Left: branding + title + username */}
        <div style={{ width: LEFT_W, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 14, borderRight: `1px solid ${RULE}`, flexShrink: 0, overflow: "hidden" }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 10, lineHeight: 1 }}>
              rek<span style={{ color: ORANGE }}>ō</span>do
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 3 }}>
              Top 5
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden" }}>
              {subTitle}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.07em" }}>
            @{username}
          </div>
        </div>

        {/* Right: 5 rows */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {[1, 2, 3, 4, 5].map((pos, i) => {
            const item  = slots.find(s => s.position === pos)?.item ?? null;
            const cover = proxyUrl(item?.cover_url);
            return (
              <div key={pos} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                {i > 0 && <div style={{ height: 1, background: RULE, flexShrink: 0 }} />}
                <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, minHeight: 0 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, width: 16, flexShrink: 0, lineHeight: 1 }}>
                    {String(pos).padStart(2, "0")}
                  </span>
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" style={{ width: ART, height: ART, objectFit: "cover", flexShrink: 0, display: "block" }} />
                    : <div style={{ width: ART, height: ART, background: "#e5e2dc", flexShrink: 0 }} />
                  }
                  {item && (
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.artist}
                      </div>
                      <div style={{ fontFamily: SERIF, fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.song_title ?? item.album}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function ShareModal({ onClose, title, slots, username, listUrl }: Props) {
  const [format,        setFormat]        = useState<Format>("portrait");
  const [exporting,     setExporting]     = useState(false);
  const [copyImgState,  setCopyImgState]  = useState<"idle" | "copied" | "failed">("idle");
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied">("idle");
  const [canWebShare,   setCanWebShare]   = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanWebShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function capturePng(): Promise<string | null> {
    if (!cardRef.current) return null;
    await document.fonts.ready;
    return toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
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

  // Preview: scale card down to fit modal (max preview width ~500px)
  const SCALE  = format === "portrait" ? 500 / 540 : 500 / 600;
  const PRV_W  = Math.round((format === "portrait" ? 540 : 600) * SCALE);
  const PRV_H  = Math.round((format === "portrait" ? 675 : 314) * SCALE);

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

        {/* Preview — clipping wrapper scales card down visually; cardRef is on the natural-size element */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
              <div ref={cardRef}>
                {format === "portrait"
                  ? <PortraitCard  title={title} slots={slots} username={username} />
                  : <LandscapeCard title={title} slots={slots} username={username} />
                }
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>

          {/* Export buttons */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <button
              onClick={handleDownload}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: exporting ? "wait" : "pointer", padding: "10px 0", opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? "Exporting…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={exporting}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: exporting ? "wait" : "pointer", padding: "10px 0", color: copyImgState === "copied" ? "#22c55e" : copyImgState === "failed" ? "#ef4444" : INK, opacity: exporting ? 0.6 : 1 }}
            >
              {copyImgState === "copied" ? "Copied ✓" : copyImgState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>

          {/* Social links */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", alignItems: "center" }}>
            {canWebShare && (
              <button
                onClick={handleWebShare}
                disabled={exporting}
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
