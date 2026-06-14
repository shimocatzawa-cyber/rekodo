"use client";

import { useState, useEffect, useRef } from "react";
import AppNav from "@/components/AppNav";
import { addToWantlist } from "@/app/dig/actions";
import RecordSpinner from "@/components/RecordSpinner";

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
};

interface Props {
  username:        string;
  displayLabel?:   string;
  avatarUrl?:      string | null;
  collectionCount: number;
  listsCount:      number;
}

// ─── Vinyl disc SVG ───────────────────────────────────────────────────────────

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

// ─── Loading — vinyl + tonearm ────────────────────────────────────────────────

function LoadingState({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "32px" }}>
      <svg viewBox="0 0 240 196" width="180" height="147" style={{ display: "block", overflow: "visible" }} aria-hidden="true">
        <g className="dig-vinyl-spin">
          <circle cx="95"  cy="115" r="80" fill="#111111" />
          <circle cx="95"  cy="115" r="74" fill="none" stroke="#222222" strokeWidth="1" />
          <circle cx="95"  cy="115" r="67" fill="none" stroke="#1e1e1e" strokeWidth="1" />
          <circle cx="95"  cy="115" r="60" fill="none" stroke="#1d1d1d" strokeWidth="1" />
          <circle cx="95"  cy="115" r="53" fill="none" stroke="#1c1c1c" strokeWidth="1" />
          <circle cx="95"  cy="115" r="45" fill="none" stroke="#1b1b1b" strokeWidth="1" />
          <circle cx="95"  cy="115" r="37" fill="none" stroke="#1b1b1b" strokeWidth="0.8" />
          <circle cx="95"  cy="115" r="23" fill="#1a1a1a" />
          <circle cx="95"  cy="115" r="15" fill="none" stroke="#2b2b2b" strokeWidth="0.5" />
          <circle cx="95"  cy="115" r="2.5" fill="#060606" />
        </g>
        <g className="dig-arm-lower">
          <circle cx="210" cy="30" r="9"   fill="#333333" />
          <circle cx="210" cy="30" r="4"   fill="#1a1a1a" />
          <line x1="207" y1="37" x2="162" y2="78" stroke="#454545" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="162" y1="78" x2="153" y2="91" stroke="#414141" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="148" y="87" width="11" height="6" rx="1.5" fill="#373737" />
          <circle cx="151" cy="95" r="3.5" fill={ORANGE} />
        </g>
      </svg>
      <p style={{ fontFamily: SERIF, fontSize: "15px", fontStyle: "italic", color: "#888888", margin: 0 }}>
        {text}
      </p>
    </div>
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

function SleeveCard({ rec, mode, onAddToWantlist, wantlistAdded, onPreviewReady }: {
  rec: Recommendation; mode: DigMode;
  onAddToWantlist: () => void; wantlistAdded: boolean;
  onPreviewReady: (data: { previewUrl: string | null; trackUri: string | null; albumUri: string | null; artist: string; album: string } | null) => void;
}) {
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
        if (url) setCoverUrl(url);
      })
      .catch(() => { /* fall back to vinyl disc */ });
    return () => { cancelled = true; };
  }, [rec.artist, rec.album]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ artist: rec.artist, title: rec.album });
    fetch(`/api/spotify/preview?${params.toString()}`)
      .then(r => r.json() as Promise<{ preview_url: string | null; track_uri: string | null; album_uri: string | null }>)
      .then(data => {
        if (cancelled) return;
        onPreviewReady({ previewUrl: data.preview_url, trackUri: data.track_uri, albumUri: data.album_uri ?? null, artist: rec.artist, album: rec.album });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // onPreviewReady is stable for the lifetime of this component (remounts on rec change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.artist, rec.album]);

  const q = encodeURIComponent(`${rec.artist} ${rec.album}`);

  const STREAM = [
    { label: "Open in Apple Music ↗", href: `https://music.apple.com/search?term=${q}` },
    { label: "Open in Tidal ↗",       href: `https://tidal.com/search?q=${q}` },
    { label: "Open in Spotify ↗",     href: `https://open.spotify.com/search/${q}` },
  ];
  const BUY = [
    { label: "Buy on Discogs ↗",     href: `https://www.discogs.com/search/?q=${q}&type=release` },
    { label: "Search Bandcamp ↗",    href: `https://bandcamp.com/search?q=${q}` },
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
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <VinylDisc />
        )}
      </div>

      {/* ── Right: text ── */}
      <div className="dig-sleeve-text" style={{ padding: "18px 22px", display: "flex", flexDirection: "column" }}>

        {/* Top row: mode tag (left) + Wantlist button (right) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px", minHeight: "20px" }}>
          <div>
            {mode === "explore" && (
              <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
                In your collection
              </p>
            )}
            {mode === "hallucinations" && (
              <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#b30042", margin: 0 }}>
                ⚡ Way outside your taste
              </p>
            )}
          </div>
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
            {wantlistAdded ? "Added ✓" : "+ Wantlist"}
          </button>
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

        {/* AI reasoning — full text, no truncation */}
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
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="dig-link-item" style={link}>{l.label}</a>
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

// ─── Compact player (dig page) — preview fallback, full album for Premium ──────

// Local SDK types (Window.Spotify is declared globally in SpotifyPlayer.tsx)
interface DigTokenData { connected: boolean; access_token?: string; product?: string; }
interface DigPlaybackState {
  paused: boolean; position: number; duration: number;
  track_window: { current_track: { name: string; artists: Array<{ name: string }> } };
}
type DigSdkPlayer = {
  connect(): Promise<boolean>; disconnect(): void;
  addListener(event: string, cb: (d: unknown) => void): boolean;
  togglePlay(): Promise<void>; previousTrack(): Promise<void>; nextTrack(): Promise<void>;
  setVolume(v: number): Promise<void>;
  getCurrentState(): Promise<DigPlaybackState | null>;
};

let _digSdkLoaded = false;
const _digSdkCbs: Array<() => void> = [];
function ensureDigSDK(cb: () => void) {
  if (_digSdkLoaded) { cb(); return; }
  _digSdkCbs.push(cb);
  if (typeof window === "undefined") return;
  if (window.Spotify) {
    // Already loaded by another component
    _digSdkLoaded = true; _digSdkCbs.splice(0).forEach(f => f()); return;
  }
  if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
    window.onSpotifyWebPlaybackSDKReady = () => {
      _digSdkLoaded = true; _digSdkCbs.splice(0).forEach(f => f());
    };
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(s);
  }
}

