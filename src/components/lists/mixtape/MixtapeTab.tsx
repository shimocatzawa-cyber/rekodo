"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { toPng } from "html-to-image";

const CassetteSVG = dynamic(() => import("./CassetteSVG"), { ssr: false });

const MONO   = "var(--font-mono)";
const SERIF  = "var(--font-editorial)";
const ORANGE = "#CC5500";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";
const INK    = "#0d0d0d";

// Cassette duration limits in milliseconds per side
const CASSETTE_LIMITS: Record<string, number> = {
  C60:  30 * 60 * 1000,
  C90:  45 * 60 * 1000,
  C120: 60 * 60 * 1000,
};

export type MixtapeTrack = {
  id: string;
  spotify_uri?: string | null;
  artist: string;
  title: string;
  album: string;
  year: number | null;
  cover_url: string | null;
  duration_ms: number;
};

type AlbumResult = {
  id: string;
  artist: string;
  album: string;
  year: number | null;
  cover_url: string | null;
  discogs_id: string | null;
  discogs_tracks: DiscogsTrack[] | null;
};

type DiscogsTrack = {
  position: string;
  title: string;
  duration: string;
  type_: string;
};

// Parse Discogs "3:45" duration string to milliseconds
function parseDuration(str: string): number {
  if (!str?.trim()) return 0;
  const parts = str.trim().split(":").map(s => parseInt(s, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function DurationBar({
  used, limit, label,
}: { used: number; limit: number; label: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  const over = used > limit;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: over ? "#cc2200" : MUTED }}>
          {label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: over ? "#cc2200" : INK }}>
          {formatTime(used)} / {formatTime(limit)}
        </span>
      </div>
      <div style={{ height: 3, background: RULE, borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: over ? "#cc2200" : ORANGE,
          borderRadius: 2,
          transition: "width 0.2s ease",
        }} />
      </div>
    </div>
  );
}

