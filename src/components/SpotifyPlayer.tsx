"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const RULE          = "#e0e0da";
const INK           = "#0a0a0a";
const SPOTIFY_GREEN = "#1DB954";

// ─── Fresh token helper ───────────────────────────────────────────────────────
// Module-level cache: avoids a round-trip on every button click while ensuring
// we never hand a stale token to the Spotify API.
// The server already refreshes automatically when the token is within 60s of
// expiry, so caching for 50 minutes is always safe.
let _spotifyToken: string | null = null;
let _spotifyTokenExpiry           = 0;

export async function getFreshSpotifyToken(): Promise<string | null> {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;
  try {
    const res  = await fetch("/api/spotify/token");
    const data = await res.json() as { connected: boolean; access_token?: string; expires_at?: number };
    _spotifyToken = data.access_token ?? null;
    _spotifyTokenExpiry = data.expires_at
      ? data.expires_at - 60_000
      : Date.now() + 50 * 60 * 1000;
    return _spotifyToken;
  } catch {
    return null;
  }
}

export function bustSpotifyTokenCache() {
  _spotifyToken       = null;
  _spotifyTokenExpiry = 0;
}

// Returns null on success, error status code on failure.
async function sendSpotifyPlay(deviceId: string, body: object): Promise<number | null> {
  const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await getFreshSpotifyToken();
    if (!token) return -1;
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method:  "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
    } catch { return 0; }
    if (res.status === 204 || res.ok) return null;
    if (res.status === 401) {
      bustSpotifyTokenCache();
      continue;
    }
    if (res.status === 404 && attempt < 2) {
      await new Promise(r => setTimeout(r, 600 + attempt * 500));
      continue;
    }
    return res.status;
  }
  return -1;
}

// ─── SDK singleton ────────────────────────────────────────────────────────────

let _sdkLoaded = false;
const _sdkCallbacks: Array<() => void> = [];

function ensureSDK(onReady: () => void) {
  if (_sdkLoaded) { onReady(); return; }
  _sdkCallbacks.push(onReady);
  if (typeof window === "undefined") return;
  // The SDK script may have been injected by DigCompactPlayer on a previous
  // page — in that case window.Spotify already exists but _sdkLoaded is false.
  if (window.Spotify) {
    _sdkLoaded = true;
    _sdkCallbacks.splice(0).forEach(cb => cb());
    return;
  }
  if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
    window.onSpotifyWebPlaybackSDKReady = () => {
      _sdkLoaded = true;
      _sdkCallbacks.splice(0).forEach(cb => cb());
    };
    const s = document.createElement("script");
    s.src   = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(s);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifySDKPlayer;
    };
  }
}

interface SpotifySDKPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: unknown) => void): boolean;
  togglePlay(): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  setVolume(v: number): Promise<void>;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
}

interface SpotifyPlaybackState {
  paused:       boolean;
  position:     number;
  duration:     number;
  track_window: {
    current_track: {
      name:    string;
      artists: Array<{ name: string }>;
    };
  };
}

