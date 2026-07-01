"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { trackShareCard } from "@/lib/shareCard";
import type { GeneratedTrack } from "@/components/lists/PlaylistTab";

// Inline font strings — NOT CSS variables — so html-to-image embeds them
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
  title:         string;
  tracks:        GeneratedTrack[];
  username:      string;
  coverDataUrls: (string | null)[];
}
interface Props {
  onClose:  () => void;
  title:    string;
  tracks:   GeneratedTrack[];
  username: string;
}

async function fetchCoverDataUrl(coverUrl: string): Promise<string | null> {
  try {
    const proxied = `/api/image-proxy?url=${encodeURIComponent(coverUrl)}`;
    const res = await fetch(proxied);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function VinylPlaceholder({ size }: { size: number }) {
  const s = Math.round(size * 0.72);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none" style={{ display: "block" }}>
      <circle cx="14" cy="14" r="13" stroke="#b8b0a4" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="9"  stroke="#b8b0a4" strokeWidth="0.75" opacity={0.45} />
      <circle cx="14" cy="14" r="5"  stroke="#b8b0a4" strokeWidth="0.75" opacity={0.45} />
      <circle cx="14" cy="14" r="2"  fill="#b8b0a4" />
    </svg>
  );
}

function mixDetails(tracks: GeneratedTrack[]): string {
  const totalMs  = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const totalMin = Math.round(totalMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const dur = h > 0 ? `${h}h ${m}m` : `${m} min`;
  return `${tracks.length} song${tracks.length === 1 ? "" : "s"} · ${dur}`;
}

// ── Portrait card ─────────────────────────────────────────────────────────
// DOM: 540×675  →  export: 1080×1350 (pixelRatio 2)

function PortraitCard({ title, tracks, username, coverDataUrls }: CardProps) {
  const n = Math.max(tracks.length, 1);
  // ≈675 total − 40 vertical padding − 56 header − 36 footer
  const rowH       = 543 / n;
  const coverSize  = Math.max(14, Math.min(Math.floor(rowH * 0.82), 36));
  const numFont    = Math.max(8,  Math.min(14, Math.round(rowH * 0.30)));
  const artistFont = Math.max(7,  Math.min(11, Math.round(rowH * 0.23)));
  const titleFont  = Math.max(8,  Math.min(14, Math.round(rowH * 0.30)));
  const textGap    = Math.max(2,  Math.min(5,  Math.round(rowH * 0.08)));

  return (
    <div style={{
      width: 540, height: 675, background: BG,
      boxSizing: "border-box", padding: "20px 26px",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Top row: title left | rekōdo wordmark + rekodo.co stacked right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexShrink: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", flex: 1, minWidth: 0, paddingBottom: 4 }}>
          {title}
        </div>
        <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "right", paddingTop: 3 }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 5 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>
      </div>

      {/* One row per track */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
        {tracks.map((t, i) => {
          const pos      = i + 1;
          const coverSrc = coverDataUrls[i] ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Album art */}
              <div style={{ width: coverSize, height: coverSize, flexShrink: 0, background: "#ebe7e0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {coverSrc
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <VinylPlaceholder size={coverSize} />
                }
              </div>
              {/* Track number */}
              <span style={{ fontFamily: MONO, fontSize: numFont, fontWeight: 400, color: ORANGE, width: numFont + 6, flexShrink: 0, lineHeight: 1, textAlign: "right" }}>
                {pos}
              </span>
              {/* Artist + Title — both SERIF */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: SERIF, fontSize: artistFont, fontStyle: "italic", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: textGap, lineHeight: 1.2 }}>
                  {t.artist}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: titleFont, fontWeight: 600, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: mix details + @username */}
      <div style={{ marginTop: 16, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, letterSpacing: "0.1em", marginBottom: 4 }}>{mixDetails(tracks)}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</div>
      </div>

    </div>
  );
}

// ── Landscape card ────────────────────────────────────────────────────────
// DOM: 600×314  →  export: 1200×628 (pixelRatio 2)

function LandscapeCard({ title, tracks, username, coverDataUrls }: CardProps) {
  const LEFT_W = 172;

  const n          = Math.max(tracks.length, 1);
  // ≈314 total − 32 vertical padding on the right column
  const rowH       = 282 / n;
  const coverSize  = Math.max(12, Math.min(Math.floor(rowH * 0.80), 30));
  const numFont    = Math.max(7, Math.min(11, Math.round(rowH * 0.28)));
  const artistFont = Math.max(6, Math.min(9,  Math.round(rowH * 0.20)));
  const titleFont  = Math.max(7, Math.min(12, Math.round(rowH * 0.28)));
  const rowPadX    = Math.max(8, Math.min(16, Math.round(rowH * 0.4)));
  const textGap    = Math.max(1, Math.min(3,  Math.round(rowH * 0.08)));

  return (
    <div style={{
      width: 600, height: 314, background: BG,
      display: "flex", overflow: "hidden",
    }}>

      {/* Left column: branding + title + mix details + username/rekodo.co */}
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
          <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, letterSpacing: "0.06em" }}>{mixDetails(tracks)}</div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.07em", marginBottom: 3 }}>@{username}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#bbb", letterSpacing: "0.07em" }}>rekodo.co</div>
        </div>
      </div>

      {/* Right column: one row per track */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "16px 0" }}>
        {tracks.map((t, i) => {
          const pos      = i + 1;
          const coverSrc = coverDataUrls[i] ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", padding: `0 ${rowPadX}px`, gap: 7 }}>
              {/* Album art */}
              <div style={{ width: coverSize, height: coverSize, flexShrink: 0, background: "#ebe7e0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {coverSrc
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <VinylPlaceholder size={coverSize} />
                }
              </div>
              {/* Track number */}
              <span style={{ fontFamily: MONO, fontSize: numFont, color: ORANGE, width: numFont + 5, flexShrink: 0, lineHeight: 1, textAlign: "right" }}>
                {pos}
              </span>
              {/* Artist + Title — both SERIF */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: SERIF, fontSize: artistFont, fontStyle: "italic", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: textGap, lineHeight: 1.2 }}>
                  {t.artist}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: titleFont, fontWeight: 600, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function PlaylistShareModal({ onClose, title, tracks, username }: Props) {
  const [format,        setFormat]        = useState<Format>("portrait");
  const [exporting,     setExporting]     = useState(false);
  const [copyImgState,  setCopyImgState]  = useState<"idle" | "copied" | "failed">("idle");
  const [coverDataUrls, setCoverDataUrls] = useState<(string | null)[]>([]);
  const [maxPreviewWidth, setMaxPreviewWidth] = useState(508);

  const exportRef = useRef<HTMLDivElement>(null);

  // Responsive preview scale
  useEffect(() => {
    function recalc() {
      setMaxPreviewWidth(Math.min(508, window.innerWidth - 48 - 32));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // Pre-fetch cover art as data URLs so html-to-image doesn't CORS-choke
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      tracks.map(t => t.cover_url ? fetchCoverDataUrl(t.cover_url) : Promise.resolve(null))
    ).then(urls => { if (!cancelled) setCoverDataUrls(urls); });
    return () => { cancelled = true; };
  }, [tracks]);

  async function captureDataUrl(): Promise<string | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;
    return toPng(exportRef.current, { pixelRatio: 2 });
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const dataUrl = await captureDataUrl();
      if (!dataUrl) return;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const link = document.createElement("a");
      link.download = `rekodo-${slug}-${format === "portrait" ? "portrait" : "landscape"}.png`;
      link.href = dataUrl;
      link.click();
      trackShareCard("Playlist", "download");
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyImage() {
    setExporting(true);
    try {
      const blobPromise: Promise<Blob> = captureDataUrl().then(dataUrl => {
        if (!dataUrl) throw new Error("capture failed");
        return fetch(dataUrl).then(r => r.blob());
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      trackShareCard("Playlist", "copy");
      await blobPromise;
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
  const SCALE  = Math.min(1, maxPreviewWidth / CARD_W);
  const PRV_W  = Math.round(CARD_W * SCALE);
  const PRV_H  = Math.round(CARD_H * SCALE);

  const cardProps = { title, tracks, username, coverDataUrls };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card — covers are data URLs so toPng captures them cleanly */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1, overflow: "hidden" }}>
        <div ref={exportRef}>
          {format === "portrait"
            ? <PortraitCard  {...cardProps} />
            : <LandscapeCard {...cardProps} />
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
          <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
              {format === "portrait"
                ? <PortraitCard  {...cardProps} />
                : <LandscapeCard {...cardProps} />
              }
            </div>
          </div>
        </div>

        {/* Actions */}
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
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: exporting ? "wait" : "pointer", padding: "10px 0", color: copyImgState === "copied" ? "#22c55e" : copyImgState === "failed" ? "#ef4444" : INK, opacity: exporting ? 0.5 : 1 }}
            >
              {copyImgState === "copied" ? "Copied ✓" : copyImgState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