function TrackRow({
  track, index, onRemove,
}: { track: MixtapeTrack; index: number; onRemove: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 0", borderBottom: `1px solid ${RULE}`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, width: 20, flexShrink: 0, textAlign: "right" }}>
        {index + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.title}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.artist}
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, flexShrink: 0 }}>
        {formatTime(track.duration_ms)}
      </span>
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: MUTED, fontSize: 14, lineHeight: 1 }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function SidePanel({
  side, tracks, limit, onRemove,
}: { side: "A" | "B"; tracks: MixtapeTrack[]; limit: number; onRemove: (id: string) => void }) {
  const usedMs = tracks.reduce((sum, t) => sum + t.duration_ms, 0);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1.5px solid ${INK}`, paddingBottom: 6, marginBottom: 10,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
          Side {side}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
          {tracks.length} track{tracks.length !== 1 ? "s" : ""}
        </span>
      </div>
      <DurationBar used={usedMs} limit={limit} label="TAPE" />
      <div style={{ minHeight: 60 }}>
        {tracks.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED, paddingTop: 8 }}>
            No tracks yet — search below and add.
          </p>
        ) : (
          tracks.map((t, i) => (
            <TrackRow key={t.id + i} track={t} index={i} onRemove={() => onRemove(t.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Share card (rendered off-screen, captured by html-to-image) ───────────────

const SERIF_EMBED  = '"Georgia", serif';
const MONO_EMBED   = '"Courier New", monospace';

interface ShareCardProps {
  title: string;
  sideA: MixtapeTrack[];
  sideB: MixtapeTrack[];
  username: string;
  cassetteType: string;
}

function ShareCard({ title, sideA, sideB, username, cassetteType }: ShareCardProps) {
  const COL = "#1c1c1c";
  const CREAM = "#f2efe7";

  return (
    <div style={{
      width: 600,
      background: "#f6f3eb",
      fontFamily: SERIF_EMBED,
      padding: "32px 36px",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: COL, lineHeight: 1.2 }}>{title || "My Mixtape"}</div>
          <div style={{ fontFamily: MONO_EMBED, fontSize: 10, color: "#888", letterSpacing: "0.12em", marginTop: 4 }}>
            {cassetteType} CASSETTE · @{username}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: COL, lineHeight: 1 }}>
          rek<span style={{ color: ORANGE }}>ō</span>do
        </div>
      </div>

      {/* Cassette body illustration (simplified inline) */}
      <div style={{
        background: COL, borderRadius: 10,
        padding: "14px 24px", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 60,
      }}>
        {/* Label band */}
        <div style={{
          background: CREAM, borderRadius: 4,
          padding: "6px 24px", fontSize: 14, fontStyle: "italic", fontWeight: 700,
          color: COL, flexShrink: 0,
        }}>
          {title || "Mix"}
        </div>
        {/* Reels */}
        {["A", "B"].map(s => (
          <div key={s} style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "2px solid #333", background: "#1e1e1e",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "#dedad4",
            }} />
          </div>
        ))}
      </div>

      {/* Track listing - two columns */}
      <div style={{ display: "flex", gap: 24 }}>
        {([["A", sideA], ["B", sideB]] as const).map(([side, tracks]) => (
          <div key={side} style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: MONO_EMBED, fontSize: 9, letterSpacing: "0.2em",
              textTransform: "uppercase", color: ORANGE, marginBottom: 8,
              borderBottom: `1px solid ${ORANGE}`, paddingBottom: 4,
            }}>
              Side {side}
            </div>
            {(tracks as MixtapeTrack[]).map((t, i) => (
              <div key={t.id + i} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                  <span style={{ fontFamily: MONO_EMBED, fontSize: 9, color: ORANGE, flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COL, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </div>
                    <div style={{ fontFamily: MONO_EMBED, fontSize: 9, color: "#666", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.artist}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(tracks as MixtapeTrack[]).length === 0 && (
              <div style={{ fontFamily: MONO_EMBED, fontSize: 9, color: "#bbb" }}>(empty)</div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, borderTop: `1px solid #ddd`, paddingTop: 10, textAlign: "center" }}>
        <div style={{ fontFamily: MONO_EMBED, fontSize: 9, color: "#aaa", letterSpacing: "0.1em" }}>
          rekodo.co
        </div>
      </div>
    </div>
  );
}

// ── Share modal ────────────────────────────────────────────────────────────────

