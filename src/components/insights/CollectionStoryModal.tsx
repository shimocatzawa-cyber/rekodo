"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";

const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";
const BG      = "#F6F3EB";
const ORANGE  = "#C96A2B";
const INK     = "#1a1a1a";
const MUTED   = "#888888";
const RULE    = "#dddad2";
const DARK    = "#1E2B1F";

interface CardProps {
  username:         string;
  totalRecords:     number;
  collectionLifespan: { period: string; Added: number }[];
  collectorSinceYear: number | null;
  yearRange:        { oldest: number; newest: number } | null;
  countryCount:     number;
}
interface Props extends CardProps { onClose: () => void }

function StoryCard({ username, totalRecords, collectionLifespan, collectorSinceYear, yearRange, countryCount, forExport = false }: CardProps & { forExport?: boolean }) {
  const sinceYear = collectorSinceYear ?? (collectionLifespan[0]?.period.match(/\d{4}/)?.[0] ? parseInt(collectionLifespan[0].period.match(/\d{4}/)![0]) : null);

  // Build cumulative totals, prepend a 0 origin point
  const rawCumulative = collectionLifespan.reduce<{ period: string; total: number }[]>((acc, pt) => {
    const prev = acc[acc.length - 1]?.total ?? 0;
    acc.push({ period: pt.period, total: prev + pt.Added });
    return acc;
  }, []);
  const firstYear = rawCumulative[0]?.period.match(/\d{4}/)?.[0] ?? "";
  const cumulative = rawCumulative.length > 0
    ? [{ period: `pre-${firstYear}`, total: 0 }, ...rawCumulative]
    : rawCumulative;

  const yearSpan = yearRange ? yearRange.newest - yearRange.oldest : null;

  const CW = 300, CH = 360;
  const PAD_L = 0, PAD_R = 0, PAD_T = 2, PAD_B = 28;
  const plotW = CW - PAD_L - PAD_R;
  const plotH = CH - PAD_T - PAD_B;

  const maxTotal = Math.max(...cumulative.map(p => p.total), 1);
  const pts = cumulative.map((p, i) => ({
    x: PAD_L + (i / Math.max(cumulative.length - 1, 1)) * plotW,
    y: PAD_T + (1 - p.total / maxTotal) * plotH,
    period: p.period,
    total: p.total,
  }));

  // Show every other year label, always include first and last
  const labelIndices = new Set<number>([0, pts.length - 1]);
  for (let i = 2; i < pts.length - 1; i += 2) labelIndices.add(i);

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const fillPath = pts.length > 0
    ? `M ${pts[0].x},${PAD_T + plotH} ` + pts.map(p => `L ${p.x},${p.y}`).join(" ") + ` L ${pts[pts.length - 1].x},${PAD_T + plotH} Z`
    : "";

  // Narrative milestones with Japanese
  const narrativeLines: { en: string; ja: string }[] = [];
  if (sinceYear) narrativeLines.push({ en: `You started collecting in ${sinceYear}.`, ja: `${sinceYear}年、始まり。` });
  if (cumulative.length > 3) {
    const midIdx = Math.floor(cumulative.length * 0.45);
    narrativeLines.push({ en: `Your collection grew slowly…`, ja: `ゆっくりと成長し…` });
    const growthYear = cumulative[midIdx]?.period.match(/\d{4}/)?.[0];
    if (growthYear) narrativeLines.push({ en: `…until ${growthYear}.`, ja: `…${growthYear}年まで。` });
  }
  narrativeLines.push({ en: "And today.", ja: "そして今日。" });

  return (
    <div style={{ width: 560, background: BG, boxSizing: "border-box", minHeight: 660 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 28px 0" }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: INK, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
          Collection Story
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1, flexShrink: 0 }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </div>
      </div>

      <div style={{ height: 1, background: RULE, margin: "16px 28px 0" }} />

      {/* Body: text left, chart right */}
      <div style={{ display: "flex", alignItems: "flex-start", padding: "24px 28px 0", gap: 20 }}>

        {/* Narrative text */}
        <div style={{ width: 170, flexShrink: 0, paddingTop: 4 }}>
          {narrativeLines.map((line, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: SERIF, fontSize: 12, fontStyle: "italic", color: MUTED, lineHeight: 1.3, marginBottom: 3 }}>{line.ja}</div>
              <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.4 }}>{line.en}</div>
            </div>
          ))}
        </div>

        {/* Line chart */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" height={CH} style={{ display: "block", overflow: "visible" }}>
            {/* Fill area */}
            {fillPath && <path d={fillPath} fill="#3D3D3D" />}

            {/* Line */}
            <polyline points={polyline} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

            {/* Dot markers at each data point */}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={labelIndices.has(i) ? 3.5 : 2} fill={ORANGE} />
            ))}

            {/* Year labels on x-axis */}
            {pts.map((p, i) => {
              if (!labelIndices.has(i)) return null;
              const isPreOrigin = p.period.startsWith("pre-");
              const yr = p.period.match(/\d{4}/)?.[0];
              if (!yr) return null;
              const label = isPreOrigin ? `Pre ${yr}` : yr;
              return (
                <text key={i} x={p.x} y={CH - 4} textAnchor="middle" fontFamily={MONO} fontSize={11} fill={MUTED}>
                  {label}
                </text>
              );
            })}

            {/* Baseline */}
            <line x1={PAD_L} y1={PAD_T + plotH} x2={CW - PAD_R} y2={PAD_T + plotH} stroke={RULE} strokeWidth={1} />
          </svg>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ margin: "20px 28px 0", height: 1, background: RULE }} />
      <div style={{ display: "flex", padding: "16px 28px 0" }}>
        <div style={{ flex: 1, paddingRight: 16, borderRight: `1px solid ${RULE}`, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>Today you own</div>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: INK, lineHeight: 1 }}>{totalRecords.toLocaleString()}</div>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginTop: 4 }}>Items</div>
        </div>
        {countryCount > 0 && (
          <div style={{ flex: 1, paddingLeft: 16, paddingRight: 16, borderRight: `1px solid ${RULE}`, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>From</div>
            <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: INK, lineHeight: 1 }}>{countryCount}</div>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Countries</div>
          </div>
        )}
        {yearSpan != null && yearSpan > 0 && (
          <div style={{ flex: 1, paddingLeft: 16, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>Spanning</div>
            <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: INK, lineHeight: 1 }}>{yearSpan}</div>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Years of music</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "20px 28px 24px" }}>
        <div style={{ height: 1, background: RULE, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>What does your collection story look like?</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.08em", color: MUTED }}>@{username} · rekodo.co</div>
        </div>
      </div>
    </div>
  );
}

