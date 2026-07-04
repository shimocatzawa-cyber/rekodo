"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { trackShareCard } from "@/lib/shareCard";

const CARD_W  = 560;
const SERIF   = '"Shippori Mincho", Georgia, serif';
const MONO    = '"DM Mono", "Courier New", monospace';
const UI_MONO = "var(--font-mono)";
const BG      = "#F6F3EB";
const ORANGE  = "#C96A2B";
const INK     = "#1a1a1a";
const MUTED   = "#666666";
const RULE    = "#dddad2";
const ART_BG  = "#e8e4da";

const ERA_COLORS = ["#4A7C59", "#C4813A", "#4472B0", "#7B5EA7"] as const;

type CoverSrcs = Record<number, string | null>;

export interface EraPhase {
  eraNum:        number;
  phaseName:     string;
  years:         string | null;
  dominantStyle: string;
  coverAlbum:    { artist: string; album: string; coverUrl: string } | null;
}

interface CardProps {
  username:             string;
  totalRecords:         number;
  countryCount:         number;
  yearRange:            { oldest: number; newest: number } | null;
  biggestCollectingYear: number | null;
  eraPhases:            EraPhase[];
  coverSrcs:            CoverSrcs;
  forExport?:           boolean;
}

interface Props extends Omit<CardProps, "coverSrcs" | "forExport"> {
  onClose: () => void;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loadCovers(phases: EraPhase[]): Promise<CoverSrcs> {
  const entries = await Promise.all(
    phases.map(async (phase): Promise<[number, string | null]> => {
      const url = phase.coverAlbum?.coverUrl;
      if (!url) return [phase.eraNum - 1, null];
      try {
        const r = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
        if (!r.ok) return [phase.eraNum - 1, null];
        const dataUrl = await blobToDataUrl(await r.blob());
        return [phase.eraNum - 1, dataUrl];
      } catch {
        return [phase.eraNum - 1, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}


// ── Card ──────────────────────────────────────────────────────────────────
function StoryV2Card({
  username, totalRecords, countryCount, yearRange, biggestCollectingYear,
  eraPhases, coverSrcs, forExport = false,
}: CardProps) {
  const PAD     = 28;
  const GAP     = 12;
  const cols    = eraPhases.length || 1;
  const colW    = Math.floor((CARD_W - PAD * 2 - GAP * (cols - 1)) / cols);
  const coverSz = colW; // square covers

  const yearSpan = yearRange ? yearRange.newest - yearRange.oldest : null;

  const stats: { value: string; label: string }[] = [
    { value: totalRecords.toLocaleString(), label: "Records Owned" },
    ...(countryCount > 0 ? [{ value: String(countryCount), label: "Countries" }] : []),
    ...(yearSpan != null && yearSpan > 0 ? [{ value: String(yearSpan + 1), label: `Years of Music\n(${yearRange!.oldest}–${yearRange!.newest})` }] : []),
    ...(biggestCollectingYear ? [{ value: String(biggestCollectingYear), label: "Biggest\nCollecting Year" }] : []),
  ];

  return (
    <div style={{ width: CARD_W, background: BG, boxSizing: "border-box" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: `28px ${PAD}px 0` }}>
        <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          My Collection Story
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1, flexShrink: 0, paddingTop: 4 }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </div>
      </div>

      {/* Rule */}
      <div style={{ height: 1, background: RULE, margin: `18px ${PAD}px 0` }} />

      {/* ── "Four Lives" section ── */}
      <div style={{ padding: `28px ${PAD}px 0` }}>

        {/* Section heading */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 28,
        }}>
          <div style={{ flex: 1, height: 1, background: RULE }} />
          <div style={{
            fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.18em",
            textTransform: "uppercase", color: MUTED, flexShrink: 0,
          }}>
            Your Collection Had Four Lives
          </div>
          <div style={{ flex: 1, height: 1, background: RULE }} />
        </div>

        {/* Era columns */}
        <div style={{ display: "flex", gap: GAP }}>
          {eraPhases.map((phase, i) => {
            const color   = ERA_COLORS[i] ?? ERA_COLORS[0];
            const src     = coverSrcs[i] ?? null;

            return (
              <div key={phase.eraNum} style={{ width: colW, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>

                {/* Colored accent bar */}
                <div style={{ width: "100%", height: 4, background: color, marginBottom: 14 }} />

                {/* Phase name */}
                <div style={{
                  fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, color: INK,
                  lineHeight: 1.25, textAlign: "center", marginBottom: 10, minHeight: 40,
                }}>
                  {phase.phaseName}
                </div>

                {/* Year range — hidden for now, kept in data for future use */}
                {false && phase.years && (
                  <div style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
                    color, marginBottom: 12,
                  }}>
                    {phase.years}
                  </div>
                )}

                {/* Album cover */}
                {forExport ? (
                  <div
                    data-cover-slot={i}
                    style={{ width: coverSz, height: coverSz, background: ART_BG, marginBottom: 6 }}
                  />
                ) : (
                  <div style={{
                    width: coverSz, height: coverSz, background: ART_BG,
                    backgroundImage: src ? `url(${src})` : "none",
                    backgroundSize: "cover", backgroundPosition: "center",
                    marginBottom: 6, flexShrink: 0,
                  }} />
                )}

                {/* Artist + album name */}
                {phase.coverAlbum && (
                  <div style={{ width: "100%", marginBottom: 8, textAlign: "center" }}>
                    <div style={{
                      fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.06em",
                      color: INK, fontWeight: 700,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {phase.coverAlbum.artist}
                    </div>
                    <div style={{
                      fontFamily: MONO, fontSize: 7, letterSpacing: "0.04em",
                      color: MUTED,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {phase.coverAlbum.album}
                    </div>
                  </div>
                )}

                {/* Style tag */}
                <div style={{
                  fontFamily: MONO, fontSize: 8, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: INK,
                  border: `1px solid ${color}`, padding: "3px 8px",
                  textAlign: "center", maxWidth: "100%",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {phase.dominantStyle}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ── Timeline rule ── */}
      <div style={{ padding: `24px ${PAD}px 0` }}>
        <div style={{ position: "relative", height: 2, background: RULE }}>
          {eraPhases.map((_, i) => {
            const pct = eraPhases.length > 1
              ? (i / (eraPhases.length - 1)) * 100
              : 50;
            const color = ERA_COLORS[i] ?? ERA_COLORS[0];
            return (
              <div key={i} style={{
                position: "absolute", top: "50%", transform: "translate(-50%, -50%)",
                left: `${pct}%`,
                width: 10, height: 10, borderRadius: "50%", background: color,
              }} />
            );
          })}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ margin: `20px ${PAD}px 0`, height: 1, background: RULE }} />
      <div style={{ display: "flex", padding: `16px ${PAD}px 0` }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", paddingLeft: i > 0 ? 12 : 0, paddingRight: i < stats.length - 1 ? 12 : 0,
            borderLeft: i > 0 ? `1px solid ${RULE}` : "none",
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.1em",
              textTransform: "uppercase", color: MUTED, marginTop: 5,
              whiteSpace: "pre-line", lineHeight: 1.4,
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: `20px ${PAD}px 24px` }}>
        <div style={{ height: 1, background: RULE, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>
            Every record you add writes your story.
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.08em", color: MUTED }}>
            @{username} · rekodo.co
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────
export default function CollectionStoryV2Modal({ onClose, eraPhases, ...cardProps }: Props) {
  const [coverSrcs,    setCoverSrcs]    = useState<CoverSrcs>({});
  const [coversLoaded, setCoversLoaded] = useState(eraPhases.every(p => !p.coverAlbum));
  const [cardH,        setCardH]        = useState<number | null>(null);
  const [exporting,    setExporting]    = useState(false);
  const [copyState,    setCopyState]    = useState<"idle" | "copied" | "failed">("idle");
  const [scale, setScale] = useState(() => {
    if (typeof window === "undefined") return 508 / CARD_W;
    const avail = Math.min(560, window.innerWidth - 48) - 40;
    return Math.min(1, Math.max(0.3, avail / CARD_W));
  });
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eraPhases.every(p => !p.coverAlbum)) return;
    loadCovers(eraPhases).then((srcs) => { setCoverSrcs(srcs); setCoversLoaded(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.fonts.ready.then(() => {
      if (exportRef.current) setCardH(exportRef.current.offsetHeight);
    });
    const onResize = () => {
      const avail = Math.min(560, window.innerWidth - 48) - 40;
      setScale(Math.min(1, Math.max(0.3, avail / CARD_W)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;

    const PR       = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    // Render layout first (covers are placeholder divs in forExport mode)
    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });

    // Collect cover slot positions relative to the card
    const cardBCR = exportRef.current.getBoundingClientRect();
    const slotRects: { idx: number; x: number; y: number; w: number; h: number }[] = [];
    exportRef.current.querySelectorAll<HTMLElement>("[data-cover-slot]").forEach((el) => {
      const idx = parseInt(el.dataset.coverSlot!);
      const r   = el.getBoundingClientRect();
      slotRects.push({ idx, x: r.left - cardBCR.left, y: r.top - cardBCR.top, w: r.width, h: r.height });
    });

    const canvas = document.createElement("canvas");
    canvas.width  = naturalW * PR;
    canvas.height = naturalH * PR;
    const ctx = canvas.getContext("2d")!;

    // Draw base layout
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0); resolve(); };
      img.onerror = reject;
      img.src = layoutDataUrl;
    });

    // Overlay each cover image at its slot position
    await Promise.all(slotRects.map(({ idx, x, y, w, h }) => {
      const dataUrl = coverSrcs[idx];
      if (!dataUrl) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload  = () => { ctx.drawImage(img, x * PR, y * PR, w * PR, h * PR); resolve(); };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }));

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
      trackShareCard("Collection Story V2", "download");
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
      trackShareCard("Collection Story V2", "copy");
      await blobPromise;
      setCopyState("copied");
    } catch { setCopyState("failed"); }
    finally { setExporting(false); setTimeout(() => setCopyState("idle"), 2500); }
  }

  const PRV_W = Math.round(CARD_W * scale);
  const PRV_H = cardH != null ? Math.round(cardH * scale) : 460;
  const busy  = exporting || !coversLoaded || cardH == null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      {/* Off-screen export target */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}>
          <StoryV2Card {...cardProps} eraPhases={eraPhases} coverSrcs={coverSrcs} forExport />
        </div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

        {/* Modal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Collection Story</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: 18, color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {cardH == null ? (
            <p style={{ fontFamily: UI_MONO, fontSize: 10, color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", display: "inline-block" }}>
                <StoryV2Card {...cardProps} eraPhases={eraPhases} coverSrcs={coverSrcs} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
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