// access_token is intentionally excluded — never stored in React state to
// prevent stale closures. All callers use getFreshSpotifyToken() instead.
interface TokenData {
  connected: boolean;
  product?:  string;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconPlay() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><polygon points="3,1 3,15 14,8" fill="currentColor"/></svg>;
}
function IconPause() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="1" width="4.5" height="14" fill="currentColor"/><rect x="9.5" y="1" width="4.5" height="14" fill="currentColor"/></svg>;
}
function IconPrev() {
  return <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><polygon points="19,3 19,19 8,11" fill="currentColor"/><rect x="3" y="3" width="3" height="16" fill="currentColor"/></svg>;
}
function IconNext() {
  return <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><polygon points="3,3 3,19 14,11" fill="currentColor"/><rect x="16" y="3" width="3" height="16" fill="currentColor"/></svg>;
}
function IconShuffle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2,5 h4 l6,8 h4 M16,5 h-4 M16,13 h-4 M12,3 l4,2 -4,2 M12,11 l4,2 -4,2 M2,13 h3 l2,-2"/>
    </svg>
  );
}
function IconRepeat() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4,6 h10 a1,1 0 0,1 1,1 v3 M14,12 H4 a1,1 0 0,1 -1,-1 v-3 M2,4 l2,2 -2,2 M16,10 l-2,2 2,2"/>
    </svg>
  );
}
function IconVolume() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <polygon points="2,5 5,5 8,2 8,12 5,9 2,9" fill="currentColor" stroke="none" opacity="0.5"/>
      <path d="M10,4 q2,3 0,6" opacity="0.5"/>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpotifyPlayerProps {
  mode:             "collection" | "dig";
  spotifyUri?:      string;
  previewUrl?:      string;
  spotifyTrackUri?: string;
  // For the Now Playing / Preview label in dig mode
  artist?:          string;
  albumTitle?:      string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpotifyPlayer({
  mode, spotifyUri, previewUrl, spotifyTrackUri, artist, albumTitle,
}: SpotifyPlayerProps) {
  const [tokenData,    setTokenData]    = useState<TokenData | null>(null);
  const [deviceId,     setDeviceId]     = useState<string | null>(null);
  const [playing,      setPlaying]      = useState(false);
  const [position,     setPosition]     = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(0.8);
  const [sdkReady,     setSdkReady]     = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ artist: string; name: string } | null>(null);
  const [playError,    setPlayError]    = useState<number | null>(null);

  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPremium  = !!(tokenData?.connected && tokenData.product === "premium");
  const useSDK     = isPremium && (mode === "collection" ? !!spotifyUri : !!spotifyTrackUri);
  const usePreview = !useSDK && !!previewUrl;

  // ── Determine Premium status on mount ────────────────────────────────────
  // Only stores connected + product — no access_token in state.
  // The token itself lives in the module-level cache (getFreshSpotifyToken).
  useEffect(() => {
    fetch("/api/spotify/token")
      .then(r => r.json() as Promise<{ connected: boolean; access_token?: string; product?: string; expires_at?: number }>)
      .then(data => {
        // Seed the module-level cache using the real server-side expiry
        if (data.access_token) {
          _spotifyToken       = data.access_token;
          _spotifyTokenExpiry = data.expires_at
            ? data.expires_at - 60_000
            : Date.now() + 50 * 60 * 1000;
        }
        setTokenData({ connected: data.connected, product: data.product });
      })
      .catch(() => setTokenData({ connected: false }));
  }, []);

  // ── Load SDK when Premium ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isPremium) return;
    if (_sdkLoaded) { setSdkReady(true); return; }
    ensureSDK(() => setSdkReady(true));
  }, [isPremium]);

  // ── Initialize SDK player ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sdkReady || !isPremium || playerRef.current) return;

    const player = new window.Spotify.Player({
      name: "rekōdo",
      // SDK calls this whenever it needs a token. Retry up to 3 times so a
      // transient network hiccup doesn't permanently break the player.
      getOAuthToken: async (cb) => {
        for (let i = 0; i < 3; i++) {
          const token = await getFreshSpotifyToken();
          if (token) { cb(token); return; }
          bustSpotifyTokenCache();
          await new Promise(r => setTimeout(r, 500));
        }
        cb("");
      },
      volume: 0.8,
    });

    player.addListener("ready", (data) => {
      setDeviceId((data as { device_id: string }).device_id);
    });

    player.addListener("player_state_changed", (state) => {
      if (!state) return;
      const s = state as SpotifyPlaybackState;
      setPlaying(!s.paused);
      setPosition(s.position);
      setDuration(s.duration);
      const t = s.track_window?.current_track;
      if (t) setCurrentTrack({
        artist: t.artists?.[0]?.name ?? "",
        name:   t.name ?? "",
      });
    });

    // Clear the stale deviceId so play is disabled while reconnecting.
    // Retry connect up to 4 times with back-off — a single attempt often
    // fails if the token fetch is still in flight.
    player.addListener("not_ready", () => {
      setDeviceId(null);
      let attempts = 0;
      const tryConnect = () => {
        if (attempts >= 4) return;
        attempts++;
        player.connect().catch(() => {});
        setTimeout(tryConnect, 1500 * attempts);
      };
      setTimeout(tryConnect, 1000);
    });

    player.connect();
    playerRef.current = player;

    return () => {
      player.disconnect();
      playerRef.current = null;
    };
  }, [sdkReady, isPremium]);

  // ── Reset UI state when the album changes (SpotifyPlayer stays mounted) ──
  useEffect(() => {
    setCurrentTrack(null);
    setPosition(0);
    setPlaying(false);
    setPlayError(null);
  }, [spotifyUri]);

  // ── Keep SDK alive across tab switches ────────────────────────────────────
  useEffect(() => {
    if (!sdkReady) return;
    const onVisible = () => {
      if (!document.hidden && playerRef.current) {
        playerRef.current.connect().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sdkReady]);

  // ── Poll position while SDK playing ───────────────────────────────────────
  useEffect(() => {
    if (!playing || !playerRef.current) return;
    pollRef.current = setInterval(async () => {
      const s = await playerRef.current?.getCurrentState();
      if (s) { setPosition(s.position); setDuration(s.duration); }
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [playing]);

  // ── Preview audio element ─────────────────────────────────────────────────
  // Dep array uses only previewUrl (not usePreview) so the audio element is not
  // destroyed when the SDK becomes live — avoids a silent kill of in-progress audio.
  // State is driven by element events rather than the play() promise to avoid the
  // "press play twice" bug caused by buffering or silent promise rejection.
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
      setDuration(isFinite(audio.duration) ? audio.duration * 1000 : 30_000);
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  // ── Play / pause ──────────────────────────────────────────────────────────
  // `playing` (from player_state_changed) is the truth: if true we're already
  // playing so we pause; if false we always send an explicit play command for the
  // current URI — no guessing about which album the SDK has loaded.
  // Always fetches a fresh token so a cached/expired token never blocks playback.
  const handlePlayPause = useCallback(async () => {
    if (useSDK && playerRef.current) {
      if (playing) {
        await playerRef.current.togglePlay().catch(() => {});
      } else {
        if (!deviceId) return;
        const body = mode === "collection" && spotifyUri
          ? { context_uri: spotifyUri }
          : spotifyTrackUri
            ? { uris: [spotifyTrackUri] }
            : null;
        if (!body) return;
        setPlayError(null);
        const err = await sendSpotifyPlay(deviceId, body);
        if (err !== null) setPlayError(err);
      }
    } else if (audioRef.current) {
      if (playing) audioRef.current.pause();
      else audioRef.current.play().catch(() => {});
    }
  }, [useSDK, playing, mode, spotifyUri, spotifyTrackUri, deviceId]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (useSDK) {
      const ms    = Math.round(pct * duration);
      const token = await getFreshSpotifyToken();
      if (!token) return;
      setPosition(ms);
      fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${ms}${deviceId ? `&device_id=${deviceId}` : ""}`, {
        method:  "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.currentTime = (pct * duration) / 1000;
      setPosition(pct * duration);
    }
  }, [useSDK, duration, deviceId]);

  // ── Volume (vertical — click top=loud, bottom=quiet) ─────────────────────
  const handleVolume = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect   = e.currentTarget.getBoundingClientRect();
    const newVol = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setVolume(newVol);
    if (useSDK && playerRef.current) playerRef.current.setVolume(newVol).catch(() => {});
    else if (audioRef.current)       audioRef.current.volume = newVol;
  }, [useSDK]);

  // ── Guard renders ─────────────────────────────────────────────────────────
  if (tokenData === null) return null;
  if (mode === "collection" && !tokenData.connected) return null;
  if (!useSDK && !usePreview) return null;

  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  function fmt(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // Now Playing strip text
  const isPreviewMode = !useSDK && usePreview;
  const sdkConnecting = useSDK && !deviceId; // SDK recognised as Premium but not yet registered
  const playDisabled  = sdkConnecting;
  const eyebrow        = sdkConnecting ? "Connecting" : isPreviewMode ? "Preview" : "Now Playing";

  let nowPlayingText = "";
  if (sdkConnecting) {
    nowPlayingText = "Connecting to Spotify…";
  } else if (useSDK && currentTrack) {
    nowPlayingText = `${currentTrack.artist} — ${currentTrack.name}`;
  } else if (isPreviewMode && artist && albumTitle) {
    nowPlayingText = `${artist} — ${albumTitle} (30s)`;
  } else if (artist && albumTitle) {
    nowPlayingText = `${artist} — ${albumTitle}`;
  }

  const sourceLabel = useSDK ? "Streaming via" : "30s preview via";

  const errorLabel = playError === null ? null
    : playError === 403 ? "Spotify: Premium required or not available in your region (403)"
    : playError === 401 ? "Spotify: Auth failed — try reconnecting Spotify in Settings (401)"
    : playError === 429 ? "Spotify: Rate limited — wait a moment and try again (429)"
    : playError ===   0 ? "Network error — check your connection"
    : playError ===  -1 ? "Could not get Spotify token — try reconnecting in Settings"
    : `Spotify error ${playError}`;

  return (
    <div style={{ borderBottom: `1px solid ${RULE}` }}>

      {/* ── Now Playing strip ── */}
      <div style={{
        padding: "0.6rem 0.9rem",
        borderBottom: `1px solid ${RULE}`,
        display: "flex", flexDirection: "column", gap: "3px",
      }}>
        <span style={{
          fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.12em",
          textTransform: "uppercase", color: sdkConnecting ? "#aaaaaa" : ORANGE,
        }}>
          {eyebrow}
        </span>
        {nowPlayingText && (
          <span style={{
            fontFamily: MONO, fontSize: "0.58rem", color: sdkConnecting ? "#aaaaaa" : INK,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {nowPlayingText}
          </span>
        )}
      </div>

      {/* ── Error / reconnect strip ── */}
      {(errorLabel || sdkConnecting) && (
        <div style={{
          padding: "6px 12px", background: "#fff8f5",
          borderBottom: `1px solid ${RULE}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ fontFamily: MONO, fontSize: "0.48rem", color: "#cc3300", letterSpacing: "0.04em" }}>
            {errorLabel ?? "Connecting to Spotify…"}
          </span>
          {sdkConnecting && playerRef.current && (
            <button
              onClick={() => playerRef.current?.connect().catch(() => {})}
              style={{
                fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.08em",
                textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`,
                padding: "3px 8px", cursor: "pointer", color: INK, flexShrink: 0,
              }}
            >
              Reconnect
            </button>
          )}
        </div>
      )}

      {/* ── Controls + vertical volume ── */}
      <div style={{ padding: "0.75rem 0.9rem", display: "flex", alignItems: "center" }}>

        {/* Centred transport controls */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <CtrlBtn disabled aria-label="Shuffle"><IconShuffle /></CtrlBtn>

          <CtrlBtn disabled={!currentTrack} onClick={() => playerRef.current?.previousTrack().catch(() => {})} aria-label="Previous">
            <IconPrev />
          </CtrlBtn>

          <button
            onClick={playDisabled ? undefined : handlePlayPause}
            aria-label={playing ? "Pause" : "Play"}
            disabled={playDisabled}
            style={{
              width: "44px", height: "44px", flexShrink: 0,
              background: playDisabled ? "#cccccc" : INK,
              color: "#ffffff", border: "none",
              cursor: playDisabled ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: playDisabled ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!playDisabled) (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
            onMouseLeave={e => { if (!playDisabled) (e.currentTarget as HTMLButtonElement).style.background = INK; }}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>

          <CtrlBtn disabled={!currentTrack} onClick={() => playerRef.current?.nextTrack().catch(() => {})} aria-label="Next">
            <IconNext />
          </CtrlBtn>

          <CtrlBtn disabled aria-label="Repeat"><IconRepeat /></CtrlBtn>
        </div>

        {/* Vertical volume on right */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", paddingLeft: "14px" }}>
          <span style={{ color: "#555", display: "flex" }}><IconVolume /></span>
          <div
            onClick={handleVolume}
            style={{ width: "2px", height: "52px", background: RULE, position: "relative", cursor: "pointer" }}
          >
            <div style={{
              position: "absolute", bottom: 0, left: 0,
              width: "100%", height: `${volume * 100}%`,
              background: "#666",
            }} />
          </div>
        </div>
      </div>

      {/* ── Progress (bottom) ── */}
      <div style={{ padding: "0.5rem 0.9rem 0.6rem" }}>
        <div
          onClick={handleSeek}
          style={{
            position: "relative", height: "2px", background: RULE,
            cursor: "pointer", marginBottom: "5px",
          }}
        >
          <div style={{
            position: "absolute", left: 0, top: 0,
            height: "100%", width: `${progressPct}%`,
            background: ORANGE, transition: playing ? "none" : undefined,
          }} />
          {duration > 0 && (
            <div style={{
              position:  "absolute", top: "50%", left: `${progressPct}%`,
              transform: "translate(-50%, -50%)",
              width: "8px", height: "8px", borderRadius: "50%", background: ORANGE,
            }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.06em", color: "#aaaaaa" }}>
            {fmt(position)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.06em", color: "#aaaaaa" }}>
            {duration > 0 ? fmt(duration) : "--:--"}
          </span>
        </div>
      </div>

      {/* ── Source label ── */}
      <div style={{ padding: "0.5rem 0.9rem", display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#aaaaaa" }}>
          {sourceLabel}
        </span>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SPOTIFY_GREEN, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: "0.48rem", color: SPOTIFY_GREEN, letterSpacing: "0.04em" }}>Spotify</span>
      </div>

    </div>
  );
}

// ─── Mini control button ──────────────────────────────────────────────────────

function CtrlBtn({
  children, disabled, onClick, "aria-label": ariaLabel,
}: {
  children:     React.ReactNode;
  disabled?:    boolean;
  onClick?:     () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        background: "none", border: "none",
        cursor:  disabled ? "default" : "pointer",
        padding: "4px",
        color:   INK, opacity: disabled ? 0.25 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