function ShareModal({
  title, sideA, sideB, username, cassetteType, onClose,
}: ShareCardProps & { onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(title || "mixtape").replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setDownloading(false);
    }
  }, [title]);

  const handleCopy = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 8, overflow: "hidden",
          maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Preview */}
        <div ref={cardRef} style={{ display: "inline-block" }}>
          <ShareCard title={title} sideA={sideA} sideB={sideB} username={username} cassetteType={cassetteType} />
        </div>

        {/* Actions */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${RULE}`,
          display: "flex", gap: 12, flexWrap: "wrap",
        }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", padding: "8px 16px",
              background: ORANGE, color: "#fff", border: "none",
              borderRadius: 4, cursor: downloading ? "wait" : "pointer",
              opacity: downloading ? 0.7 : 1,
            }}
          >
            {downloading ? "Saving…" : "Download PNG"}
          </button>
          <button
            onClick={handleCopy}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", padding: "8px 16px",
              background: "none", color: INK, border: `1px solid ${RULE}`,
              borderRadius: 4, cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy Image"}
          </button>
          <button
            onClick={onClose}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", padding: "8px 16px",
              background: "none", color: MUTED, border: "none",
              cursor: "pointer", marginLeft: "auto",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Saved mixtape types ────────────────────────────────────────────────────────

type MixtapeSummary = {
  id: string;
  title: string;
  cassette_type: string;
  created_at: string;
};

type MixtapeFull = MixtapeSummary & {
  side_a: MixtapeTrack[];
  side_b: MixtapeTrack[];
};

// ── Saved list column ──────────────────────────────────────────────────────────

function SavedList({
  mixtapes, selectedId, onSelect, onNew, onDelete,
}: {
  mixtapes: MixtapeSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{ width: 120, flexShrink: 0, paddingTop: 4 }}>
      <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: "0 0 12px" }}>
        Saved
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* New button */}
        <button
          onClick={onNew}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em",
            background: "none", border: "none", padding: "2px 0",
            textAlign: "left", cursor: selectedId === null ? "default" : "pointer",
            color: selectedId === null ? ORANGE : INK,
            borderBottom: selectedId === null ? `1px solid ${ORANGE}` : "1px solid transparent",
            width: "fit-content",
          }}
        >
          + New
        </button>
        {mixtapes.map(m => {
          const active = m.id === selectedId;
          const hovered = m.id === hoveredId;
          return (
            <div
              key={m.id}
              style={{ display: "flex", alignItems: "baseline", gap: 4 }}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onSelect(m.id)}
                style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em",
                  background: "none", border: "none", padding: "2px 0",
                  textAlign: "left", cursor: active ? "default" : "pointer",
                  color: active ? ORANGE : "#888888",
                  borderBottom: active ? `1px solid ${ORANGE}` : "1px solid transparent",
                  maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                title={m.title || "Untitled"}
              >
                {m.title || "Untitled"}
              </button>
              {hovered && (
                <button
                  onClick={() => onDelete(m.id)}
                  title="Delete"
                  style={{
                    fontFamily: MONO, fontSize: 10, background: "none", border: "none",
                    padding: 0, cursor: "pointer", color: MUTED, lineHeight: 1, flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {mixtapes.length === 0 && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>None yet</span>
        )}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function MixtapeTab({ username }: { username: string }) {
  const [title,        setTitle]        = useState("");
  const [cassetteType, setCassetteType] = useState<"C60" | "C90" | "C120">("C60");
  const [activeSide,   setActiveSide]   = useState<"A" | "B">("A");
  const [sideA,        setSideA]        = useState<MixtapeTrack[]>([]);
  const [sideB,        setSideB]        = useState<MixtapeTrack[]>([]);

  const [savedMixtapes,    setSavedMixtapes]    = useState<MixtapeSummary[]>([]);
  const [currentMixtapeId, setCurrentMixtapeId] = useState<string | null>(null);
  const [saving,           setSaving]           = useState(false);

  const [query,            setQuery]            = useState("");
  const [albumResults,     setAlbumResults]     = useState<AlbumResult[]>([]);
  const [searching,        setSearching]        = useState(false);
  const [expandedAlbumId,  setExpandedAlbumId]  = useState<string | null>(null);
  // discogs_id → fetched tracklist (cached so we don't refetch on re-expand)
  const [discogsCache,     setDiscogsCache]     = useState<Map<string, DiscogsTrack[]>>(new Map());
  const [loadingDiscogs,   setLoadingDiscogs]   = useState<string | null>(null);
  const [showShare,        setShowShare]        = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved mixtapes list on mount
  useEffect(() => {
    fetch("/api/mixtape/list")
      .then(r => r.json())
      .then((d: { mixtapes: MixtapeSummary[] }) => setSavedMixtapes(d.mixtapes ?? []))
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/mixtape/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:            currentMixtapeId ?? undefined,
          title,
          cassette_type: cassetteType,
          side_a:        sideA,
          side_b:        sideB,
        }),
      });
      if (!res.ok) return;
      const { id } = await res.json() as { id: string };
      setCurrentMixtapeId(id);
      // Refresh list
      const listRes = await fetch("/api/mixtape/list");
      const listData = await listRes.json() as { mixtapes: MixtapeSummary[] };
      setSavedMixtapes(listData.mixtapes ?? []);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectMixtape(id: string) {
    if (id === currentMixtapeId) return;
    // Fetch full mixtape data from the list cache + a detail endpoint (re-use list for now)
    // We store full side_a/b in the list endpoint? No — we need a separate fetch.
    // Use save route: GET not supported, so fetch from a simple query via existing list data.
    // Actually we need a detail route — but we can piggyback: re-fetch with side_a/b included.
    const res = await fetch(`/api/mixtape/load?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const m = await res.json() as MixtapeFull;
    setCurrentMixtapeId(m.id);
    setTitle(m.title);
    setCassetteType(m.cassette_type as "C60" | "C90" | "C120");
    setSideA(m.side_a ?? []);
    setSideB(m.side_b ?? []);
    setQuery("");
    setAlbumResults([]);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/mixtape/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
    setSavedMixtapes(prev => prev.filter(m => m.id !== id));
    if (currentMixtapeId === id) handleNew();
  }

  function handleNew() {
    setCurrentMixtapeId(null);
    setTitle("");
    setCassetteType("C60");
    setActiveSide("A");
    setSideA([]);
    setSideB([]);
    setQuery("");
    setAlbumResults([]);
  }

  const limit = CASSETTE_LIMITS[cassetteType];
  const sideAMs = sideA.reduce((s, t) => s + t.duration_ms, 0);
  const sideBMs = sideB.reduce((s, t) => s + t.duration_ms, 0);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setAlbumResults([]); setExpandedAlbumId(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/mixtape/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json() as { albums: AlbumResult[] };
        setAlbumResults(data.albums ?? []);
        setExpandedAlbumId(null);
      } catch {
        setAlbumResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  async function toggleAlbum(result: AlbumResult) {
    if (expandedAlbumId === result.id) { setExpandedAlbumId(null); return; }
    setExpandedAlbumId(result.id);
    // If already stored in DB or already in session cache, nothing to do
    if (result.discogs_tracks?.length || !result.discogs_id) return;
    if (discogsCache.has(result.discogs_id)) return;
    // Fetch from Discogs and persist to DB for future loads
    setLoadingDiscogs(result.id);
    try {
      const res = await fetch("/api/mixtape/cache-tracklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discogs_id: result.discogs_id, record_id: result.id }),
      });
      if (res.ok) {
        const data = await res.json() as { tracks: DiscogsTrack[] };
        setDiscogsCache(prev => new Map(prev).set(result.discogs_id!, data.tracks ?? []));
      }
    } catch { /* best-effort */ }
    finally { setLoadingDiscogs(null); }
  }

  function addTrack(track: MixtapeTrack) {
    const usedMs = activeSide === "A" ? sideAMs : sideBMs;
    if (usedMs + track.duration_ms > limit + 60_000) return;
    const uniqueId = `${track.artist}||${track.title}||${track.album}||${Date.now()}`;
    if (activeSide === "A") setSideA(prev => [...prev, { ...track, id: uniqueId }]);
    else setSideB(prev => [...prev, { ...track, id: uniqueId }]);
  }

  function removeFromA(id: string) { setSideA(prev => prev.filter(t => t.id !== id)); }
  function removeFromB(id: string) { setSideB(prev => prev.filter(t => t.id !== id)); }

  function exportSoundiiz() {
    const rows = [
      "Track Title,Artist,Album",
      ...sideA.map(t => `"${t.title.replace(/"/g, '""')}","${t.artist.replace(/"/g, '""')}","${t.album.replace(/"/g, '""')}"`),
      ...sideB.map(t => `"${t.title.replace(/"/g, '""')}","${t.artist.replace(/"/g, '""')}","${t.album.replace(/"/g, '""')}"`),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${(title || "mixtape").replace(/\s+/g, "-").toLowerCase()}-soundiiz.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sideAFill = limit > 0 ? sideAMs / limit : 0;
  const sideBFill = limit > 0 ? sideBMs / limit : 0;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>

      {/* Admin badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.15em",
          textTransform: "uppercase", color: "#fff", background: "#0d0d0d",
          padding: "2px 7px", borderRadius: 3,
        }}>
          Admin Preview
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
          Mixtape — not yet live to members
        </span>
      </div>

      {/* Two-column layout: saved list left, editor right */}
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        <SavedList
          mixtapes={savedMixtapes}
          selectedId={currentMixtapeId}
          onSelect={handleSelectMixtape}
          onNew={handleNew}
          onDelete={handleDelete}
        />

        {/* Editor — flex: 1 */}
        <div style={{ flex: 1, minWidth: 0 }}>

      {/* Title + cassette type */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: 5 }}>
            Mixtape title
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Summer 2026 Mix"
            maxLength={40}
            style={{
              fontFamily: SERIF, fontSize: 15, width: "100%",
              padding: "8px 10px", border: `1px solid ${RULE}`,
              borderRadius: 4, outline: "none", background: "#fff",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: 5 }}>
            Tape length
          </label>
          <div style={{ display: "flex", gap: 1 }}>
            {(["C60", "C90", "C120"] as const).map(t => (
              <button
                key={t}
                onClick={() => setCassetteType(t)}
                style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em",
                  padding: "7px 12px",
                  background: cassetteType === t ? INK : "#fff",
                  color: cassetteType === t ? "#fff" : MUTED,
                  border: `1px solid ${cassetteType === t ? INK : RULE}`,
                  cursor: "pointer",
                  borderRadius: t === "C60" ? "4px 0 0 4px" : t === "C120" ? "0 4px 4px 0" : "0",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 3 }}>
            {formatTime(limit)} per side
          </div>
        </div>
      </div>

      {/* Cassette visual */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <CassetteSVG
          title={title || "My Mixtape"}
          sideAFill={sideAFill}
          sideBFill={sideBFill}
          activeSide={activeSide}
          width={Math.min(520, typeof window !== "undefined" ? window.innerWidth - 48 : 520)}
        />
      </div>

      {/* Side switcher */}
      <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 24 }}>
        {(["A", "B"] as const).map(side => (
          <button
            key={side}
            onClick={() => setActiveSide(side)}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em",
              textTransform: "uppercase", padding: "8px 32px",
              background: activeSide === side ? INK : "#fff",
              color: activeSide === side ? "#fff" : MUTED,
              border: `1px solid ${activeSide === side ? INK : RULE}`,
              borderRadius: side === "A" ? "4px 0 0 4px" : "0 4px 4px 0",
              cursor: "pointer",
            }}
          >
            Side {side} — {formatTime(side === "A" ? sideAMs : sideBMs)}
          </button>
        ))}
      </div>

      {/* Side panels — side by side on desktop */}
      <div style={{ display: "flex", gap: 32, marginBottom: 28 }}>
        <SidePanel
          side="A"
          tracks={sideA}
          limit={limit}
          onRemove={removeFromA}
        />
        <div style={{ width: 1, background: RULE, flexShrink: 0 }} />
        <SidePanel
          side="B"
          tracks={sideB}
          limit={limit}
          onRemove={removeFromB}
        />
      </div>

      {/* Track search */}
      <div style={{ borderTop: `1.5px solid ${INK}`, paddingTop: 20, marginBottom: 28 }}>
        <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: 8 }}>
          Search your collection — click an album to pick a track
        </label>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Artist or album…"
          style={{
            fontFamily: MONO, fontSize: 12, width: "100%",
            padding: "9px 12px", border: `1px solid ${RULE}`,
            borderRadius: 4, outline: "none", background: "#fff",
            boxSizing: "border-box", marginBottom: 8,
          }}
        />
        {searching && (
          <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>Searching…</p>
        )}
        {!searching && albumResults.length === 0 && query.trim().length >= 2 && (
          <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
            No records found. Try artist name or album title.
          </p>
        )}

        <div>
          {albumResults.map(result => {
            const isExpanded = expandedAlbumId === result.id;
            const isLoadingThis = loadingDiscogs === result.id;
            // Prefer DB-stored tracks; fall back to session cache from lazy fetch
            const tracks: DiscogsTrack[] | null =
              result.discogs_tracks?.length
                ? result.discogs_tracks
                : (result.discogs_id ? (discogsCache.get(result.discogs_id) ?? null) : null);
            const currentMs = activeSide === "A" ? sideAMs : sideBMs;

            return (
              <div key={result.id} style={{ borderBottom: `1px solid ${RULE}` }}>
                {/* Album row */}
                <div
                  onClick={() => toggleAlbum(result)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result.artist}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result.album}{result.year ? ` (${result.year})` : ""}
                    </div>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, flexShrink: 0 }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* Tracklist — shown when expanded */}
                {isExpanded && (
                  <div style={{ paddingLeft: 12, paddingBottom: 8 }}>
                    {isLoadingThis && (
                      <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED, padding: "6px 0" }}>Loading tracklist…</p>
                    )}
                    {!isLoadingThis && !tracks && (
                      <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED, padding: "6px 0" }}>
                        {result.discogs_id ? "Tracklist unavailable." : "No tracklist — record has no Discogs ID."}
                      </p>
                    )}
                    {!isLoadingThis && tracks && tracks.map((t, i) => {
                      const durationMs = parseDuration(t.duration);
                      const track: MixtapeTrack = {
                        id: `${result.id}||${t.position}||${t.title}`,
                        artist: result.artist, title: t.title, album: result.album,
                        year: result.year, cover_url: result.cover_url, duration_ms: durationMs,
                      };
                      const wouldExceed = durationMs > 0 && currentMs + durationMs > limit + 60_000;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px solid ${RULE}`, opacity: wouldExceed ? 0.35 : 1 }}>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, width: 24, flexShrink: 0 }}>{t.position}</span>
                          <div style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 12, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, flexShrink: 0 }}>{t.duration || "—"}</span>
                          <button
                            onClick={() => !wouldExceed && addTrack(track)}
                            disabled={wouldExceed}
                            style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", padding: "3px 8px", background: "none", border: `1px solid ${wouldExceed ? RULE : ORANGE}`, color: wouldExceed ? RULE : ORANGE, borderRadius: 3, cursor: wouldExceed ? "not-allowed" : "pointer", flexShrink: 0 }}
                          >
                            + {activeSide}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>
        <button
          onClick={handleSave}
          disabled={saving || (sideA.length === 0 && sideB.length === 0)}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", padding: "10px 20px",
            background: INK, color: "#fff", border: "none",
            borderRadius: 4, cursor: saving ? "wait" : "pointer",
            opacity: saving || (sideA.length === 0 && sideB.length === 0) ? 0.4 : 1,
          }}
        >
          {saving ? "Saving…" : currentMixtapeId ? "Save" : "Save Mixtape"}
        </button>
        <button
          onClick={() => setShowShare(true)}
          disabled={sideA.length === 0 && sideB.length === 0}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", padding: "10px 20px",
            background: ORANGE, color: "#fff", border: "none",
            borderRadius: 4, cursor: "pointer",
            opacity: sideA.length === 0 && sideB.length === 0 ? 0.4 : 1,
          }}
        >
          Share / Download
        </button>
        <button
          onClick={exportSoundiiz}
          disabled={sideA.length === 0 && sideB.length === 0}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", padding: "10px 20px",
            background: "#fff", color: INK, border: `1px solid ${RULE}`,
            borderRadius: 4, cursor: "pointer",
            opacity: sideA.length === 0 && sideB.length === 0 ? 0.4 : 1,
          }}
        >
          Export to Soundiiz
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
            Soundiiz CSV — import via soundiiz.com → Import → From file
          </span>
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <ShareModal
          title={title}
          sideA={sideA}
          sideB={sideB}
          username={username}
          cassetteType={cassetteType}
          onClose={() => setShowShare(false)}
        />
      )}

        </div> {/* end editor column */}
      </div> {/* end two-column layout */}
    </div>
  );
}
