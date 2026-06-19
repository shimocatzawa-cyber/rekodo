"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";

const BG     = "#FDF6F0";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const MUTED  = "#888888";
const RULE   = "#e0e0da";

// Radial geometry — all values in px, SVG viewBox 0 0 520 480
const CX = 260, CY = 240, R = 182;
const D45 = Math.round(R * Math.sin(Math.PI / 4)); // ≈ 129

interface CardProps {
  username:        string;
  avatarSrc:       string | null;
  totalRecords:    number;
  topGenre:        string | null;
  mostPopularYear: number | null;
  topArtist:       string | null;
  topLabel:        string | null;
  topCountry:      string | null;
  countryCount:    number;
  holyGrails:      number;
  oneLiner:        string | null;
}
interface Props {
  onClose:         () => void;
  avatarUrl:       string | null;
  username:        string;
  totalRecords:    number;
  topGenre:        string | null;
  mostPopularYear: number | null;
  topArtist:       string | null;
  topLabel:        string | null;
  topCountry:      string | null;
  countryCount:    number;
  holyGrails:      number;
  oneLiner:        string | null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ── Anchor helper ─────────────────────────────────────────────────────────
// label small mono above (or below for S), value large serif

function Anchor({
  label, value, style, valSize = "1.1rem", valColor = INK, labelBelow = false,
}: {
  label: string; value: string; style: React.CSSProperties;
  valSize?: string; valColor?: string; labelBelow?: boolean;
}) {
  const labelEl = (
    <div style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", lineHeight: 1.4 }}>
      {label}
    </div>
  );
  const valueEl = (
    <div style={{ fontFamily: SERIF, fontSize: valSize, fontWeight: 600, color: valColor, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {value}
    </div>
  );
  return (
    <div style={{ position: "absolute", ...style }}>
      {labelBelow ? <>{valueEl}{labelEl}</> : <>{labelEl}{valueEl}</>}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────
// DOM: 560 wide, natural height → export: 1120px wide at pixelRatio 2

function ProfileCard({ username, avatarSrc, totalRecords, topGenre, mostPopularYear, topArtist, topLabel, topCountry, countryCount, holyGrails, oneLiner }: CardProps) {
  const decade = mostPopularYear ? `${Math.floor(mostPopularYear / 10) * 10}s` : "—";

  return (
    <div style={{ width: 560, background: BG, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "32px 32px 16px", boxSizing: "border-box" }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>
            Collection Profile
          </div>
          <div style={{ fontFamily: MONO, fontSize: "0.65rem", color: ORANGE, letterSpacing: "0.1em", marginTop: 6 }}>
            @{username}
          </div>
        </div>
        <div style={{ textAlign: "right", paddingTop: 2, flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontFamily: SERIF, fontSize: "1.15rem", fontWeight: 600, color: INK, lineHeight: 1, marginBottom: 5 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
          <div style={{ fontFamily: MONO, fontSize: "0.5rem", color: MUTED, letterSpacing: "0.08em" }}>
            rekodo.co
          </div>
        </div>
      </div>

      {/* ── AI insight (optional) ── */}
      {oneLiner && (
        <div style={{ padding: "0 32px 12px", boxSizing: "border-box" }}>
          <div style={{ fontFamily: SERIF, fontSize: "0.75rem", fontStyle: "italic", color: MUTED, lineHeight: 1.7 }}>
            {oneLiner}
          </div>
        </div>
      )}

      {/* ── Radial section ── */}
      <div style={{ position: "relative", width: 520, height: 480, margin: "0 auto", flexShrink: 0 }}>

        {/* SVG: spokes + dashed ring */}
        <svg viewBox="0 0 520 480" width={520} height={480} style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}>
          {/* 8 spokes */}
          {([
            [CX,        CY - R      ],  // N
            [CX + D45,  CY - D45    ],  // NE
            [CX + R,    CY          ],  // E
            [CX + D45,  CY + D45    ],  // SE
            [CX,        CY + R      ],  // S
            [CX - D45,  CY + D45    ],  // SW
            [CX - R,    CY          ],  // W
            [CX - D45,  CY - D45    ],  // NW
          ] as [number,number][]).map(([x, y], i) => (
            <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={RULE} strokeWidth={1} />
          ))}
          {/* Dashed outer ring */}
          <circle cx={CX} cy={CY} r={R} stroke={RULE} strokeWidth={1} strokeDasharray="2 4" fill="none" />
        </svg>

        {/* ── Centre: profile photo ── */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 124, height: 124, borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${BG}`,
          boxShadow: `0 0 0 1px ${RULE}`,
          backgroundColor: "#e5e2dc",
          flexShrink: 0,
        }}>
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: ORANGE }}>
              ō
            </div>
          )}
        </div>

        {/* ── N: total releases (hero) — text bottom at y=58 ── */}
        <div style={{ position: "absolute", bottom: 480 - (CY - R), left: "50%", transform: "translateX(-50%)", width: 200, textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: "0.5rem", color: ORANGE, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
            Items in Collection
          </div>
          <div style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 600, color: INK, lineHeight: 1 }}>
            {totalRecords.toLocaleString()}
          </div>
        </div>

        {/* ── NE: Top Genre — bottom-left at (389+8, 111) ── */}
        <Anchor label="Top Genre" value={topGenre ?? "—"}
          style={{ bottom: 480 - (CY - D45), left: CX + D45 + 8, width: 115, textAlign: "left" }} />

        {/* ── E: Top Decade — vertically centred at (442+8, 240) ── */}
        <Anchor label="Top Decade" value={decade}
          style={{ top: CY, left: CX + R + 8, width: 62, textAlign: "left", transform: "translateY(-50%)" }} />

        {/* ── SE: Top Artist — top-left at (389+8, 369) ── */}
        <Anchor label="Top Artist" value={topArtist ?? "—"}
          style={{ top: CY + D45, left: CX + D45 + 8, width: 115, textAlign: "left" }} />

        {/* ── S: Holy Grails — value then label (labelBelow), top at y=426 ── */}
        <Anchor label="Holy Grails" value={holyGrails > 0 ? holyGrails.toLocaleString() : "—"}
          valSize="1.6rem" valColor={ORANGE} labelBelow
          style={{ top: CY + R + 6, left: "50%", transform: "translateX(-50%)", width: 200, textAlign: "center" }} />

        {/* ── SW: Top Label — top-right at (131-8, 369) ── */}
        <Anchor label="Top Label" value={topLabel ?? "—"}
          style={{ top: CY + D45, left: 0, width: CX - D45 - 8, textAlign: "right" }} />

        {/* ── W: Pressing Origin — vertically centred at (78-8, 240) ── */}
        <Anchor label="Pressing Origin" value={topCountry ?? "—"}
          style={{ top: CY, left: 0, width: CX - R - 8, textAlign: "right", transform: "translateY(-50%)" }} />

        {/* ── NW: Countries — bottom-right at (131-8, 111) ── */}
        <Anchor label="Countries" value={countryCount > 0 ? String(countryCount) : "—"}
          style={{ bottom: 480 - (CY - D45), left: 0, width: CX - D45 - 8, textAlign: "right" }} />

      </div>{/* end radial */}

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", padding: "16px 0 28px", flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>@{username}</div>
      </div>

    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function InsightsShareModal({ onClose, avatarUrl, ...cardProps }: Props) {
  const [avatarSrc,    setAvatarSrc]    = useState<string | null>(null);
  const [avatarReady,  setAvatarReady]  = useState(!avatarUrl);
  const [exporting,    setExporting]    = useState(false);
  const [copyState,    setCopyState]    = useState<"idle" | "copied" | "failed">("idle");
  const exportRef = useRef<HTMLDivElement>(null);

  // Pre-load avatar via image proxy so html-to-image can embed it
  useEffect(() => {
    if (!avatarUrl) { setAvatarReady(true); return; }
    fetch(`/api/image-proxy?url=${encodeURIComponent(avatarUrl)}`)
      .then(r => r.ok ? r.blob() : null)
      .then(b => b ? blobToDataUrl(b) : null)
      .then(url => { setAvatarSrc(url); setAvatarReady(true); })
      .catch(() => setAvatarReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Preview: scale 560px card to fit modal (max 508px wide)
  const SCALE = Math.min(1, 508 / 560);
  const PRV_W = Math.round(560 * SCALE);
  const PRV_H = Math.round(620 * SCALE); // approx card height

  const busy = exporting || !avatarReady;

  const sharedCardProps = { ...cardProps, avatarSrc };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      {/* Off-screen export card */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}>
          <ProfileCard {...sharedCardProps} />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Collection Profile</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {!avatarReady ? (
            <p style={{ fontFamily: UI_MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                <ProfileCard {...sharedCardProps} />
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
              {exporting ? "Exporting…" : !avatarReady ? "Loading…" : "Download PNG"}
            </button>
            <button
              onClick={handleCopyImage}
              disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.15)", cursor: busy ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK, opacity: busy ? 0.5 : 1 }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
