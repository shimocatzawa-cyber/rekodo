"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";

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
    const target = url.startsWith("/")
      ? url
      : `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(target);
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
  totalRecords:       number;
  styleBreakdown:     { style: string; count: number; pct: number }[];
  genreBreakdown:          { genre: string; count: number; pct: number }[];
  desirabilityBreakdown:   { tier: string; count: number }[];
  topArtist:               string | null;
  topArtistCount:          number | null;
  oldestAlbum:        { year: number; artist: string; album: string } | null;
  newestAlbum:        { year: number; artist: string; album: string } | null;
  collectionPhotoUrl: string | null;
  formatBreakdown:    { format: string; count: number }[];
}
interface Props extends CardProps { onClose: () => void }

function StyleBar({ pct, maxPct, color }: { pct: number; maxPct: number; color: string }) {
  const W = 200, H = 6;
  const filled = (pct / maxPct) * W;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <rect x={0} y={0} width={W} height={H} rx={3} fill={RULE} />
      <rect x={0} y={0} width={filled} height={H} rx={3} fill={color} />
    </svg>
  );
}

function VinylIcon({ size = 28, color = INK }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke={color} strokeWidth="1.5" />
      <circle cx="14" cy="14" r="9" stroke={color} strokeWidth="0.75" opacity={0.35} />
      <circle cx="14" cy="14" r="5" stroke={color} strokeWidth="0.75" opacity={0.35} />
      <circle cx="14" cy="14" r="2" fill={color} />
    </svg>
  );
}

function CDIcon({ size = 28, color = INK }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke={color} strokeWidth="1.5" />
      <circle cx="14" cy="14" r="5" stroke={color} strokeWidth="1" opacity={0.4} />
      <circle cx="14" cy="14" r="2" fill={color} opacity={0.5} />
      <circle cx="14" cy="14" r="1" fill={color} />
    </svg>
  );
}

function CassetteIcon({ size = 28, color = INK }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="2" y="6" width="24" height="16" rx="2" stroke={color} strokeWidth="1.5" />
      <circle cx="9" cy="14" r="3" stroke={color} strokeWidth="1" />
      <circle cx="19" cy="14" r="3" stroke={color} strokeWidth="1" />
      <circle cx="9" cy="14" r="1" fill={color} />
      <circle cx="19" cy="14" r="1" fill={color} />
      <path d="M12 14 H16" stroke={color} strokeWidth="1" />
      <rect x="6" y="18" width="16" height="2" rx="0.5" fill={color} opacity={0.15} />
    </svg>
  );
}

const TIER_META: Record<string, { label: string; color: string }> = {
  "rare":         { label: "Rare",         color: "#712B13" },
  "cult":         { label: "Cult",         color: "#3C3489" },
  "widely-loved": { label: "Widely Loved", color: "#27500A" },
  "in-demand":    { label: "In Demand",    color: "#085041" },
};

function ShelfCard({ username, totalRecords, styleBreakdown, genreBreakdown, desirabilityBreakdown, topArtist, topArtistCount, oldestAlbum, newestAlbum, collectionPhotoUrl, formatBreakdown, resolvedPhotoUrl, forExport }: CardProps & { resolvedPhotoUrl?: string; forExport?: boolean }) {
  const VINYL_FMTS = new Set(["LP", "VINYL", "7\"", "10\"", "12\"", "EP"]);
  const CD_FMTS    = new Set(["CD", "CDR", "CD, ALBUM"]);
  const CASS_FMTS  = new Set(["CASSETTE", "CASS"]);

  let records = 0, cds = 0, cassettes = 0;
  for (const { format, count } of formatBreakdown) {
    const f = format.toUpperCase().trim();
    if (VINYL_FMTS.has(f))   records    += count;
    else if (CD_FMTS.has(f)) cds        += count;
    else if (CASS_FMTS.has(f)) cassettes += count;
  }
  const formatPills = [
    ...(records   > 0 ? [{ label: "Records",   count: records,   icon: <VinylIcon size={22} color={INK} /> }]   : []),
    ...(cds       > 0 ? [{ label: "CDs",        count: cds,       icon: <CDIcon size={22} color={INK} /> }]       : []),
    ...(cassettes > 0 ? [{ label: "Cassettes",  count: cassettes, icon: <CassetteIcon size={22} color={INK} /> }] : []),
  ];
  const knownGenres = genreBreakdown.filter(g => g.genre && g.genre !== "Unknown");
  const top4 = knownGenres.slice(0, 4);
  const totalGenreCount = knownGenres.reduce((s, x) => s + x.count, 0) || 1;
  const top4Pcts = top4.map(g => Math.round((g.count / totalGenreCount) * 100));
  const BAR_COLORS = ["#2B3A2C", "#3D6B3A", ORANGE, "#8A5C1A"];

  const sortedDesire = [...desirabilityBreakdown].sort((a, b) => b.count - a.count);
  const desirePcts = sortedDesire.map(d => Math.round((d.count / totalRecords) * 100));

  const photoSrc = resolvedPhotoUrl ?? collectionPhotoUrl ?? "/shelf-photo.jpg";

  return (
    <div style={{ width: 560, background: BG, boxSizing: "border-box", minHeight: 660, display: "flex", flexDirection: "column" }}>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 28px 0" }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: INK, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
          Record Shelf
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1, flexShrink: 0 }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </div>
      </div>

      <div style={{ height: 1, background: RULE, margin: "16px 28px 0" }} />

      {/* Top section: record count + shelf photo */}
      <div style={{ display: "flex", alignItems: "stretch", padding: "0 28px", gap: 0 }}>
        <div style={{ flex: 1, padding: "16px 20px 16px 0", borderRight: `1px solid ${RULE}`, display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", textAlign: "left" }}>
          <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 600, color: INK, lineHeight: 1 }}>{totalRecords.toLocaleString()}</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: 4 }}>Items in Collection</div>
          {formatPills.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20, alignSelf: "stretch", textAlign: "left" }}>
              {formatPills.map(({ label, count, icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>{icon}</div>
                  <div>
                    <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: INK, lineHeight: 1 }}>{count.toLocaleString()}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginTop: 3 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 2.2, flexShrink: 0, padding: "16px 0 16px 20px" }}>
          <div style={{ width: "100%", overflow: "hidden", borderRadius: 4 }}>
            {forExport ? (
              <div data-shelf-photo style={{ width: "100%", height: 220, background: RULE }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt="Record shelf"
                style={{ width: "100%", height: 220, objectFit: "cover", objectPosition: "left top", display: "block" }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: RULE, margin: "0 28px" }} />

      {/* Genre + Desirability columns */}
      <div style={{ display: "flex", padding: "16px 28px", gap: 0 }}>

        {/* Top 4 genres */}
        <div style={{ flex: 1, paddingRight: 20, borderRight: `1px solid ${RULE}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 2 }}>Top Genres</div>
          {top4.map((g, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, flexShrink: 0, fontFamily: SERIF, fontSize: 12, fontWeight: 600, color: INK, textAlign: "right" }}>{top4Pcts[i]}%</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 3 }}>{g.genre}</div>
                <StyleBar pct={top4Pcts[i]} maxPct={100} color={BAR_COLORS[i]} />
              </div>
            </div>
          ))}
        </div>

        {/* Desirability */}
        <div style={{ flex: 1, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 2 }}>By Desirability</div>
          {sortedDesire.map((d, i) => {
            const meta = TIER_META[d.tier];
            if (!meta) return null;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, flexShrink: 0, fontFamily: SERIF, fontSize: 12, fontWeight: 600, color: INK, textAlign: "right" }}>{desirePcts[i]}%</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 3 }}>{meta.label}</div>
                  <StyleBar pct={desirePcts[i]} maxPct={100} color={meta.color} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: RULE, margin: "0 28px" }} />

      {/* Bottom stats: artist, oldest, newest */}
      <div style={{ display: "flex", flex: 1, padding: "20px 28px 0", gap: 0, alignItems: "flex-start" }}>
        <div style={{ flex: 1.2, minWidth: 0, paddingRight: 16, borderRight: `1px solid ${RULE}`, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>Most Collected Artist</div>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: INK, lineHeight: 1.2, wordBreak: "break-word", overflow: "hidden" }}>{topArtist ?? "—"}</div>
          {topArtistCount != null && (
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginTop: 6 }}>{topArtistCount} Records</div>
          )}
        </div>
        <div style={{ flex: 1, paddingLeft: 16, paddingRight: 16, borderRight: `1px solid ${RULE}`, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>Oldest Album</div>
          {oldestAlbum ? (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1 }}>{oldestAlbum.year}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{oldestAlbum.artist}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, lineHeight: 1.4, fontStyle: "italic" }}>{oldestAlbum.album}</div>
            </>
          ) : <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK }}>—</div>}
        </div>
        <div style={{ flex: 1, paddingLeft: 16, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>Newest Album</div>
          {newestAlbum ? (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1 }}>{newestAlbum.year}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{newestAlbum.artist}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, lineHeight: 1.4, fontStyle: "italic" }}>{newestAlbum.album}</div>
            </>
          ) : <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK }}>—</div>}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "20px 28px 28px" }}>
        <div style={{ height: 1, background: RULE, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>What does your shelf look like?</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.08em", color: MUTED, flexShrink: 0, marginLeft: 8 }}>@{username} · rekodo.co</div>
        </div>
      </div>
    </div>
  );
}

