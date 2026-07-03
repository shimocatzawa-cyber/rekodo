"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AppNav from "@/components/AppNav";
import RecordSpinner from "@/components/RecordSpinner";
import { isAppleMusicUrl, openAppleMusicLink } from "@/lib/openAppleMusic";
import { useSpotifyPlayback } from "@/components/SpotifyPlayerProvider";
import { createClient } from "@/lib/supabase/client";
import { useUrlTab } from "@/lib/useUrlTab";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

type Recommendation = {
  artist: string;
  album:  string;
  year:   number | null;
  reason: string;
  bandcamp_search_url:    string;
  spotify_search_url:     string;
  apple_music_search_url: string;
  // "Inside Collection" metadata fields (explore mode only)
  label?:     string | null;
  format?:    string | null;
  country?:   string | null;
  genre?:     string | null;
  styles?:    string[] | null;
  producers?: string[] | null;
};

interface Props {
  userId:               string;
  username:             string;
  displayLabel?:        string;
  avatarUrl?:           string | null;
  collectionCount:      number;
  listsCount:           number;
  availableStyles:      string[];
  hasQuizProfile?:      boolean;
  initialExplorePicks?: Recommendation[];
}

// ─── Vinyl disc SVG ───────────────────────────────────────────────────────────

function MetaRowDig({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", width: "84px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: "11px", color: "#505050", letterSpacing: "0.02em", lineHeight: 1.4 }}>
        {value}
      </span>
    </div>
  );
}

function VinylDisc() {
  return (
    <svg
      viewBox="0 0 420 420"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect width="420" height="420" fill="#0e0e0e" />
      <circle cx="210" cy="210" r="196" fill="#111111" />
      <circle cx="210" cy="210" r="183" fill="none" stroke="#1c1c1c" strokeWidth="1.2" />
      <circle cx="210" cy="210" r="170" fill="none" stroke="#1b1b1b" strokeWidth="1.2" />
      <circle cx="210" cy="210" r="157" fill="none" stroke="#1b1b1b" strokeWidth="1" />
      <circle cx="210" cy="210" r="144" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <circle cx="210" cy="210" r="131" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <circle cx="210" cy="210" r="118" fill="none" stroke="#191919" strokeWidth="1" />
      <circle cx="210" cy="210" r="105" fill="none" stroke="#191919" strokeWidth="0.8" />
      <circle cx="210" cy="210" r="92"  fill="none" stroke="#181818" strokeWidth="0.8" />
      {/* Label area */}
      <circle cx="210" cy="210" r="52"  fill="#1a1a1a" />
      <circle cx="210" cy="210" r="38"  fill="none" stroke="#222222" strokeWidth="0.6" />
      {/* Spindle */}
      <circle cx="210" cy="210" r="6"   fill="#080808" />
    </svg>
  );
}

// ─── Position indicator ───────────────────────────────────────────────────────

function PositionIndicator({ idx, total, onNav }: { idx: number; total: number; onNav: (i: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 0" }}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onNav(i)}
          aria-label={`Recommendation ${i + 1}`}
          style={{
            width: 7, height: 7, borderRadius: "50%", border: "none", padding: 0,
            cursor: "pointer",
            background: i === idx ? ORANGE : "#d8d8d8",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        />
      ))}
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginLeft: "6px" }}>
        {idx + 1} of {total}
      </span>
    </div>
  );
}

// ─── Sleeve card ──────────────────────────────────────────────────────────────

