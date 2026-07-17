"use client";

import { useState, useEffect, useRef, useCallback, useDeferredValue, useMemo } from "react";
import type { DigitalImport } from "@/app/digital/page";
import type { TrackItem } from "@/app/api/digital/album/route";

const SERIF  = "var(--font-shippori), Georgia, serif";
const MONO   = "var(--font-dm-mono), 'Courier New', monospace";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const SUBTLE = "#999999";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtSyncedAt(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffM = Math.floor(diffMs / 60_000);
  if (diffM < 2) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function getYear(imp: DigitalImport): number | null {
  if (!imp.release_date) return null;
  const y = parseInt(imp.release_date.match(/\d{4}/)?.[0] ?? "");
  return isNaN(y) ? null : y;
}

function stripArticle(s: string): string {
  return s.replace(/^(the|a|an)\s+/i, "");
}

function sortLetter(artist: string): string {
  const c = stripArticle(artist.trim() || "").toUpperCase().charAt(0);
  return /[A-Z]/.test(c) ? c : "#";
}

function groupByLetter(items: DigitalImport[]) {
  const groups: Array<{ letter: string; items: DigitalImport[] }> = [];
  for (const imp of items) {
    const letter = sortLetter(imp.artist || "");
    const last = groups[groups.length - 1];
    if (!last || last.letter !== letter) groups.push({ letter, items: [imp] });
    else last.items.push(imp);
  }
  const hashIdx = groups.findIndex((g) => g.letter === "#");
  if (hashIdx > 0) groups.push(...groups.splice(hashIdx, 1));
  return groups;
}

const DECADE_ORDER = ["Pre-1960", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;

function decadeLabel(year: number | null): string | null {
  if (!year) return null;
  if (year < 1960) return "Pre-1960";
  const d = Math.floor(year / 10) * 10;
  return d <= 2029 ? `${d}s` : null;
}

function matchesDecade(year: number | null, decade: string): boolean {
  if (!year) return false;
  if (decade === "Pre-1960") return year < 1960;
  const start = parseInt(decade);
  return year >= start && year < start + 10;
}

// ── Cover art hook ─────────────────────────────────────────────────────────

const coverCache = new Map<string, string | null>();

function useCoverArt(artist: string, album: string): string | null {
  const key = `${artist}::${album}`;
  const [url, setUrl] = useState<string | null>(coverCache.get(key) ?? null);

  useEffect(() => {
    if (!artist || !album) return;
    if (coverCache.has(key)) { setUrl(coverCache.get(key) ?? null); return; }
    let cancelled = false;
    fetch(`/api/deep-dive/album-art?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`)
      .then(r => r.json() as Promise<{ url: string | null }>)
      .then(({ url: u }) => {
        coverCache.set(key, u);
        if (!cancelled) setUrl(u);
      })
      .catch(() => { coverCache.set(key, null); });
    return () => { cancelled = true; };
  }, [key, artist, album]);

  return url;
}

// ── Credential form ────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
  textTransform: "uppercase", color: "#999999", display: "block", marginBottom: "8px",
};

const inputSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "13px", color: "#0d0d0d", background: "white",
  display: "block", width: "100%", padding: "12px 14px",
  border: "1px solid #dddddd", outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

function CredentialForm({ onSaved }: { onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!username.trim() || !password.trim()) { setError("Both fields are required"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/digital/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const body = await res.json() as { error?: string };
      if (res.ok) {
        setSaved(true);
        await fetch("/api/digital/subsonic-sync", { method: "POST" });
        onSaved();
      } else {
        setError(body.error ?? `Server error ${res.status}`);
      }
    } catch (err) {
      setError(`Network error — ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <h1 className="text-4xl mb-2 leading-tight" style={{ fontFamily: SERIF, color: INK }}>
          Connect Bandcamp
        </h1>
        <p className="mb-10" style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}>
          Find credentials at bandcamp.com → Settings → Fan tab → Subsonic.
        </p>

        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="bc-username" style={labelSt}>Bandcamp username</label>
          <input
            id="bc-username" type="text" autoComplete="username"
            value={username} onChange={e => setUsername(e.target.value)}
            style={inputSt}
            onFocus={e => { e.currentTarget.style.borderColor = ORANGE; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#dddddd"; }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="bc-password" style={labelSt}>Subsonic password</label>
          <input
            id="bc-password" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            style={inputSt}
            onFocus={e => { e.currentTarget.style.borderColor = ORANGE; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#dddddd"; }}
          />
        </div>

        {error && (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc2200", letterSpacing: "0.04em", marginBottom: "1rem" }}>
            {error}
          </p>
        )}

        {saved ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#4caf50", letterSpacing: "0.06em" }}>
            Connected — importing your collection…
          </p>
        ) : (
          <button
            onClick={handleSave} disabled={saving}
            style={{
              width: "100%", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.12em",
              textTransform: "uppercase", background: saving ? "#555" : INK, color: "#fff",
              border: "none", padding: "15px 0", cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.5 : 1, transition: "background 0.2s",
            }}
            onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
            onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = INK; }}
          >
            {saving ? "Saving…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── FilterTag chip ─────────────────────────────────────────────────────────

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
      color: ORANGE, background: "rgba(204,85,0,0.07)", padding: "2px 5px 2px 6px",
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 1, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: "0 1px" }}
      >×</button>
    </span>
  );
}

// ── Album row (Col 1) ──────────────────────────────────────────────────────

function AlbumRow({ imp, selected, onClick }: {
  imp: DigitalImport;
  selected: boolean;
  onClick: () => void;
}) {
  const coverUrl = useCoverArt(imp.artist, imp.album);
  const year = getYear(imp);
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        width: "100%", padding: "8px 14px", minHeight: "44px",
        background: selected ? "rgba(204,85,0,0.04)" : "transparent",
        border: "none",
        borderLeft: `2px solid ${selected ? ORANGE : "transparent"}`,
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        cursor: "pointer", textAlign: "left", transition: "background 0.1s",
      }}
    >
      <div style={{ width: 36, height: 36, background: "#f0f0f0", flexShrink: 0, overflow: "hidden" }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: "14px", color: "#e0e0e0" }}>ō</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "13px", color: selected ? INK : "#1a1a1a", lineHeight: 1.2, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {imp.album}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: SUBTLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {imp.artist}
          {year ? <span style={{ color: "#d0d0d0" }}> · {year}</span> : null}
        </p>
      </div>
    </button>
  );
}

// ── Album detail (Col 2) ───────────────────────────────────────────────────

function AlbumDetail({ imp }: { imp: DigitalImport }) {
  const coverUrl = useCoverArt(imp.artist, imp.album);
  const year = getYear(imp);
  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ background: "#f0ede6", aspectRatio: "1 / 1", width: "100%" }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: "48px", color: "#c8c4bb" }}>ō</span>
          </div>
        )}
      </div>
      <div style={{ padding: "20px 24px" }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, marginBottom: "6px" }}>
          {imp.artist}
        </p>
        <h2 style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 400, color: INK, marginBottom: "12px", lineHeight: 1.2 }}>
          {imp.album}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          {year && (
            <span style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE }}>{year}</span>
          )}
          {imp.label && (
            <span style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE }}>· {imp.label}</span>
          )}
          {(imp.tags ?? []).map(tag => (
            <span key={tag} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: SUBTLE, background: "#f0ede6", padding: "2px 6px" }}>
              {tag}
            </span>
          ))}
        </div>
        {imp.item_url && (
          <a
            href={imp.item_url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: ORANGE, textDecoration: "none" }}
          >
            Open on Bandcamp ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Tracklist panel (Col 3) ────────────────────────────────────────────────

function TracklistPanel({ imp, connected, playingId, onPlay }: {
  imp: DigitalImport;
  connected: boolean;
  playingId: string | null;
  onPlay: (trackId: string, src: string) => void;
}) {
  const [tracks, setTracks] = useState<TrackItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loadedFor.current === imp.id) return;
    loadedFor.current = imp.id;
    setTracks(null);
    if (!imp.subsonic_id || !connected) return;
    setLoading(true);
    fetch(`/api/digital/album?id=${encodeURIComponent(imp.subsonic_id)}`)
      .then(r => r.ok ? r.json() : { tracks: [] })
      .then((d: { tracks?: TrackItem[] }) => setTracks(d.tracks ?? []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [imp.id, imp.subsonic_id, connected]);

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      {loading && (
        <div style={{ padding: "20px 16px" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE }}>Loading…</p>
        </div>
      )}
      {!loading && !connected && (
        <div style={{ padding: "20px 16px" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE, letterSpacing: "0.04em" }}>
            Connect Bandcamp Subsonic to play tracks
          </p>
        </div>
      )}
      {!loading && connected && !imp.subsonic_id && (
        <div style={{ padding: "20px 16px" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE, letterSpacing: "0.04em" }}>
            Tracklist available after sync
          </p>
        </div>
      )}
      {!loading && tracks && tracks.length === 0 && imp.subsonic_id && (
        <div style={{ padding: "20px 16px" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE }}>No tracks found</p>
        </div>
      )}
      {!loading && tracks && tracks.length > 0 && (
        <div>
          {[...tracks].sort((a, b) => a.n - b.n).map(t => {
            const trackId = `${imp.subsonic_id}::${t.id}`;
            const isPlaying = playingId === trackId;
            return (
              <div
                key={t.id || t.n}
                onClick={() => onPlay(trackId, `/api/digital/stream?id=${encodeURIComponent(t.id)}`)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "9px 16px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  background: isPlaying ? "#fff8f4" : "transparent",
                }}
                onMouseEnter={e => { if (!isPlaying) (e.currentTarget as HTMLElement).style.background = "#f7f5f0"; }}
                onMouseLeave={e => { if (!isPlaying) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontFamily: MONO, fontSize: "9px", color: isPlaying ? ORANGE : SUBTLE, minWidth: "20px", textAlign: "right", flexShrink: 0 }}>
                  {isPlaying ? "▶" : String(t.n).padStart(2, "0")}
                </span>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: isPlaying ? ORANGE : INK, flex: 1, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </span>
                {t.dur > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, flexShrink: 0 }}>{fmtDuration(t.dur)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Player bar ─────────────────────────────────────────────────────────────

function PlayerBar({ src, onClose }: { src: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.src = src;
    el.play().catch(() => {});
    setPlaying(true);
    const onTime = () => setProgress(el.currentTime);
    const onDur  = () => setDuration(el.duration);
    const onEnd  = () => { setPlaying(false); setProgress(0); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("ended", onEnd);
      el.pause();
    };
  }, [src]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play().catch(() => {}); setPlaying(true); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: INK, borderTop: `2px solid ${ORANGE}`,
      display: "flex", alignItems: "center", gap: "16px", padding: "10px 24px",
    }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} />
      <button onClick={togglePlay} style={{ background: "none", border: "none", cursor: "pointer", color: ORANGE, fontFamily: MONO, fontSize: "14px", lineHeight: 1 }} aria-label={playing ? "Pause" : "Play"}>
        {playing ? "⏸" : "▶"}
      </button>
      <div onClick={seek} style={{ flex: 1, height: "3px", background: "#444", cursor: "pointer", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: duration ? `${(progress / duration) * 100}%` : "0%", background: ORANGE }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", whiteSpace: "nowrap" }}>
        {fmtDuration(Math.floor(progress))} {duration ? `/ ${fmtDuration(Math.floor(duration))}` : ""}
      </span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontFamily: MONO, fontSize: "12px", lineHeight: 1 }} aria-label="Close player">✕</button>
    </div>
  );
}

// ── Select style shared ────────────────────────────────────────────────────

function selectSt(active: boolean): React.CSSProperties {
  return {
    flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
    color: active ? ORANGE : "#888888",
    background: "#ffffff",
    border: `1px solid ${active ? ORANGE : "rgba(0,0,0,0.13)"}`,
    cursor: "pointer", padding: "4px 6px", outline: "none",
    transition: "border-color 0.15s, color 0.15s",
  };
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  imports: DigitalImport[];
  connected: boolean;
  syncedAt: string | null;
  subsonicUsername: string | null;
  dbError: string | null;
};

const YEAR_SORTS = ["year-new-old", "year-old-new", "date-added-new-old", "date-added-old-new"];
const NAME_SORT_OPTIONS = [
  { value: "artist-az", label: "Artist A–Z" },
  { value: "artist-za", label: "Artist Z–A" },
];

export default function DigitalClient({ imports, connected, syncedAt, dbError }: Props) {
  const [query, setQuery]             = useState("");
  const [filterYear, setFilterYear]   = useState("");
  const [filterTag, setFilterTag]     = useState("");
  const [sortBy, setSortBy]           = useState("artist-az");
  const [syncing, setSyncing]         = useState(false);
  const [syncMsg, setSyncMsg]         = useState<string | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [playingId, setPlayingId]     = useState<string | null>(null);
  const [playingSrc, setPlayingSrc]   = useState<string | null>(null);

  const deferredQuery    = useDeferredValue(query);
  const deferredYear     = useDeferredValue(filterYear);
  const deferredTag      = useDeferredValue(filterTag);
  const deferredSortBy   = useDeferredValue(sortBy);

  const handlePlay = useCallback((trackId: string, src: string) => {
    if (playingId === trackId) { setPlayingId(null); setPlayingSrc(null); return; }
    setPlayingId(trackId);
    setPlayingSrc(src);
  }, [playingId]);

  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    const res = await fetch("/api/digital/subsonic-sync", { method: "POST" });
    const d = await res.json() as { synced?: number; error?: string; message?: string };
    if (res.ok) {
      setSyncMsg(`Synced ${d.synced ?? 0} albums`);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setSyncMsg(d.error ?? d.message ?? "Sync failed");
    }
    setSyncing(false);
  }

  async function handleDisconnect() {
    await fetch("/api/digital/credentials", { method: "DELETE" });
    window.location.reload();
  }

  // Derived filter data
  const allTags = useMemo(() => {
    const ts = new Set<string>();
    for (const imp of imports) for (const t of imp.tags ?? []) ts.add(t);
    return [...ts].sort();
  }, [imports]);

  const decades = useMemo(() => {
    const ds = new Set<string>();
    for (const imp of imports) {
      const lbl = decadeLabel(getYear(imp));
      if (lbl) ds.add(lbl);
    }
    return DECADE_ORDER.filter(d => ds.has(d));
  }, [imports]);

  const filteredImports = useMemo(() => {
    return imports.filter(imp => {
      if (deferredQuery) {
        const q = deferredQuery.toLowerCase();
        if (!imp.artist.toLowerCase().includes(q) && !imp.album.toLowerCase().includes(q)) return false;
      }
      if (deferredYear && !matchesDecade(getYear(imp), deferredYear)) return false;
      if (deferredTag && !(imp.tags ?? []).includes(deferredTag)) return false;
      return true;
    });
  }, [imports, deferredQuery, deferredYear, deferredTag]);

  const sortedImports = useMemo(() => {
    const arr = [...filteredImports];
    switch (deferredSortBy) {
      case "artist-az":
        return arr.sort((a, b) => stripArticle(a.artist).toLowerCase().localeCompare(stripArticle(b.artist).toLowerCase(), "en"));
      case "artist-za":
        return arr.sort((a, b) => stripArticle(b.artist).toLowerCase().localeCompare(stripArticle(a.artist).toLowerCase(), "en"));
      case "album-az":
        return arr.sort((a, b) => a.album.toLowerCase().localeCompare(b.album.toLowerCase(), "en"));
      case "album-za":
        return arr.sort((a, b) => b.album.toLowerCase().localeCompare(a.album.toLowerCase(), "en"));
      case "year-new-old":
        return arr.sort((a, b) => (getYear(b) ?? 0) - (getYear(a) ?? 0));
      case "year-old-new":
        return arr.sort((a, b) => (getYear(a) ?? 9999) - (getYear(b) ?? 9999));
      case "date-added-new-old":
        return arr.sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));
      case "date-added-old-new":
        return arr.sort((a, b) => (a.purchased_at ?? "").localeCompare(b.purchased_at ?? ""));
      default:
        return arr;
    }
  }, [filteredImports, deferredSortBy]);

  const useGrouped = deferredSortBy === "artist-az" || deferredSortBy === "artist-za";
  const groups = useMemo(() => useGrouped ? groupByLetter(sortedImports) : [], [sortedImports, useGrouped]);

  const hasFilters = !!query.trim() || !!filterYear || !!filterTag;

  function clearAllFilters() {
    setQuery(""); setFilterYear(""); setFilterTag("");
  }

  const selected = imports.find(i => i.id === selectedId) ?? null;

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {dbError && (
        <div style={{ maxWidth: 480, margin: "3rem auto", padding: "1rem 1.5rem", border: "1px solid #ffcccc", background: "#fff8f8" }}>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc2200", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
            Database error — the migration may not have been applied yet.
          </p>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: "#999" }}>{dbError}</p>
        </div>
      )}

      {!connected ? (
        <CredentialForm onSaved={() => { window.location.reload(); }} />
      ) : (
        <div className="flex flex-col md:grid" style={{ flex: 1, overflow: "hidden", gridTemplateColumns: "340px 1fr 380px" }}>
          <style>{`
            @media (min-width: 768px) {
              .dg-col2 { display: flex; flex-direction: column; flex: 1; overflow: hidden; border-right: 1px solid rgba(0,0,0,0.08); }
              .dg-col3 { display: block; overflow-y: auto; }
            }
          `}</style>

          {/* ── Col 1: search + filters + list ── */}
          <div className={`${mobileDetailOpen ? "hidden" : "flex"} flex-col md:flex`} style={{ flex: 1, borderRight: "1px solid rgba(0,0,0,0.08)", minWidth: 0, overflow: "hidden" }}>
            <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>

              {/* Sync row */}
              <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  onClick={handleSync} disabled={syncing}
                  style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: syncing ? "#aaaaaa" : ORANGE, background: "none", border: "none", cursor: syncing ? "default" : "pointer", padding: 0 }}
                >
                  {syncing ? "Syncing…" : "Sync with Bandcamp →"}
                </button>
                <button
                  onClick={() => setShowDisconnect(d => !d)}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showDisconnect ? "Cancel" : "Disconnect"}
                </button>
              </div>

              {showDisconnect && (
                <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, flex: 1 }}>Remove Bandcamp connection?</span>
                  <button
                    onClick={handleDisconnect}
                    style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "#b00", color: "#fff", border: "none", padding: "4px 10px", cursor: "pointer" }}
                  >
                    Confirm
                  </button>
                </div>
              )}

              {(syncMsg || syncedAt) && (
                <div style={{ padding: "0 14px 6px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: syncMsg ? (syncMsg.startsWith("Sync") ? "#4caf50" : "#cc2200") : "#bbbbbb" }}>
                    {syncMsg ?? `Last sync: ${fmtSyncedAt(syncedAt)}`}
                  </span>
                </div>
              )}

              {/* Search */}
              <div style={{ padding: "2px 10px 6px" }}>
                <input
                  type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search artist or album…"
                  style={{
                    width: "100%", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.02em",
                    color: INK, background: "#f8f8f8", border: "none",
                    borderBottom: `1px solid ${query ? ORANGE : "rgba(0,0,0,0.1)"}`,
                    outline: "none", padding: "6px 8px", boxSizing: "border-box", transition: "border-color 0.15s",
                  }}
                />
              </div>

              {/* Filter dropdowns */}
              <div style={{ padding: "0 10px 4px", display: "flex", gap: "6px" }}>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selectSt(!!filterYear)}>
                  <option value="">Year</option>
                  {decades.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {allTags.length > 0 && (
                  <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={selectSt(!!filterTag)}>
                    <option value="">Tag</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>

              {/* Sort */}
              <div style={{ padding: "0 10px 6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", flexShrink: 0 }}>Sort</span>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {NAME_SORT_OPTIONS.map(o => {
                      const on = sortBy === o.value;
                      return (
                        <button
                          key={o.value} onClick={() => setSortBy(o.value)}
                          style={{
                            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase",
                            color: on ? "#ffffff" : "#888888",
                            background: on ? INK : "none",
                            border: `1px solid ${on ? INK : "rgba(0,0,0,0.13)"}`,
                            borderRadius: "3px", cursor: "pointer", padding: "3px 8px",
                            whiteSpace: "nowrap", transition: "all 0.15s",
                          }}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <select
                  value={YEAR_SORTS.includes(sortBy) ? sortBy : ""}
                  onChange={e => { if (e.target.value) setSortBy(e.target.value); }}
                  style={{
                    width: "100%", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                    color: YEAR_SORTS.includes(sortBy) ? ORANGE : "#888888",
                    background: "#ffffff",
                    border: `1px solid ${YEAR_SORTS.includes(sortBy) ? ORANGE : "rgba(0,0,0,0.13)"}`,
                    cursor: "pointer", padding: "4px 6px", outline: "none", transition: "border-color 0.15s, color 0.15s",
                  }}
                >
                  <option value="">Album / Year / Date Added…</option>
                  <option value="album-az">Album: A–Z</option>
                  <option value="album-za">Album: Z–A</option>
                  <option value="year-new-old">Year: Newest First</option>
                  <option value="year-old-new">Year: Oldest First</option>
                  <option value="date-added-new-old">Date Added: Newest First</option>
                  <option value="date-added-old-new">Date Added: Oldest First</option>
                </select>
              </div>

              {/* Active filter chips */}
              {hasFilters && (
                <div style={{ padding: "0 10px 4px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {filterYear && <FilterTag label={`Year: ${filterYear}`} onRemove={() => setFilterYear("")} />}
                  {filterTag  && <FilterTag label={`Tag: ${filterTag}`}  onRemove={() => setFilterTag("")} />}
                </div>
              )}

              {/* Count + clear */}
              {hasFilters && (
                <div style={{ padding: "0 10px 7px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: "#aaaaaa" }}>
                    {sortedImports.length} of {imports.length} albums
                  </span>
                  <button onClick={clearAllFilters} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable album list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {imports.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", letterSpacing: "0.06em" }}>
                    Hit <strong>Sync with Bandcamp →</strong> to import your collection.
                  </p>
                </div>
              ) : sortedImports.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", letterSpacing: "0.06em" }}>No albums found</p>
                </div>
              ) : useGrouped ? groups.map(group => (
                <div key={group.letter}>
                  <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#ffffff", padding: "5px 14px 3px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE }}>
                    {group.letter}
                  </div>
                  {group.items.map(imp => (
                    <AlbumRow key={imp.id} imp={imp} selected={selectedId === imp.id} onClick={() => { setSelectedId(imp.id); setMobileDetailOpen(true); }} />
                  ))}
                </div>
              )) : sortedImports.map(imp => (
                <AlbumRow key={imp.id} imp={imp} selected={selectedId === imp.id} onClick={() => { setSelectedId(imp.id); setMobileDetailOpen(true); }} />
              ))}
            </div>
          </div>

          {/* ── Cols 2 + 3 ── */}
          {selected ? (
            <div className={`${mobileDetailOpen ? "flex" : "hidden"} flex-col md:contents`} style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
              {/* Col 2 — Album detail */}
              <div className="dg-col2" style={{ flexShrink: 0, minWidth: 0 }}>
                <button
                  className="md:hidden"
                  onClick={() => setMobileDetailOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "14px 16px", background: "none", border: "none",
                    borderBottom: "0.5px solid #e8e8e8", cursor: "pointer",
                    fontFamily: MONO, fontSize: "12px", letterSpacing: "0.08em",
                    textTransform: "uppercase", color: ORANGE, width: "100%", textAlign: "left",
                  }}
                >
                  ← Digital
                </button>
                <AlbumDetail imp={selected} />
              </div>

              {/* Col 3 — Tracklist */}
              <div className="dg-col3" style={{ flexShrink: 0, minWidth: 0 }}>
                <TracklistPanel
                  imp={selected}
                  connected={connected}
                  playingId={playingId}
                  onPlay={handlePlay}
                />
              </div>
            </div>
          ) : (
            <div className="hidden md:flex" style={{ gridColumn: "2 / 4", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <p style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8" }}>Select an album</p>
              <p style={{ fontFamily: MONO, fontSize: "10px", color: "#e4e4e4", letterSpacing: "0.08em" }}>
                {imports.length} {imports.length === 1 ? "album" : "albums"} in your collection
              </p>
            </div>
          )}
        </div>
      )}

      {playingSrc && (
        <PlayerBar src={playingSrc} onClose={() => { setPlayingId(null); setPlayingSrc(null); }} />
      )}
    </div>
  );
}
