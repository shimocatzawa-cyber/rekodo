"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const RULE          = "#e0e0da";
const INK           = "#0a0a0a";
const SPOTIFY_GREEN = "#1DB954";

// ─── Fresh token helper ───────────────────────────────────────────────────────
// Always fetches a live token so play commands never fail with an expired credential.
async function getFreshSpotifyToken(): Promise<string | null> {
  try {
    const res  = await fetch("/api/spotify/token");
    const data = await res.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// Send a play command and retry on 404 (device not yet registered server-side).
async function sendSpotifyPlay(token: string, deviceId: string, body: object): Promise<void> {
  const url  = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
  const opts = {
    method:  "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response | null = null;
    try { res = await fetch(url, opts); } catch { return; }
    if (res.status === 204 || res.ok) return;
    if (res.status === 404 && attempt < 2) {
      await new Promise(r => setTimeout(r, 600 + attempt * 500));
      continue;
    }
    return;
  }
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

interface TokenData {
  connected:     boolean;
  access_token?: string;
  product?:      string;
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

  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPremium  = !!(tokenData?.connected && tokenData.product === "premium");
  const useSDK     = isPremium && (mode === "collection" ? !!spotifyUri : !!spotifyTrackUri);
  const usePreview = !useSDK && !!previewUrl;

  // ── Fetch token on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/spotify/token")
      .then(r => r.json() as Promise<TokenData>)
      .then(setTokenData)
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
    if (!sdkReady || !tokenData?.access_token || playerRef.current) return;

    const player = new window.Spotify.Player({
      name:          "rekōdo",
      getOAuthToken: async (cb) => {
        try {
          const res  = await fetch("/api/spotify/token");
          const data = await res.json() as TokenData;
          // Always call cb — passing empty string tells the SDK the token is
          // unavailable, which causes a graceful disconnect rather than hanging.
          cb(data.access_token ?? "");
        } catch {
          cb("");
        }
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

    // Reconnect if the browser kills the SDK connection (e.g. tab throttling)
    player.addListener("not_ready", () => {
      setTimeout(() => { player.connect().catch(() => {}); }, 1000);
    });

    player.connect();
    playerRef.current = player;

    return () => {
      player.disconnect();
      playerRef.current = null;
    };
  }, [sdkReady, tokenData?.access_token]);

  // ── Reset UI state when the album changes (SpotifyPlayer stays mounted) ──
  useEffect(() => {
    setCurrentTrack(null);
    setPosition(0);
    setPlaying(false);
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
        const token = await getFreshSpotifyToken();
        if (!token) return;
        await sendSpotifyPlay(token, deviceId, body);
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
  const eyebrow       = isPreviewMode ? "Preview" : "Now Playing";

  let nowPlayingText = "";
  if (useSDK && currentTrack) {
    nowPlayingText = `${currentTrack.artist} — ${currentTrack.name}`;
  } else if (isPreviewMode && artist && albumTitle) {
    nowPlayingText = `${artist} — ${albumTitle} (30s)`;
  } else if (artist && albumTitle) {
    nowPlayingText = `${artist} — ${albumTitle}`;
  }

  const sourceLabel = useSDK ? "Streaming via" : "30s preview via";

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
          textTransform: "uppercase", color: ORANGE,
        }}>
          {eyebrow}
        </span>
        {nowPlayingText && (
          <span style={{
            fontFamily: MONO, fontSize: "0.58rem", color: INK,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {nowPlayingText}
          </span>
        )}
      </div>

      {/* ── Controls + vertical volume ── */}
      <div style={{ padding: "0.75rem 0.9rem", display: "flex", alignItems: "center" }}>

        {/* Centred transport controls */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <CtrlBtn disabled aria-label="Shuffle"><IconShuffle /></CtrlBtn>

          <CtrlBtn disabled={!currentTrack} onClick={() => playerRef.current?.previousTrack().catch(() => {})} aria-label="Previous">
            <IconPrev />
          </CtrlBtn>

          <button
            onClick={handlePlayPause}
            aria-label={playing ? "Pause" : "Play"}
            style={{
              width: "44px", height: "44px", flexShrink: 0,
              background: INK, color: "#ffffff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
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
