"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DigitalImport } from "@/app/digital/page";
import type { TrackItem } from "@/app/api/digital/album/route";

const SERIF  = "var(--font-shippori), Georgia, serif";
const MONO   = "var(--font-dm-mono), 'Courier New', monospace";
const JP     = "var(--font-noto-sans-jp), sans-serif";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const SUBTLE = "#999999";
const WARM   = "#FDFCF8";

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

function fmtYear(imp: DigitalImport): string | null {
  if (!imp.release_date) return null;
  const y = imp.release_date.match(/\d{4}/)?.[0];
  return y ?? null;
}

// ── Cover art hook ─────────────────────────────────────────────────────────

const coverCache = new Map<string, string | null>();

function useCoverArt(artist: string, album: string): string | null {
  const key = `${artist}::${album}`;
  const [url, setUrl] = useState<string | null>(coverCache.get(key) ?? null);

  useEffect(() => {
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

function CredentialForm({ onSaved }: { onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave() {
    if (!username.trim() || !password.trim()) { setError("Both fields are required"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/digital/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json() as { error?: string };
        setError(d.error ?? `Save failed (${res.status})`);
      }
    } catch (err) {
      setError(`Network error — ${(err as Error).message ?? "please try again"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h2 style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: ORANGE, marginBottom: "0.5rem" }}>
        Connect Bandcamp
      </h2>
      <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: SUBTLE, marginBottom: "2rem", lineHeight: 1.7 }}>
        Enter your Bandcamp Subsonic credentials. Find them in{" "}
        <strong>bandcamp.com → Settings → Fan tab → Subsonic section</strong>.
        Credentials are encrypted with AES-256 and never exposed to the browser.
      </p>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE, marginBottom: "4px" }}>
          Bandcamp username
        </div>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", fontFamily: MONO, fontSize: "13px", padding: "10px 12px", border: `1px solid ${RULE}`, background: "#fff", color: INK, outline: "none" }}
        />
      </label>

      <label style={{ display: "block", marginBottom: "1.5rem" }}>
        <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE, marginBottom: "4px" }}>
          Subsonic password
        </div>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          style={{ width: "100%", boxSizing: "border-box", fontFamily: MONO, fontSize: "13px", padding: "10px 12px", border: `1px solid ${RULE}`, background: "#fff", color: INK, outline: "none" }}
        />
      </label>

      {error && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#b00", marginBottom: "1rem" }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", background: ORANGE, color: "#fff", border: "none", padding: "12px 28px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving…" : "Save credentials"}
      </button>
    </div>
  );
}

// ── Album card ─────────────────────────────────────────────────────────────

function AlbumCard({
  imp,
  connected,
  playingId,
  onPlay,
}: {
  imp: DigitalImport;
  connected: boolean;
  playingId: string | null;
  onPlay: (trackId: string, src: string) => void;
}) {
  const coverUrl = useCoverArt(imp.artist, imp.album);
  const [expanded, setExpanded] = useState(false);
  const [tracks, setTracks]     = useState<TrackItem[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const year = fmtYear(imp);

  async function handleExpand() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (tracks || !imp.subsonic_id || !connected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/digital/album?id=${encodeURIComponent(imp.subsonic_id)}`);
      if (res.ok) {
        const d = await res.json() as { tracks?: TrackItem[] };
        setTracks(d.tracks ?? []);
      }
    } finally { setLoading(false); }
  }

  const hasTracklist = connected && !!imp.subsonic_id;

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${RULE}`,
        cursor: hasTracklist ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => hasTracklist && ((e.currentTarget as HTMLElement).style.borderColor = ORANGE)}
      onMouseLeave={e => hasTracklist && ((e.currentTarget as HTMLElement).style.borderColor = RULE)}
      onClick={hasTracklist ? handleExpand : undefined}
    >
      {/* Cover art */}
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: "#f0ede6", overflow: "hidden" }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: "28px", color: "#c8c4bb" }}>ō</span>
          </div>
        )}
        {hasTracklist && (
          <div style={{
            position: "absolute", top: "6px", right: "6px",
            background: expanded ? ORANGE : "rgba(0,0,0,0.5)",
            color: "#fff", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
            padding: "3px 6px",
          }}>
            {expanded ? "▲" : "▼"}
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: "10px 10px 12px" }}>
        <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, marginBottom: "3px" }}>
          {imp.artist}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: "13px", fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: "4px" }}>
          {imp.album}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {year && <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>{year}</span>}
          {(imp.tags ?? []).slice(0, 2).map(tag => (
            <span key={tag} style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.06em", textTransform: "uppercase", color: SUBTLE, background: "#f0ede6", padding: "1px 5px" }}>
              {tag}
            </span>
          ))}
        </div>
        {imp.source === "bandcamp" && imp.item_url && (
          <a
            href={imp.item_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: "inline-block", marginTop: "6px", fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}
          >
            Bandcamp ↗
          </a>
        )}
      </div>

      {/* Tracklist */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${RULE}` }} onClick={e => e.stopPropagation()}>
          {loading && (
            <div style={{ padding: "12px 12px", fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.08em" }}>
              Loading tracklist…
            </div>
          )}
          {!loading && tracks && tracks.length === 0 && (
            <div style={{ padding: "12px 12px", fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>
              No tracks found
            </div>
          )}
          {!loading && tracks && tracks.length > 0 && (
            <div>
              {tracks.sort((a, b) => a.n - b.n).map(t => {
                const trackId = `${imp.subsonic_id}::${t.id}`;
                const isPlaying = playingId === trackId;
                return (
                  <div
                    key={t.id || t.n}
                    onClick={() => onPlay(trackId, `/api/digital/stream?id=${encodeURIComponent(t.id)}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 12px",
                      borderBottom: `0.5px solid ${RULE}`,
                      cursor: "pointer",
                      background: isPlaying ? "#fff8f4" : "transparent",
                    }}
                    onMouseEnter={e => { if (!isPlaying) (e.currentTarget as HTMLElement).style.background = "#f7f5f0"; }}
                    onMouseLeave={e => { if (!isPlaying) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: "9px", color: isPlaying ? ORANGE : SUBTLE, minWidth: "20px", textAlign: "right" }}>
                      {isPlaying ? "▶" : String(t.n).padStart(2, "0")}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "10px", color: isPlaying ? ORANGE : INK, flex: 1, letterSpacing: "0.02em" }}>
                      {t.title}
                    </span>
                    {t.dur > 0 && (
                      <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>{fmtDuration(t.dur)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!loading && !tracks && !imp.subsonic_id && (
            <div style={{ padding: "12px 12px", fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.06em" }}>
              Tracklist available after Subsonic sync
            </div>
          )}
          {imp.item_url && imp.source !== "bandcamp" && (
            <a
              href={imp.item_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", padding: "10px 12px", fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, textDecoration: "none", borderTop: tracks?.length ? `1px solid ${RULE}` : "none" }}
            >
              Open on Bandcamp ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Audio player bar ───────────────────────────────────────────────────────

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

      <button
        onClick={togglePlay}
        style={{ background: "none", border: "none", cursor: "pointer", color: ORANGE, fontFamily: MONO, fontSize: "14px", lineHeight: 1 }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* Progress bar */}
      <div
        onClick={seek}
        style={{ flex: 1, height: "3px", background: "#444", cursor: "pointer", position: "relative" }}
      >
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: duration ? `${(progress / duration) * 100}%` : "0%",
          background: ORANGE,
        }} />
      </div>

      <span style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", whiteSpace: "nowrap" }}>
        {fmtDuration(Math.floor(progress))} {duration ? `/ ${fmtDuration(Math.floor(duration))}` : ""}
      </span>

      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontFamily: MONO, fontSize: "12px", lineHeight: 1 }}
        aria-label="Close player"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  imports: DigitalImport[];
  connected: boolean;
  syncedAt: string | null;
  subsonicUsername: string | null;
};

export default function DigitalClient({ imports, connected, syncedAt, subsonicUsername }: Props) {
  const router = useRouter();

  const [query, setQuery]       = useState("");
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState<string | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);

  // Global audio player state
  const [playingId, setPlayingId]   = useState<string | null>(null);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);

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
      router.refresh();
    } else {
      setSyncMsg(d.error ?? d.message ?? "Sync failed");
    }
    setSyncing(false);
  }

  async function handleDisconnect() {
    await fetch("/api/digital/credentials", { method: "DELETE" });
    window.location.reload();
  }

  const filtered = imports.filter(imp => {
    if (!query) return true;
    const q = query.toLowerCase();
    return imp.artist.toLowerCase().includes(q) || imp.album.toLowerCase().includes(q);
  });

  return (
    <div style={{ paddingBottom: playingSrc ? "64px" : 0 }}>
      {/* Not connected → show credential form */}
      {!connected ? (
        <CredentialForm onSaved={() => { window.location.reload(); }} />
      ) : (
        <div style={{ background: "#ffffff", maxWidth: 1400, margin: "0 auto", padding: "1.5rem 2rem" }}>
          {/* Controls bar: search + sync + disconnect */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {imports.length > 0 && (
              <input
                type="search"
                placeholder="Search artist or album…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ fontFamily: MONO, fontSize: "12px", padding: "9px 14px", border: `1px solid ${RULE}`, background: "#fff", color: INK, width: "100%", maxWidth: 280, outline: "none", boxSizing: "border-box" }}
              />
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: ORANGE, color: "#fff", border: "none", padding: "9px 16px", cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.6 : 1, flexShrink: 0 }}
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            {syncMsg && (
              <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>{syncMsg}</span>
            )}
            {syncedAt && !syncMsg && (
              <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.04em" }}>
                Synced {fmtSyncedAt(syncedAt)}
              </span>
            )}
            <button
              onClick={() => setShowDisconnect(d => !d)}
              style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "none", color: SUBTLE, cursor: "pointer", padding: 0, marginLeft: "auto" }}
            >
              {showDisconnect ? "Cancel" : "Disconnect"}
            </button>
            {showDisconnect && (
              <button
                onClick={handleDisconnect}
                style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "#b00", color: "#fff", border: "none", padding: "5px 12px", cursor: "pointer", flexShrink: 0 }}
              >
                Confirm disconnect
              </button>
            )}
          </div>

          {/* Empty state */}
          {imports.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <p style={{ fontFamily: MONO, fontSize: "11px", color: SUBTLE, marginBottom: "0.5rem" }}>
                No albums yet — hit <strong>Sync now</strong> above to import your Bandcamp collection.
              </p>
              {syncMsg && <p style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE, marginTop: "1rem" }}>{syncMsg}</p>}
            </div>
          )}

          {imports.length > 0 && filtered.length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: "11px", color: SUBTLE, padding: "2rem 0" }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Grid */}
          {filtered.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "1px",
              background: RULE,
              border: `1px solid ${RULE}`,
            }}>
              {filtered.map(imp => (
                <AlbumCard
                  key={imp.id}
                  imp={imp}
                  connected={connected}
                  playingId={playingId}
                  onPlay={handlePlay}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global player bar */}
      {playingSrc && (
        <PlayerBar
          src={playingSrc}
          onClose={() => { setPlayingId(null); setPlayingSrc(null); }}
        />
      )}
    </div>
  );
}