function DigCompactPlayer({ previewUrl, albumUri, trackUri, artist, album }: {
  previewUrl: string | null;
  albumUri:   string | null;
  trackUri:   string | null;
  artist:     string;
  album:      string;
}) {
  const [tokenData, setTokenData] = useState<DigTokenData | null>(null);
  const [deviceId,  setDeviceId]  = useState<string | null>(null);
  const [sdkReady,  setSdkReady]  = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [position,  setPosition]  = useState(0);
  const [duration,  setDuration]  = useState(30_000);
  const [volume,    setVolume]    = useState(0.8);
  const [nowTrack,  setNowTrack]  = useState<{ artist: string; name: string } | null>(null);

  const playerRef     = useRef<DigSdkPlayer | null>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether we've sent a "start playback" command for this record instance.
  // Prevents togglePlay() being called when the SDK is still on a previous album.
  const sdkStartedRef = useRef(false);

  const isPremium = !!(tokenData?.connected && tokenData.product === "premium");
  const useSDK    = isPremium && !!(albumUri || trackUri);
  // SDK is only "live" once the device is registered — before that, preview is the fallback
  const sdkLive   = useSDK && !!deviceId;

  // Fetch token once — non-blocking; preview plays immediately while this resolves
  useEffect(() => {
    fetch("/api/spotify/token")
      .then(r => r.json() as Promise<DigTokenData>)
      .then(setTokenData)
      .catch(() => setTokenData({ connected: false }));
  }, []);

  // Load SDK when Premium
  useEffect(() => {
    if (!isPremium) return;
    if (_digSdkLoaded) { setSdkReady(true); return; }
    ensureDigSDK(() => setSdkReady(true));
  }, [isPremium]);

  // Init SDK player
  useEffect(() => {
    if (!sdkReady || !tokenData?.access_token || playerRef.current) return;
    const player = new window.Spotify.Player({
      name: "rekōdo",
      getOAuthToken: async (cb) => {
        try {
          const res  = await fetch("/api/spotify/token");
          const data = await res.json() as DigTokenData;
          cb(data.access_token ?? "");
        } catch {
          cb("");
        }
      },
      volume: 0.8,
    }) as unknown as DigSdkPlayer;
    player.addListener("ready", (d) => setDeviceId((d as { device_id: string }).device_id));
    player.addListener("player_state_changed", (s) => {
      if (!s) return;
      const state = s as DigPlaybackState;
      setPlaying(!state.paused);
      setPosition(state.position);
      setDuration(state.duration);
      const t = state.track_window?.current_track;
      if (t) setNowTrack({ artist: t.artists?.[0]?.name ?? "", name: t.name ?? "" });
    });
    player.addListener("not_ready", () => { setTimeout(() => player.connect().catch(() => {}), 1000); });
    player.connect();
    playerRef.current = player;
    return () => { player.disconnect(); playerRef.current = null; };
  }, [sdkReady, tokenData?.access_token]);

  // Keep SDK alive on tab switch
  useEffect(() => {
    if (!sdkReady) return;
    const onVisible = () => {
      if (!document.hidden && playerRef.current) playerRef.current.connect().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sdkReady]);

  // Poll position while SDK is playing
  useEffect(() => {
    if (!playing || !playerRef.current) return;
    pollRef.current = setInterval(async () => {
      const s = await playerRef.current?.getCurrentState();
      if (s) { setPosition(s.position); setDuration(s.duration); }
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [playing]);

  // Reset playback state when the album changes (no unmount/remount — SDK stays alive)
  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    setNowTrack(null);
    sdkStartedRef.current = false;
  }, [albumUri, trackUri, previewUrl]);

  // Preview audio — always created when previewUrl is set, used as fallback before SDK is live.
  // State is driven by element events ("playing"/"pause"/"ended") rather than the play() promise,
  // which avoids the "press twice" bug caused by buffering or silent promise rejection.
  useEffect(() => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.preload = "auto";
    audio.volume  = volume;
    audioRef.current = audio;
    const onPlaying = () => setPlaying(true);
    const onPause   = () => setPlaying(false);
    const onEnd     = () => { setPlaying(false); setPosition(0); };
    const onTime    = () => {
      setPosition(audio.currentTime * 1000);
      if (isFinite(audio.duration)) setDuration(audio.duration * 1000);
    };
    audio.addEventListener("playing",    onPlaying);
    audio.addEventListener("pause",      onPause);
    audio.addEventListener("ended",      onEnd);
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.pause();
      audio.removeEventListener("playing",    onPlaying);
      audio.removeEventListener("pause",      onPause);
      audio.removeEventListener("ended",      onEnd);
      audio.removeEventListener("timeupdate", onTime);
      audioRef.current = null;
      setPlaying(false);
      setPosition(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  // Stop preview audio the moment the SDK device registers (avoid overlap)
  useEffect(() => {
    if (deviceId && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      setPosition(0);
    }
  }, [deviceId]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  async function handlePlayPause() {
    if (sdkLive && playerRef.current) {
      if (!sdkStartedRef.current) {
        // First click for this record — always start the album from scratch.
        // Using togglePlay() here would act on whatever the SDK was playing before
        // (e.g. the previous record), so we always send an explicit start command.
        if (tokenData?.access_token) {
          sdkStartedRef.current = true;
          const body = albumUri ? { context_uri: albumUri } : { uris: [trackUri!] };
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method:  "PUT",
            headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
            body:    JSON.stringify(body),
          }).catch(() => { sdkStartedRef.current = false; });
        }
      } else {
        // Already started this record — safe to toggle
        await playerRef.current.togglePlay();
      }
    } else if (audioRef.current) {
      // Preview fallback — state is driven by element events, so just call play/pause.
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (sdkLive && tokenData?.access_token && duration) {
      const ms = Math.round(ratio * duration);
      setPosition(ms);
      fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${ms}&device_id=${deviceId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }).catch(() => {});
    } else if (audioRef.current && duration) {
      audioRef.current.currentTime = (ratio * duration) / 1000;
      setPosition(ratio * duration);
    }
  }

  function handleVolume(e: React.MouseEvent<HTMLDivElement>) {
    const rect   = e.currentTarget.getBoundingClientRect();
    const newVol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(newVol);
    if (sdkLive && playerRef.current) playerRef.current.setVolume(newVol).catch(() => {});
    else if (audioRef.current)        audioRef.current.volume = newVol;
  }

  // Show as soon as we know something can play — no waiting for tokenData
  if (!useSDK && !previewUrl) return null;

  const eyebrow       = sdkLive ? "Now Playing" : "Preview";
  const nowPlayingText = sdkLive && nowTrack
    ? `${nowTrack.artist} — ${nowTrack.name}`
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
          textTransform: "uppercase", color: ORANGE, flexShrink: 0,
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
            onClick={() => playerRef.current?.previousTrack().catch(() => {})}
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
          onClick={handlePlayPause}
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
            onClick={() => playerRef.current?.nextTrack().catch(() => {})}
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
          onClick={handleSeek}
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

      {/* Volume */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0, width: "68px" }}>
        <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true">
          <polygon points="2,5 5,5 8,2 8,12 5,9 2,9" fill="#555"/>
          <path d="M10,4 q2,3 0,6" stroke="#555" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        </svg>
        <div
          onClick={handleVolume}
          style={{ flex: 1, height: "2px", background: "#e0e0da", position: "relative", cursor: "pointer" }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${volume * 100}%`, background: "#888" }} />
        </div>
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


// ─── Mode toggle ─────────────────────────────────────────────────────────────

type DigMode = "discover" | "explore" | "hallucinations";

function ModeToggle({ mode, onChange, disabled }: {
  mode:     DigMode;
  onChange: (m: DigMode) => void;
  disabled: boolean;
}) {
  const item = (m: DigMode, label: string) => {
    const active = mode === m;
    return (
      <button
        key={m}
        onClick={() => { if (!disabled && mode !== m) onChange(m); }}
        disabled={disabled}
        className="dig-mode-btn"
        style={{
          fontFamily: MONO,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "none",
          border: "none",
          borderBottom: `1.5px solid ${active ? ORANGE : "transparent"}`,
          padding: "6px 0",
          cursor: disabled || active ? "default" : "pointer",
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
      {item("discover",      "Discover · Outside Collection")}
      {item("explore",       "Explore · Inside Collection")}
      {item("hallucinations","Hallucinations · Take the Trip")}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function DigClient({ username, displayLabel, avatarUrl, collectionCount, listsCount }: Props) {
  const [recs,          setRecs]          = useState<Recommendation[] | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [idx,           setIdx]           = useState(0);
  const [mode,          setMode]          = useState<DigMode>("discover");
  const [wantlistAdded, setWantlistAdded] = useState<Set<string>>(new Set());
  const [digSpotify,    setDigSpotify]    = useState<{
    previewUrl: string | null; trackUri: string | null; albumUri: string | null; artist: string; album: string;
  } | null>(null);

  // Accumulates artists and full recs shown this session so the API can avoid
  // repeating the same artists, genres, and stylistic territory
  const shownArtists = useRef<string[]>([]);
  const shownRecs    = useRef<Array<{ artist: string; album: string }>>([]);

  // fetchKey drives all fetches. Incrementing `n` re-triggers the effect for
  // "dig again" without changing mode; swapping `mode` handles mode changes.
  const [fetchKey, setFetchKey] = useState<{ mode: DigMode; n: number }>({ mode: "discover", n: 0 });

  // Clear the compact player whenever we navigate to a new rec or reload
  useEffect(() => { setDigSpotify(null); }, [idx, mode, fetchKey]);

  // All setState calls inside the effect are in async callbacks, never synchronously
  // in the effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: fetchKey.mode, previousArtists: shownArtists.current, previousRecommendations: shownRecs.current }),
        });
        const data = await res.json();
        if (cancelled) return;
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

  function handleModeChange(newMode: DigMode) {
    shownArtists.current = [];
    shownRecs.current    = [];
    setMode(newMode);
    setLoading(true);
    setError(null);
    setRecs(null);
    setFetchKey({ mode: newMode, n: 0 });
  }

  function handleDigAgain() {
    setLoading(true);
    setError(null);
    setRecs(null);
    setFetchKey(prev => ({ ...prev, n: prev.n + 1 }));
  }

  function navigate(dir: -1 | 1) {
    const total = recs?.length ?? 1;
    setIdx(i => Math.min(Math.max(i + dir, 0), total - 1));
  }

  async function handleAddToWantlist(rec: Recommendation) {
    const key = `${rec.artist}||${rec.album}`;
    setWantlistAdded(prev => new Set(prev).add(key));
    const result = await addToWantlist(rec.artist, rec.album, rec.year);
    if (result?.error) {
      console.error(result.error);
      setWantlistAdded(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  const statNum: React.CSSProperties = {
    fontFamily: SERIF, fontSize: "24px", fontWeight: 400, color: "#0d0d0d",
  };
  const statLbl: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: "#aaaaaa", marginLeft: "9px",
  };

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
        }
      `}</style>

      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Main ── */}
      <main className="dig-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="dig-main-inner" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", padding: "0 40px 72px", overflow: "hidden" }}>

          <ModeToggle mode={mode} onChange={handleModeChange} disabled={loading} />

          {loading && <RecordSpinner />}

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
              <SleeveCard
                key={`${idx}-${mode}`}
                rec={recs[idx]}
                mode={mode}
                onAddToWantlist={() => handleAddToWantlist(recs[idx])}
                wantlistAdded={wantlistAdded.has(`${recs[idx].artist}||${recs[idx].album}`)}
                onPreviewReady={setDigSpotify}
              />
              <NavBar idx={idx} total={recs.length} onNav={navigate} onDigAgain={handleDigAgain} />
              {digSpotify && (digSpotify.previewUrl || digSpotify.albumUri) && (
                <DigCompactPlayer
                  previewUrl={digSpotify.previewUrl}
                  albumUri={digSpotify.albumUri}
                  trackUri={digSpotify.trackUri}
                  artist={digSpotify.artist}
                  album={digSpotify.album}
                />
              )}
            </>
          )}

        </div>
      </main>

    </div>
  );
}
