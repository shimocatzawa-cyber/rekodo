"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { trackShareCard } from "@/lib/shareCard";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";
const BG      = "#F6F3EB";
const ORANGE  = "#C96A2B";
const INK     = "#1a1a1a";
const MUTED   = "#555555";
const RULE    = "#dddad2";

async function imgToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function calcScale(): number {
  if (typeof window === "undefined") return 508 / 560;
  const avail = Math.min(560, window.innerWidth - 48) - 40;
  return Math.min(1, Math.max(0.3, avail / 560));
}

interface CardProps {
  username:           string;
  primaryStyle:       string | null;
  styleObsession:     string | null;
  avgReleaseYear:     string | null;
  topCountry:         string | null;
  rarityPct:          number | null;
  collectorArchetype: string | null;
  collectorSinceYear: number | null;
  totalRecords:       number;
}
interface Props extends CardProps { onClose: () => void }

function StatRow({ jaLabel, enLabel, value, noBorder }: { jaLabel: string; enLabel: string; value: string; noBorder?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingBottom: 16, borderBottom: noBorder ? "none" : `1px solid ${RULE}` }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>{enLabel}</div>
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{value || "—"}</div>
      <div style={{ fontFamily: SERIF, fontSize: 11, fontStyle: "italic", color: MUTED }}>{jaLabel}</div>
    </div>
  );
}

function DNACard({ username, primaryStyle, styleObsession, avgReleaseYear, topCountry, rarityPct, collectorArchetype, collectorSinceYear, totalRecords, vinylSrc = "/vinyl-record.png", forExport = false }: CardProps & { vinylSrc?: string; forExport?: boolean }) {
  return (
    <div style={{ width: 560, background: BG, boxSizing: "border-box", fontFamily: SERIF, position: "relative", minHeight: 660, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 28px 0" }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 600, color: INK, lineHeight: 1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            Collector DNA
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1 }}>
            rek<span style={{ color: ORANGE }}>ō</span>do
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: RULE, margin: "16px 28px 0" }} />

      {/* Body: stats left, vinyl right */}
      <div style={{ display: "flex", alignItems: "stretch", padding: "20px 28px 0", flex: 1 }}>

        {/* Stats */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 24, paddingTop: 4, paddingBottom: 20 }}>
          <StatRow jaLabel="主要ジャンル" enLabel="Primary Genre" value={primaryStyle ?? "—"} />
          <StatRow jaLabel="スタイルの執着" enLabel="Style Obsession" value={styleObsession ?? "—"} />
          <StatRow jaLabel="最も多い年代" enLabel="Top Decade" value={avgReleaseYear ?? "—"} />
          <StatRow jaLabel="最も多い国" enLabel="Most Collected Country" value={topCountry ?? "—"} />
          <StatRow jaLabel="コレクションの希少性" enLabel="Collection Rarity" value={rarityPct != null ? `${rarityPct}%` : "—"} noBorder />
        </div>

        {/* Vinyl record image + stats */}
        <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 40, paddingBottom: 20 }}>
          {collectorArchetype && (
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{collectorArchetype}</div>
              <div style={{ fontFamily: SERIF, fontSize: 10, fontStyle: "italic", color: MUTED, marginTop: 2 }}>コレクターの原型</div>
            </div>
          )}
          <div data-vinyl-slot style={{ width: 210, height: 210, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: BG }}>
            {!forExport && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vinylSrc}
                alt="Vinyl record"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", mixBlendMode: "multiply" }}
              />
            )}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 600, color: INK, lineHeight: 1 }}>{totalRecords.toLocaleString()}</div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: 5 }}>Items in Collection</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 28px 24px" }}>
        <div style={{ height: 1, background: RULE, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>What's your Collector DNA?</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.08em", color: MUTED }}>@{username} · rekodo.co</div>
        </div>
      </div>
    </div>
  );
}

export default function CollectorDNAModal({ onClose, ...cardProps }: Props) {
  const [exporting, setExporting]   = useState(false);
  const [copyState, setCopyState]   = useState<"idle" | "copied" | "failed">("idle");
  const [vinylSrc, setVinylSrc]     = useState<string | undefined>(undefined);
  const [scale, setScale]           = useState(calcScale);
  const exportRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH]           = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const dataUrl = await imgToDataUrl("/vinyl-record.png");
      setVinylSrc(dataUrl ?? "/vinyl-record.png");
      await document.fonts.ready;
      if (exportRef.current) setCardH(exportRef.current.offsetHeight);
    }
    init();

    const onResize = () => setScale(calcScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;
    const PR = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });
    const cardBCR  = exportRef.current.getBoundingClientRect();
    const vinylEl  = exportRef.current.querySelector<HTMLElement>("[data-vinyl-slot]");

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

    if (vinylEl && vinylSrc) {
      const r  = vinylEl.getBoundingClientRect();
      const x  = (r.left - cardBCR.left) * PR;
      const y  = (r.top  - cardBCR.top)  * PR;
      const w  = r.width  * PR;
      const h  = r.height * PR;
      const cx = x + w / 2;
      const cy = y + h / 2;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, Math.min(w, h) / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.globalCompositeOperation = "multiply";
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = vinylSrc!;
      });
    }

    return canvas;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const canvas = await buildCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "rekodo-collector-dna.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      trackShareCard("Collector DNA", "download");
    } finally { setExporting(false); }
  }

  async function handleCopy() {
    setExporting(true);
    try {
      const blobPromise: Promise<Blob> = buildCanvas().then(canvas => {
        if (!canvas) throw new Error("failed");
        return new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), "image/png"));
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      trackShareCard("Collector DNA", "copy");
      await blobPromise;
      setCopyState("copied");
    } catch { setCopyState("failed"); }
    finally { setExporting(false); setTimeout(() => setCopyState("idle"), 2500); }
  }

  const PRV_W = Math.round(560 * scale);
  const PRV_H = cardH != null ? Math.round(cardH * scale) : 340;
  const busy  = exporting || cardH == null || vinylSrc === undefined;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>

      {/* Off-screen export card — uses pre-fetched data URL for reliable image capture */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}><DNACard {...cardProps} forExport /></div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Collector DNA</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: 18, color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {cardH == null ? (
            <p style={{ fontFamily: UI_MONO, fontSize: 10, color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", display: "inline-block" }}>
                <DNACard {...cardProps} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleDownload} disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: busy ? "wait" : "pointer", padding: "10px 0", opacity: busy ? 0.5 : 1 }}>
              {exporting ? "Exporting…" : busy ? "Loading…" : "Download PNG"}
            </button>
            <button onClick={handleCopy} disabled={busy}
              style={{ flex: 1, fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.15)", cursor: busy ? "wait" : "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK, opacity: busy ? 0.5 : 1 }}>
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy Image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