function SleeveCard({ rec, mode, onAddToWantlist, wantlistAdded, onDismiss, dismissed, onPreviewReady }: {
  rec: Recommendation; mode: DigMode;
  onAddToWantlist: () => void; wantlistAdded: boolean;
  onDismiss: () => void; dismissed: boolean;
  onPreviewReady: (data: { previewUrl: string | null; trackUri: string | null; albumUri: string | null; artist: string; album: string } | null) => void;
}) {
  const t = useTranslations("dig");
  // Component remounts on every rec change (key prop), so useState resets naturally.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(`${rec.artist} ${rec.album}`);
    fetch(`/api/discogs/search?q=${q}&mode=record`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const first = data?.results?.[0];
        if (!first) return;
        const url =
          (first.cover_image && !first.cover_image.includes("spacer"))
            ? first.cover_image
            : (first.thumb && !first.thumb.includes("spacer") ? first.thumb : null);
        if (url) setCoverUrl(`/api/image-proxy?url=${encodeURIComponent(url)}`);
      })
      .catch(() => { /* fall back to vinyl disc */ });
    return () => { cancelled = true; };
  }, [rec.artist, rec.album]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ artist: rec.artist, title: rec.album });
    fetch(`/api/spotify/preview?${params.toString()}`)
      .then(r => r.json() as Promise<{ preview_url: string | null; track_uri: string | null; album_uri: string | null; album_art_url: string | null }>)
      .then(data => {
        if (cancelled) return;
        if (data.album_art_url) setCoverUrl(`/api/image-proxy?url=${encodeURIComponent(data.album_art_url)}`);
        onPreviewReady({ previewUrl: data.preview_url, trackUri: data.track_uri, albumUri: data.album_uri ?? null, artist: rec.artist, album: rec.album });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // onPreviewReady is stable for the lifetime of this component (remounts on rec change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.artist, rec.album]);

  const q = encodeURIComponent(`${rec.artist} ${rec.album}`);

  const STREAM = [
    { label: t("openAppleMusic"), href: `https://music.apple.com/search?term=${q}` },
    { label: t("openTidal"),      href: `https://tidal.com/search?q=${q}` },
    { label: t("openSpotify"),    href: `https://open.spotify.com/search/${q}` },
  ];
  const BUY = [
    { label: t("buyDiscogs"),      href: `https://www.discogs.com/search/?q=${q}&type=release` },
    { label: t("buyEbay"),         href: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=306` },
    { label: t("searchBandcamp"),  href: `https://bandcamp.com/search?q=${q}` },
    { label: t("searchRoughTrade"),href: `https://www.roughtrade.com/search?q=${q}` },
    { label: t("searchJuno"),      href: `https://www.juno.co.uk/search/?q=${q}` },
    { label: t("searchBoomkat"),   href: `https://boomkat.com/search?q=${q}` },
  ];

  const sectionLabel: React.CSSProperties = {
    fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
    textTransform: "uppercase", color: ORANGE, margin: "0 0 6px 0", display: "block",
  };
  const link: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
    color: "#444444", textDecoration: "none", display: "block", lineHeight: 2,
  };

  return (
    <div
      className="dig-rec-enter dig-sleeve-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "400px",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
      }}
    >
      {/* ── Left: album artwork, falls back to vinyl disc ── */}
      <div className="dig-sleeve-art" style={{ background: "#0e0e0e", overflow: "hidden", minHeight: "400px" }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`${rec.album} by ${rec.artist}`}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <VinylDisc />
        )}
      </div>

      {/* ── Right: text ── */}
      <div className="dig-sleeve-text" style={{ padding: "18px 22px", display: "flex", flexDirection: "column" }}>

        {/* Top row: mode tag (left) + Wantlist button (right, hidden for Inside Collection) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px", minHeight: "20px" }}>
          <div>
            {mode === "explore" && (
              <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
                In your collection
              </p>
            )}
          </div>
          {mode !== "explore" && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <button
                onClick={onDismiss}
                disabled={dismissed}
                style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "#bbbbbb",
                  background: "none", border: "none",
                  cursor: dismissed ? "default" : "pointer",
                  padding: "5px 2px",
                  textDecoration: dismissed ? "none" : "underline",
                  textDecorationColor: "#dddddd",
                }}
              >
                {dismissed ? t("noted") : t("notForMe")}
              </button>
              <button
                onClick={onAddToWantlist}
                disabled={wantlistAdded}
                style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                  color: wantlistAdded ? "#aaaaaa" : ORANGE,
                  background: "none",
                  border: `1px ${wantlistAdded ? "solid" : "dashed"} ${wantlistAdded ? "#aaaaaa" : ORANGE}`,
                  cursor: wantlistAdded ? "default" : "pointer",
                  padding: "5px 10px", flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {wantlistAdded ? t("addedWantlist") : t("addWantlist")}
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: "#0d0d0d", lineHeight: 1.25, margin: "0 0 6px 0" }}>
          {rec.album}
        </h2>

        {/* Artist · year */}
        <p className="dig-artist-lbl" style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#888888", margin: 0 }}>
          {rec.artist}
          {rec.year && <span style={{ color: "#cccccc" }}> · {rec.year}</span>}
        </p>

        {/* Rule */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "16px 0" }} />

        {/* Release details (DB-sourced picks) or AI reasoning (Claude picks) */}
        {(rec.label || rec.format || rec.country || rec.styles?.length || rec.producers?.length) ? (
          <div>
            {rec.label                && <MetaRowDig label="Label"     value={rec.label} />}
            {rec.format               && <MetaRowDig label="Format"    value={rec.format} />}
            {rec.country              && <MetaRowDig label="Country"   value={rec.country} />}
            {rec.genre                && <MetaRowDig label="Genre"     value={rec.genre} />}
            {rec.styles?.length       ? <MetaRowDig label="Style"     value={rec.styles.join(", ")} /> : null}
            {rec.producers?.length    ? <MetaRowDig label="Producers" value={rec.producers.join(", ")} /> : null}
          </div>
        ) : (
          <p
            className="dig-reason-txt"
            style={{
              fontFamily: SERIF,
              fontSize: "13px",
              fontStyle: "italic",
              color: "#505050",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {rec.reason}
          </p>
        )}

        {/* Spacer — pushes links to the bottom */}
        <div style={{ flex: 1 }} />

        {/* Links */}
        <div style={{ flexShrink: 0, paddingTop: "16px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {mode === "explore" ? (
            <div>
              <span style={sectionLabel}>Stream</span>
              {STREAM.map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="dig-link-item" style={link}>{l.label}</a>
              ))}
            </div>
          ) : (
            <div className="dig-links-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={sectionLabel}>Stream</span>
                {STREAM.map(l => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dig-link-item"
                    style={link}
                    onClick={isAppleMusicUrl(l.href) ? (e) => { e.preventDefault(); openAppleMusicLink(l.href); } : undefined}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
              <div>
                <span style={sectionLabel}>Buy</span>
                {BUY.map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="dig-link-item" style={link}>{l.label}</a>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Compact player (dig page) ────────────────────────────────────────────────
// Delegates all SDK lifecycle, token management, and audio playback to the
// root SpotifyPlayerProvider — this component only drives what to play via
// setActiveSource and reads playback state from context.

function DigCompactPlayer({ previewUrl, albumUri, trackUri, artist, album, recIdx, onTrackEnd }: {
  previewUrl:   string | null;
  albumUri:     string | null;
  trackUri:     string | null;
  artist:       string;
  album:        string;
  recIdx:       number;
  onTrackEnd?:  () => void;
}) {
  const {
    tokenData, deviceId, playing, position, duration,
    currentTrack, playError,
    setActiveSource, handlePlayPause, handleSeek: ctxHandleSeek,
    previousTrack, nextTrack, reconnect,
  } = useSpotifyPlayback();

  const isPremium = !!(tokenData?.connected && tokenData.product === "premium");

  // Keep a stable ref to onTrackEnd so it can be included in ActiveSource
  // without causing the setActiveSource effect to re-run on every render
  // (the parent creates a new arrow function each render).
  const onTrackEndRef = useRef(onTrackEnd);
  useEffect(() => { onTrackEndRef.current = onTrackEnd; }, [onTrackEnd]);

  // Tell the Provider what source to manage whenever the current rec changes.
  // This is the single integration point — the Provider handles all SDK and audio state.
  useEffect(() => {
    setActiveSource({
      mode:            "dig",
      albumUri:        albumUri ?? undefined,
      spotifyTrackUri: trackUri ?? undefined,
      previewUrl:      previewUrl ?? undefined,
      artist,
      albumTitle:      album,
      // Wrap in a stable function so setActiveSource itself doesn't need to
      // re-run when onTrackEnd identity changes — the ref is always fresh.
      onEnded: () => onTrackEndRef.current?.(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recIdx, albumUri, trackUri, previewUrl, artist, album]);

  const sdkWanted  = isPremium && !!(albumUri || trackUri);
  const sdkLive    = sdkWanted && !!deviceId;
  // The Provider's useSDK reflects the source it's currently managing.
  // "Connecting" = we want the SDK, the device isn't ready yet, and no error.
  const sdkConnecting = sdkWanted && !deviceId && !playError;

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    ctxHandleSeek(ratio);
  }

  // Invisible until there's something to play
  if (!sdkWanted && !previewUrl) return null;

  const eyebrow = playError ? "Error" : sdkConnecting ? "Connecting" : sdkLive ? "Now Playing" : "Preview";

  const nowPlayingText = playError === 403 ? "Spotify: Premium required or unavailable in your region"
    : playError === 401 ? "Spotify auth failed — try reconnecting in Settings"
    : playError === 429 ? "Spotify: rate limited — wait a moment and try again"
    : playError === 404 ? "Spotify device unavailable — tap to reconnect"
    : playError === 0   ? "Network error — check your connection"
    : playError         ? `Spotify error ${playError}`
    : sdkConnecting ? "Connecting to Spotify…"
    : sdkLive && currentTrack
      ? `${currentTrack.artist} — ${currentTrack.name}`
      : `${artist} — ${album}${!sdkLive ? " (30s)" : ""}`;

  const iconBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", padding: "4px",
    color: "#888", display: "flex", alignItems: "center", flexShrink: 0,
    transition: "color 0.15s",
  };

  return (
    <div
      className="dig-compact-player"
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "10px",
        paddingTop: "10px",
        borderTop:  "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* Eyebrow + track text */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: "0 1 36%" }}>
        <span style={{
          fontFamily: MONO, fontSize: "8px", letterSpacing: "0.16em",
          textTransform: "uppercase", color: sdkConnecting ? "#aaaaaa" : ORANGE, flexShrink: 0,
        }}>
          {eyebrow}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: "10px", color: "#0d0d0d",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {nowPlayingText}
        </span>
      </div>

      {/* Transport controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        {sdkLive && (
          <button
            onClick={() => previousTrack()}
            style={iconBtn} aria-label="Previous"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0d0d0d"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
          >
            <svg width="14" height="14" viewBox="0 0 22 22">
              <polygon points="19,3 19,19 8,11" fill="currentColor"/>
              <rect x="3" y="3" width="3" height="16" fill="currentColor"/>
            </svg>
          </button>
        )}
        <button
          onClick={() => {
            // 404 = device unavailable: handlePlayPause reconnects + plays in one step.
            // Other errors (401/403/429/0): reconnect only, user plays again after.
            if (playError && playError !== 404) { reconnect(); return; }
            void handlePlayPause();
          }}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: "30px", height: "30px", flexShrink: 0,
            background: "#0d0d0d", color: "#ffffff",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#0d0d0d"; }}
        >
          {playing
            ? <svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="1" width="4" height="14" fill="currentColor"/><rect x="10" y="1" width="4" height="14" fill="currentColor"/></svg>
            : <svg width="12" height="12" viewBox="0 0 16 16"><polygon points="3,1 3,15 14,8" fill="currentColor"/></svg>
          }
        </button>
        {sdkLive && (
          <button
            onClick={() => nextTrack()}
            style={iconBtn} aria-label="Next"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0d0d0d"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
          >
            <svg width="14" height="14" viewBox="0 0 22 22">
              <polygon points="3,3 3,19 14,11" fill="currentColor"/>
              <rect x="16" y="3" width="3" height="16" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>

      {/* Progress */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", flexShrink: 0 }}>
          {fmt(position)}
        </span>
        <div
          onClick={handleSeekClick}
          style={{ flex: 1, height: "2px", background: "#e0e0da", position: "relative", cursor: "pointer" }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: ORANGE }} />
          <div style={{
            position: "absolute", top: "50%", left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            width: "8px", height: "8px", borderRadius: "50%", background: ORANGE,
          }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", flexShrink: 0 }}>
          {fmt(duration)}
        </span>
      </div>

      {/* Spotify badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#1DB954", display: "inline-block" }} />
        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#1DB954", whiteSpace: "nowrap" }}>
          {sdkLive ? "Streaming" : "Spotify"}
        </span>
      </div>
    </div>
  );
}

// ─── Nav bar — single row ─────────────────────────────────────────────────────

function NavBar({ idx, total, onNav, onDigAgain }: {
  idx:        number;
  total:      number;
  onNav:      (dir: -1 | 1) => void;
  onDigAgain: () => void;
}) {
  const btn: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
    background: "none", border: "none", cursor: "pointer", padding: "12px 0", color: "#0d0d0d",
  };
  const btnOff: React.CSSProperties = { ...btn, color: "#d0d0d0", cursor: "default" };

  return (
    <div className="dig-navbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px" }}>
      <button onClick={() => onNav(-1)} disabled={idx === 0} className="dig-nav-btn" style={idx === 0 ? btnOff : btn}>
        ← Previous
      </button>
      <button onClick={onDigAgain} className="dig-nav-btn" style={{ ...btn, color: ORANGE }}>
        Dig again ↺
      </button>
      <button onClick={() => onNav(1)} disabled={idx === total - 1} className="dig-nav-btn" style={idx === total - 1 ? btnOff : btn}>
        Next →
      </button>
    </div>
  );
}


// ─── Dig History ─────────────────────────────────────────────────────────────

type HistorySession = {
  id:   string;
  date: string; // ISO
  mode: DigMode;
  recs: Recommendation[];
};

const HISTORY_KEY = "dig-history";
const SEVEN_DAYS  = 7 * 24 * 60 * 60 * 1000;

function saveToHistory(mode: DigMode, recs: Recommendation[]) {
  if (mode === "explore") return;
  try {
    const session: HistorySession = { id: Date.now().toString(), date: new Date().toISOString(), mode, recs };
    const existing = (() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistorySession[]; } catch { return [] as HistorySession[]; } })();
    const cutoff   = Date.now() - SEVEN_DAYS;
    const fresh    = existing.filter(s => new Date(s.date).getTime() > cutoff);
    fresh.unshift(session);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(fresh.slice(0, 50)));
  } catch {}
}

function loadHistory(): HistorySession[] {
  try {
    const all    = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistorySession[];
    const cutoff = Date.now() - SEVEN_DAYS;
    return all.filter(s => new Date(s.date).getTime() > cutoff);
  } catch { return []; }
}

function fmtSessionDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) + ` · ${time}`;
}

const MODE_LABEL: Record<DigMode, string> = {
  discover: "Discover",
  explore:  "Explore",
  style:    "Style Dig",
};

function DigHistoryView({ onAddToWantlist, wantlistAdded }: {
  onAddToWantlist: (rec: Recommendation) => void;
  wantlistAdded:   Set<string>;
}) {
  const t = useTranslations("dig");
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  useEffect(() => { setSessions(loadHistory()); }, []);

  if (sessions.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: SERIF, fontSize: "15px", fontStyle: "italic", color: "#888888", margin: 0 }}>
          No digs in the last 7 days. Start a dig to build your history.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: "40px", marginTop: "16px" }}>
      {sessions.map(session => (
        <div key={session.id} style={{ marginBottom: "24px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "10px", paddingBottom: "8px",
            borderBottom: "1px solid #e8e8e2",
          }}>
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa" }}>
              {fmtSessionDate(session.date)}
            </span>
            <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#d0d0d0", flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE }}>
              {MODE_LABEL[session.mode]}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {session.recs.map((rec, i) => {
              const key   = `${rec.artist}||${rec.album}`;
              const added = wantlistAdded.has(key);
              return (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr auto",
                    alignItems: "start", gap: "14px",
                    padding: "11px 14px",
                    border: "1px solid #f0f0eb", background: "#fafaf8",
                  }}
                >
                  <div>
                    <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 400, color: "#0d0d0d", margin: "0 0 2px" }}>
                      {rec.album}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: "9px", color: "#888888", margin: "0 0 6px", letterSpacing: "0.04em" }}>
                      {rec.artist}{rec.year ? ` · ${rec.year}` : ""}
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: "11px", fontStyle: "italic", color: "#666666", margin: 0, lineHeight: 1.55 }}>
                      {rec.reason.length > 180 ? rec.reason.slice(0, 180) + "…" : rec.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => { if (!added) onAddToWantlist(rec); }}
                    disabled={added}
                    style={{
                      fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase",
                      color: added ? "#aaaaaa" : ORANGE,
                      background: "none",
                      border: `1px ${added ? "solid" : "dashed"} ${added ? "#aaaaaa" : ORANGE}`,
                      cursor: added ? "default" : "pointer",
                      padding: "4px 8px", flexShrink: 0, whiteSpace: "nowrap",
                      transition: "all 0.2s",
                    }}
                  >
                    {added ? t("addedWantlist") : t("addWantlist")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Style picker ─────────────────────────────────────────────────────────────

function StylePicker({ styles, onSelect }: { styles: string[]; onSelect: (style: string) => void }) {
  const t = useTranslations("dig");
  const [query, setQuery] = useState("");

  if (styles.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: SERIF, fontSize: "15px", fontStyle: "italic", color: "#888888", margin: 0, textAlign: "center", maxWidth: 360 }}>
          No styles found in your collection yet. Sync more records with Discogs metadata to unlock Style Dig.
        </p>
      </div>
    );
  }

  const filtered = query.trim()
    ? styles.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : styles;

  // Group alphabetically
  const groups: { letter: string; items: string[] }[] = [];
  for (const s of filtered) {
    const letter = s[0]?.toUpperCase() ?? "#";
    const last = groups[groups.length - 1];
    if (last?.letter === letter) last.items.push(s);
    else groups.push({ letter, items: [s] });
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: "12px" }}>
      {/* Filter input */}
      <div style={{ paddingBottom: "12px", marginBottom: "4px", borderBottom: "1px solid #f0f0ea", flexShrink: 0 }}>
        <input
          type="text"
          placeholder={t("filterStyles")}
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em",
            color: "#0d0d0d", background: "none",
            border: "none", borderBottom: "1px solid #d8d8d2",
            padding: "4px 0", outline: "none",
          }}
        />
      </div>

      {/* Scrollable grouped list */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "48px" }}>
        {groups.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", textAlign: "center", marginTop: "32px" }}>
            No styles match &ldquo;{query}&rdquo;
          </p>
        ) : groups.map(({ letter, items }) => (
          <div key={letter} style={{ marginTop: "20px" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#cccccc", margin: "0 0 8px", paddingBottom: "4px", borderBottom: "1px solid #f4f4f0" }}>
              {letter}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {items.map(s => (
                <button
                  key={s}
                  onClick={() => onSelect(s)}
                  style={{
                    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.03em",
                    color: "#333333", background: "none",
                    border: "1px solid #e4e4de", padding: "5px 11px",
                    cursor: "pointer", transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; (e.currentTarget as HTMLButtonElement).style.color = ORANGE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e4e4de"; (e.currentTarget as HTMLButtonElement).style.color = "#333333"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mode toggle ─────────────────────────────────────────────────────────────

type DigMode = "discover" | "explore" | "style";
type DigTab  = DigMode | "history";

function ModeToggle({ mode, onChange, disabled }: {
  mode:     DigTab;
  onChange: (m: DigTab) => void;
  disabled: boolean;
}) {
  const t = useTranslations("dig");
  const item = (m: DigTab, label: string) => {
    const active = mode === m;
    // History tab is always clickable even while a dig is loading
    const clickable = !active && (m === "history" || !disabled);
    return (
      <button
        key={m}
        onClick={() => { if (clickable) onChange(m); }}
        className="dig-mode-btn"
        style={{
          fontFamily: MONO,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "none",
          border: "none",
          borderBottom: `1.5px solid ${active ? (m === "history" ? "#0d0d0d" : ORANGE) : "transparent"}`,
          padding: "6px 0",
          cursor: clickable ? "pointer" : "default",
          color: active ? "#0d0d0d" : "#bbbbbb",
          transition: "color 0.15s, border-color 0.15s",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="dig-mode-toggle" style={{ display: "flex", justifyContent: "center", gap: "24px", paddingTop: "14px" }}>
      {item("explore",  t("insideCollection"))}
      {item("discover", t("outsideCollection"))}
      {item("style",    t("styleDig"))}
      {item("history",  t("digHistory"))}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function DigClient({ userId, username, displayLabel, avatarUrl, collectionCount, availableStyles, hasQuizProfile, initialExplorePicks }: Props) {
  const [activeTab, setActiveTab] = useUrlTab<DigTab>("tab", ["explore", "discover", "style", "history"], "explore");

  // Derived — the active dig mode (history tab has no mode)
  const mode: DigMode = activeTab === "history" ? "discover" : activeTab;

  // True when the page loaded with the explore tab active AND the server pre-computed picks.
  // In that case we skip the initial API call — picks are already in hand.
  const hasInitialPicks = !!initialExplorePicks && activeTab === "explore";
  // Consumed exactly once: the first time the explore fetch effect fires.
  const skipInitialExploreRef = useRef(hasInitialPicks);

  const [recs,              setRecs]              = useState<Recommendation[] | null>(hasInitialPicks ? initialExplorePicks : null);
  const [loading,           setLoading]           = useState(!hasInitialPicks);
  const [error,             setError]             = useState<string | null>(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [idx,           setIdx]           = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [wantlistAdded, setWantlistAdded] = useState<Set<string>>(new Set());
  const [wantlistError, setWantlistError] = useState<string | null>(null);
  const [dismissed,     setDismissed]     = useState<Set<string>>(new Set());
  const [digSpotify,    setDigSpotify]    = useState<{
    previewUrl: string | null; trackUri: string | null; albumUri: string | null; artist: string; album: string;
  } | null>(null);

  // Accumulates artists and full recs shown this session so the API can avoid
  // repeating the same artists, genres, and stylistic territory
  const shownArtists = useRef<string[]>([]);
  const shownRecs    = useRef<Array<{ artist: string; album: string }>>([]);

  // Mobile swipe — tracks touch start to detect a horizontal swipe on the sleeve card
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // fetchKey drives all fetches. Incrementing `n` re-triggers the effect for
  // "dig again" without changing mode; swapping `mode` handles mode changes.
  // Initialise from activeTab so the first fetch matches what's displayed —
  // the old hardcoded "discover" caused Claude results to appear on the explore tab.
  const initialFetchMode: DigMode = activeTab === "history" ? "discover" : (activeTab as DigMode);
  const [fetchKey, setFetchKey] = useState<{ mode: DigMode; n: number; style?: string }>({ mode: initialFetchMode, n: 0 });

  // Clear player on mode/fetch change and also on rec navigation — until the
  // new card's onPreviewReady fires, the player should show nothing rather than
  // the previous album's metadata.
  useEffect(() => { setDigSpotify(null); }, [mode, fetchKey]);
  useEffect(() => { setDigSpotify(null); }, [idx]);

  // All setState calls inside the effect are in async callbacks, never synchronously
  // in the effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    if (fetchKey.mode === "style" && !fetchKey.style) return;
    // First explore load: server already computed picks — skip the API call
    if (fetchKey.mode === "explore" && initialExplorePicks && skipInitialExploreRef.current) {
      skipInitialExploreRef.current = false;
      // Register server-picked records so the first "Dig Again" sends them as
      // previousRecommendations and the API doesn't re-surface the same picks.
      for (const r of initialExplorePicks) {
        if (!shownArtists.current.includes(r.artist)) shownArtists.current.push(r.artist);
        shownRecs.current.push({ artist: r.artist, album: r.album });
      }
      setRecs(initialExplorePicks);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: fetchKey.mode, style: fetchKey.style, previousArtists: shownArtists.current, previousRecommendations: shownRecs.current }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 429 && data.error === "daily_limit_reached") {
          setDailyLimitReached(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Failed to get recommendations");
        const newRecs: Recommendation[] = data.recommendations;
        // Accumulate artists + recs for future exclusion — reset only when mode changes
        for (const r of newRecs) {
          if (r.artist && !shownArtists.current.includes(r.artist)) {
            shownArtists.current.push(r.artist);
          }
          if (r.artist && r.album) {
            shownRecs.current.push({ artist: r.artist, album: r.album });
          }
        }
        saveToHistory(fetchKey.mode, newRecs);
        setRecs(newRecs);
        setIdx(0);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchKey]);

  function handleTabChange(tab: DigTab) {
    if (tab === activeTab) return;
    if (tab === "history") {
      setActiveTab("history");
      return;
    }
    // Switching to a dig mode — reset and fetch
    shownArtists.current = [];
    shownRecs.current    = [];
    setActiveTab(tab);
    setError(null);
    setRecs(null);
    setDailyLimitReached(false);
    if (tab === "style" && !selectedStyle) {
      // Wait for the user to pick a style before fetching anything
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchKey({ mode: tab, n: 0, style: tab === "style" ? selectedStyle ?? undefined : undefined });
  }

  function handleStyleSelect(style: string) {
    shownArtists.current = [];
    shownRecs.current    = [];
    setSelectedStyle(style);
    setLoading(true);
    setError(null);
    setRecs(null);
    setFetchKey({ mode: "style", n: 0, style });
  }

  function handleChangeStyle() {
    setSelectedStyle(null);
    setRecs(null);
    setError(null);
  }

  function handleDigAgain() {
    setLoading(true);
    setError(null);
    setRecs(null);
    setFetchKey(prev => ({ ...prev, n: prev.n + 1 }));
  }

  async function handleAddToWantlist(rec: Recommendation) {
    const key = `${rec.artist}||${rec.album}`;
    setWantlistAdded(prev => new Set(prev).add(key));
    setWantlistError(null);

    const supabase = createClient();
    let listId: string;

    try {
      // ── 1. Find wantlist ──────────────────────────────────────────────────
      console.log("[wantlist] finding list for user", userId);
      const { data: existing, error: findErr } = await supabase
        .from("lists")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", "wantlist")
        .single();

      if (findErr && findErr.code !== "PGRST116") {
        console.error("[wantlist] find error", findErr);
        throw new Error(`List lookup failed: ${findErr.message}`);
      }

      if (existing) {
        console.log("[wantlist] found list", existing.id);
        listId = existing.id;
      } else {
        // ── 2. Create wantlist if missing ───────────────────────────────────
        console.log("[wantlist] no list found, creating");
        const { data: created, error: createErr } = await supabase
          .from("lists")
          .insert({ user_id: userId, title: "Wantlist", slug: "wantlist", is_public: true, list_type: "personal" })
          .select("id")
          .single();

        if (createErr || !created) {
          console.error("[wantlist] create error", createErr);
          throw new Error(`Could not create wantlist: ${createErr?.message ?? "unknown"}`);
        }
        console.log("[wantlist] created list", created.id);
        listId = created.id;
      }
    } catch (e) {
      setWantlistAdded(prev => { const s = new Set(prev); s.delete(key); return s; });
      setWantlistError(e instanceof Error ? e.message : "Failed to find wantlist");
      setTimeout(() => setWantlistError(null), 6000);
      return;
    }

    try {
      // ── 3. Next position ──────────────────────────────────────────────────
      const { data: posRow, error: posErr } = await supabase
        .from("list_items")
        .select("position")
        .eq("list_id", listId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (posErr) {
        console.error("[wantlist] position lookup error", posErr);
        throw new Error(`Position lookup failed: ${posErr.message}`);
      }
      const nextPos = (posRow?.position ?? 0) + 1;
      console.log("[wantlist] next position", nextPos);

      // ── 4. Insert ─────────────────────────────────────────────────────────
      const { data: inserted, error: insertErr } = await supabase
        .from("list_items")
        .insert({
          list_id:     listId,
          position:    nextPos,
          item_type:   "song",
          song_title:  rec.album,
          song_artist: rec.artist,
          song_album:  rec.album,
          song_year:   rec.year ?? null,
          source:      "dig",
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        console.error("[wantlist] insert error", insertErr);
        throw new Error(insertErr?.message ?? "Insert returned no row — check RLS policies");
      }
      console.log("[wantlist] inserted item", inserted.id, "at position", nextPos);
    } catch (e) {
      setWantlistAdded(prev => { const s = new Set(prev); s.delete(key); return s; });
      setWantlistError(e instanceof Error ? e.message : "Failed to add to wantlist");
      setTimeout(() => setWantlistError(null), 6000);
    }
  }

  // Explicit "not for me" — a faster, stronger negative signal than waiting
  // for the same genre/sub-style to be shown 3 times with no action. Updates
  // the dig_history row the server already persisted for this pick (best-
  // effort: if the insert from after() somehow hasn't landed yet, the local
  // dismissed state below still hides it for this session either way).
  async function handleDismiss(rec: Recommendation) {
    const key = `${rec.artist}||${rec.album}`;
    setDismissed(prev => new Set(prev).add(key));
    try {
      const supabase = createClient();
      // dig_history isn't in the generated Supabase types (same as its other
      // call sites in api/dig/route.ts) — cast to bypass that, not to skip checks.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("dig_history")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("artist", rec.artist)
        .eq("album", rec.album)
        .is("dismissed_at", null);
    } catch {
      // best-effort — local dismissed state already hides it this session
    }
  }

  function navigate(dir: -1 | 1) {
    const total = recs?.length ?? 1;
    setIdx(i => Math.min(Math.max(i + dir, 0), total - 1));
  }

  return (
    <div className="dig-outer" style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#ffffff", overflow: "hidden" }}>

      <style>{`
        @keyframes dig-vinyl-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dig-arm-lower {
          0%, 22% { transform: rotate(-28deg); }
          100%    { transform: rotate(0deg); }
        }
        @keyframes dig-rec-enter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dig-vinyl-spin {
          transform-origin: 95px 115px;
          animation: dig-vinyl-spin 2.6s linear infinite;
        }
        .dig-arm-lower {
          transform-origin: 210px 30px;
          animation: dig-arm-lower 8s cubic-bezier(0.08, 0, 0.04, 1) forwards;
        }
        .dig-rec-enter {
          animation: dig-rec-enter 0.25s ease-out both;
        }

        /* ── Mobile responsive ── */
        @media (max-width: 767px) {
          /* Page scrolls on mobile instead of fixed-height viewport */
          .dig-outer {
            height: auto !important;
            min-height: 100dvh;
            overflow-x: hidden !important;
            overflow-y: auto !important;
          }
          .dig-main { overflow: visible !important; flex: none !important; }
          .dig-main-inner {
            padding-left: 16px !important;
            padding-right: 16px !important;
            overflow: visible !important;
            flex: none !important;
            max-width: 100% !important;
          }

          /* Header: title stacks on top, stats row below */
          .dig-header-inner {
            flex-wrap: wrap !important;
            padding: 14px 16px !important;
            gap: 6px 20px !important;
          }
          /* Title spans full width and moves to the top via order */
          .dig-header-title {
            order: -1 !important;
            flex: 0 0 100% !important;
            padding: 0 !important;
          }
          .dig-header-title h1 { font-size: 18px !important; }
          .dig-header-title p  { font-size: 8px !important; }
          /* Rules between stats and title disappear */
          .dig-header-rule { display: none !important; }
          /* Stat blocks shed padding and sit side-by-side */
          .dig-stat-side { padding: 0 !important; }
          .dig-stat-num  { font-size: 18px !important; }
          .dig-stat-lbl  { font-size: 9px !important; }

          /* Mode toggle: buttons share full width equally */
          .dig-mode-toggle {
            gap: 0 !important;
            padding-top: 10px !important;
          }
          .dig-mode-btn {
            flex: 1 !important;
            text-align: center !important;
            padding: 10px 6px !important;
            font-size: 8px !important;
            letter-spacing: 0.08em !important;
          }

          /* Sleeve card: single column, art on top */
          .dig-sleeve-card {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }
          .dig-sleeve-art {
            width: 100% !important;
            min-height: 0 !important;
            aspect-ratio: 1 / 1;
            max-height: 400px;
            overflow: hidden;
          }
          .dig-sleeve-text {
            padding: 20px 18px !important;
          }
          .dig-sleeve-text h2   { font-size: 18px !important; }
          .dig-artist-lbl        { font-size: 12px !important; }
          .dig-reason-txt        { font-size: 14px !important; }

          /* Links: single column, comfortable tap targets */
          .dig-links-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .dig-link-item  { font-size: 12px !important; line-height: 2.4 !important; min-height: 36px; display: flex !important; align-items: center !important; }

          /* Nav bar: equal thirds, 44px minimum tap height */
          .dig-navbar {
            padding-top: 14px !important;
            padding-bottom: 16px !important;
          }
          .dig-nav-btn {
            flex: 1 !important;
            min-height: 44px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 8px !important;
            font-size: 11px !important;
          }

          /* Loading vinyl: give it room instead of hugging the top — the page
             no longer has a fixed flex height to center into on mobile. */
          .dig-loading {
            min-height: 45vh !important;
            justify-content: center !important;
          }

          .dig-spotify-player { display: none !important; }
        }
      `}</style>

      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Main ── */}
      <main className="dig-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="dig-main-inner" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", padding: "0 40px 72px", overflow: "hidden" }}>

          <ModeToggle mode={activeTab} onChange={handleTabChange} disabled={loading} />

          {collectionCount === 0 && hasQuizProfile && activeTab === "discover" && (
            <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.05em", color: "#aaaaaa", margin: "8px 0 0" }}>
              Starter picks based on your taste profile ·{" "}
              <Link href="/collection" style={{ color: ORANGE, textDecoration: "none" }}>Sync Discogs to unlock your full collection →</Link>
            </p>
          )}

          {activeTab === "history" ? (
            <DigHistoryView onAddToWantlist={handleAddToWantlist} wantlistAdded={wantlistAdded} />
          ) : activeTab === "style" && !selectedStyle ? (
            <StylePicker styles={availableStyles} onSelect={handleStyleSelect} />
          ) : (
            <>
              {activeTab === "style" && selectedStyle && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0 4px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888888" }}>
                    {selectedStyle}
                  </span>
                  <button
                    onClick={handleChangeStyle}
                    style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Change
                  </button>
                </div>
              )}

              {loading && (
                <div className="dig-loading" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <RecordSpinner />
                </div>
              )}

              {dailyLimitReached && !loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "12px", padding: "2rem", textAlign: "center" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
                    Daily limit reached
                  </p>
                  <p style={{ fontFamily: SERIF, fontSize: "1.6rem", fontWeight: 400, color: "#0a0a0a", margin: 0, lineHeight: 1.1 }}>
                    2 outside digs per day
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#666", margin: "4px 0 16px", lineHeight: 1.7 }}>
                    Free accounts get 2 Outside Collection &amp; Style digs per day.<br />
                    Inside Collection digs are always free.<br />
                    Support rek<span style={{ color: ORANGE }}>ō</span>do for unlimited access.
                  </p>
                  <Link
                    href="/about#support"
                    style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#FDF6F0", background: "#0a0a0a", padding: "12px 24px", textDecoration: "none", display: "inline-block" }}
                  >
                    Support rek<span style={{ color: ORANGE }}>ō</span>do →
                  </Link>
                </div>
              )}

              {error && !loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "16px" }}>
                  <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: 0 }}>{error}</p>
                  <button onClick={handleDigAgain} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, cursor: "pointer", padding: "8px 16px" }}>
                    Try again
                  </button>
                </div>
              )}

              {recs && !loading && (
                <>
                  <PositionIndicator idx={idx} total={recs.length} onNav={setIdx} />
                  <div
                    onTouchStart={e => {
                      const t = e.touches[0];
                      touchStart.current = { x: t.clientX, y: t.clientY };
                    }}
                    onTouchEnd={e => {
                      const start = touchStart.current;
                      touchStart.current = null;
                      if (!start || recs.length < 2) return;
                      const t = e.changedTouches[0];
                      const dx = t.clientX - start.x;
                      const dy = t.clientY - start.y;
                      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                        navigate(dx < 0 ? 1 : -1);
                      }
                    }}
                  >
                    <SleeveCard
                      key={`${idx}-${mode}`}
                      rec={recs[idx]}
                      mode={mode}
                      onAddToWantlist={() => handleAddToWantlist(recs[idx])}
                      wantlistAdded={wantlistAdded.has(`${recs[idx].artist}||${recs[idx].album}`)}
                      onDismiss={() => handleDismiss(recs[idx])}
                      dismissed={dismissed.has(`${recs[idx].artist}||${recs[idx].album}`)}
                      onPreviewReady={setDigSpotify}
                    />
                  </div>
                  {wantlistError && (
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#cc3300", textAlign: "center", margin: "0 16px 4px", letterSpacing: "0.04em" }}>
                      {wantlistError}
                    </p>
                  )}
                  <NavBar idx={idx} total={recs.length} onNav={navigate} onDigAgain={handleDigAgain} />
                </>
              )}
            </>
          )}

          {/* Always mounted outside the loading gate so the SDK never disconnects
              between "Dig Again" fetches. Renders null internally when nothing is playable. */}
          <div className="dig-spotify-player">
            <DigCompactPlayer
              recIdx={idx}
              previewUrl={digSpotify?.previewUrl ?? null}
              albumUri={digSpotify?.albumUri ?? null}
              trackUri={digSpotify?.trackUri ?? null}
              artist={digSpotify?.artist ?? ""}
              album={digSpotify?.album ?? ""}
              onTrackEnd={() => navigate(1)}
            />
          </div>

        </div>
      </main>

    </div>
  );
}