export default function CollectionStoryModal({ onClose, ...cardProps }: Props) {
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const exportRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState<number | null>(null);
  const [scale, setScale] = useState(() => {
    if (typeof window === "undefined") return 508 / 560;
    const avail = Math.min(560, window.innerWidth - 48) - 40;
    return Math.min(1, Math.max(0.3, avail / 560));
  });

  useEffect(() => {
    document.fonts.ready.then(() => {
      if (exportRef.current) setCardH(exportRef.current.offsetHeight);
    });
    const onResize = () => {
      const avail = Math.min(560, window.innerWidth - 48) - 40;
      setScale(Math.min(1, Math.max(0.3, avail / 560)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;
    const PR = 2;
    const dataUrl = await toPng(exportRef.current, { pixelRatio: PR });
    const canvas = document.createElement("canvas");
    canvas.width  = exportRef.current.offsetWidth  * PR;
    canvas.height = exportRef.current.offsetHeight * PR;
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
      link.download = "rekodo-collection-story.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
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
      await blobPromise;
      setCopyState("copied");
    } catch { setCopyState("failed"); }
    finally { setExporting(false); setTimeout(() => setCopyState("idle"), 2500); }
  }

  const SCALE = scale;
  const PRV_W = Math.round(560 * SCALE);
  const PRV_H = cardH != null ? Math.round(cardH * SCALE) : 420;
  const busy  = exporting || cardH == null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>

      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}><StoryCard {...cardProps} forExport /></div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Your Collection's Story</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: 18, color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {cardH == null ? (
            <p style={{ fontFamily: UI_MONO, fontSize: 10, color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", display: "inline-block" }}>
                <StoryCard {...cardProps} />
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