export default function RecordShelfModal({ onClose, ...cardProps }: Props) {
  const [exporting, setExporting]   = useState(false);
  const [copyState, setCopyState]   = useState<"idle" | "copied" | "failed">("idle");
  const [photoSrc, setPhotoSrc]     = useState<string | undefined>(undefined);
  const [scale, setScale]           = useState(calcScale);
  const exportRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH]           = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const url = cardProps.collectionPhotoUrl ?? "/shelf-photo.jpg";
      const dataUrl = await imgToDataUrl(url);
      setPhotoSrc(dataUrl ?? url);
      await document.fonts.ready;
      if (exportRef.current) setCardH(exportRef.current.offsetHeight);
    }
    init();

    const onResize = () => setScale(calcScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buildCanvas(): Promise<HTMLCanvasElement | null> {
    if (!exportRef.current) return null;
    await document.fonts.ready;
    const PR = 2;
    const naturalW = exportRef.current.offsetWidth;
    const naturalH = exportRef.current.offsetHeight;

    const layoutDataUrl = await toPng(exportRef.current, { pixelRatio: PR });
    const cardBCR = exportRef.current.getBoundingClientRect();
    const photoEl = exportRef.current.querySelector<HTMLElement>("[data-shelf-photo]");

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

    if (photoEl && photoSrc) {
      const r = photoEl.getBoundingClientRect();
      const x = (r.left - cardBCR.left) * PR;
      const y = (r.top  - cardBCR.top)  * PR;
      const w = r.width  * PR;
      const h = r.height * PR;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => {
          // objectFit: cover, objectPosition: left top
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const boxAspect = w / h;
          let sx = 0, sy = 0, sw: number, sh: number;
          if (imgAspect > boxAspect) { sh = img.naturalHeight; sw = sh * boxAspect; }
          else                       { sw = img.naturalWidth;  sh = sw / boxAspect; }
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = photoSrc!;
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
      link.download = "rekodo-record-shelf.png";
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

  const PRV_W = Math.round(560 * scale);
  const PRV_H = cardH != null ? Math.round(cardH * scale) : 380;
  const busy  = exporting || cardH == null || photoSrc === undefined;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>

      {/* Off-screen export card — uses pre-fetched data URL for reliable image capture */}
      <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={exportRef}><ShelfCard {...cardProps} forExport /></div>
      </div>

      <div style={{ background: "#fff", maxWidth: 560, width: "100%", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
          <p style={{ fontFamily: UI_MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, color: "#666" }}>Record Shelf Snapshot</p>
          <button onClick={onClose} style={{ fontFamily: UI_MONO, fontSize: 18, color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {cardH == null ? (
            <p style={{ fontFamily: UI_MONO, fontSize: 10, color: "#aaa", letterSpacing: "0.06em", alignSelf: "center" }}>Loading…</p>
          ) : (
            <div style={{ width: PRV_W, height: PRV_H, overflow: "hidden", flexShrink: 0, outline: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", display: "inline-block" }}>
                <ShelfCard {...cardProps} />
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
