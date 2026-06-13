"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const RULE          = "#e0e0da";
const INK           = "#0a0a0a";
const SPOTIFY_GREEN = "#1DB954";

// ─── SDK singleton ────────────────────────────────────────────────────────────

let _sdkLoaded = false;
const _sdkCallbacks: Array<() => void> = [];

function ensureSDK(onReady: () => void) {
  if (_sdkLoaded) { onReady(); return; }
  _sdkCallbacks.push(onReady);
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
  paused:   boolean;
  position: number;
  duration: number;
}

interface TokenData {
  connected:    boolean;
  access_token?: string;
  product?:      string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpotifyPlayerProps {
  mode:             "collection" | "dig";
  spotifyUri?:      string;
  previewUrl?:      string;
  spotifyTrackUri?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpotifyPlayer({
  mode, spotifyUri, previewUrl, spotifyTrackUri,
}: SpotifyPlayerProps) {
  const [tokenData,  setTokenData]  = useState<TokenData | null>(null);
  const [deviceId,   setDeviceId]   = useState<string | null>(null);
  const [playing,    setPlaying]    = useState(false);
  const [position,   setPosition]   = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [volume,     setVolume]     = useState(0.8);
  const [sdkReady,   setSdkReady]   = useState(false);

  const playerRef  = useRef<SpotifySDKPlayer | null>(null);
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const isPremium = !!(tokenData?.connected && tokenData.product === "premium");
  const useSDK    = isPremium && (mode === "collection" ? !!spotifyUri : !!spotifyTrackUri);
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
        const res  = await fetch("/api/spotify/token");
        const data = await res.json() as TokenData;
        if (data.access_token) cb(data.access_token);
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
    });

    player.connect();
    playerRef.current = player;

    return () => {
      player.disconnect();
      playerRef.current = null;
    };
  }, [sdkReady, tokenData?.access_token]);

  // ── Auto-play in collection mode when URI + device ready ──────────────────
  useEffect(() => {
    if (mode !== "collection" || !deviceId || !tokenData?.access_token || !spotifyUri) return;
    startedRef.current = true;
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ context_uri: spotifyUri }),
    }).catch(() => {});
  }, [mode, deviceId, spotifyUri, tokenData?.access_token]);

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
  useEffect(() => {
    if (!usePreview || !previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.volume = volume;
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      setPosition(audio.currentTime * 1000);
      setDuration(isFinite(audio.duration) ? audio.duration * 1000 : 30_000);
    });
    audio.addEventListener("ended", () => setPlaying(false));
    return () => { audio.pause(); audioRef.current = null; setPlaying(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, usePreview]);

  // ── Play / pause ──────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    if (useSDK && playerRef.current) {
      if (!startedRef.current && mode === "dig" && spotifyTrackUri && deviceId && tokenData?.access_token) {
        startedRef.current = true;
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method:  "PUT",
          headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ uris: [spotifyTrackUri] }),
        });
      } else {
        await playerRef.current.togglePlay();
      }
    } else if (usePreview && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        await audioRef.current.play();
        setPlaying(true);
      }
    }
  }, [useSDK, usePreview, playing, mode, spotifyTrackUri, deviceId, tokenData?.access_token]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!useSDK || !duration || !tokenData?.access_token) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ms   = Math.round(pct * duration);
    setPosition(ms);
    fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${ms}${deviceId ? `&device_id=${deviceId}` : ""}`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).catch(() => {});
  }, [useSDK, duration, tokenData?.access_token, deviceId]);

  // ── Volume ────────────────────────────────────────────────────────────────
  const handleVolume = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect   = e.currentTarget.getBoundingClientRect();
    const newVol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
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

  const sourceLabel = useSDK ? "Streaming via" : "30s preview via";

  return (
    <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${RULE}` }}>

      {/* Progress */}
      <div
        onClick={useSDK ? handleSeek : undefined}
        style={{
          position: "relative", height: "1px", background: RULE,
          cursor: useSDK ? "pointer" : "default", marginBottom: "6px",
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
            width: "5px", height: "5px", borderRadius: "50%", background: ORANGE,
          }} />
        )}
      </div>

      {/* Times */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.06em", color: "#aaaaaa" }}>
          {fmt(position)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.06em", color: "#aaaaaa" }}>
          {duration > 0 ? fmt(duration) : "--:--"}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginBottom: "10px" }}>
        <CtrlBtn disabled style={{ opacity: 0.25 }}>⇄</CtrlBtn>
        <CtrlBtn disabled={!useSDK} onClick={() => playerRef.current?.previousTrack().catch(() => {})}>⏮</CtrlBtn>

        <button
          onClick={handlePlayPause}
          style={{
            width: "30px", height: "30px", flexShrink: 0,
            background: INK, color: "#ffffff", border: "none", cursor: "pointer",
            fontFamily: MONO, fontSize: "11px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
        >
          {playing ? "‖" : "▶"}
        </button>

        <CtrlBtn disabled={!useSDK} onClick={() => playerRef.current?.nextTrack().catch(() => {})}>⏭</CtrlBtn>
        <CtrlBtn disabled style={{ opacity: 0.25 }}>↺</CtrlBtn>
      </div>

      {/* Volume */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", flexShrink: 0 }}>🔈</span>
        <div
          onClick={handleVolume}
          style={{ flex: 1, height: "1px", background: RULE, position: "relative", cursor: "pointer" }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${volume * 100}%`, background: "#888" }} />
        </div>
      </div>

      {/* Source label */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.04em", color: "#aaaaaa" }}>
          {sourceLabel}
        </span>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: SPOTIFY_GREEN, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: "8px", color: SPOTIFY_GREEN, letterSpacing: "0.04em" }}>Spotify</span>
      </div>

    </div>
  );
}

// ─── Mini control button ──────────────────────────────────────────────────────

function CtrlBtn({
  children, disabled, onClick, style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?:  () => void;
  style?:    React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none", border: "none",
        cursor:     disabled ? "default" : "pointer",
        fontFamily: MONO, fontSize: "10px", padding: "4px",
        color:      INK, opacity: disabled ? 0.25 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
