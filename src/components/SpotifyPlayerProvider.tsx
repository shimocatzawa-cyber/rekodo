"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

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

// Proxies through our server so the Spotify token never touches the browser.
// Returns null on success, error status code on failure.
async function sendSpotifyPlay(deviceId: string, body: object): Promise<number | null> {
  try {
    const res = await fetch("/api/spotify/play", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ deviceId, body }),
    });
    if (res.ok) return null;
    const data = await res.json() as { spotifyStatus?: number };
    return data.spotifyStatus ?? res.status;
  } catch {
    return 0;
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
  // Chain onto any existing global callback (may be DigCompactPlayer's) so
  // neither set of subscribers is silently dropped when both load on the same page.
  const fire = () => { _sdkLoaded = true; _sdkCallbacks.splice(0).forEach(cb => cb()); };
  const prev = window.onSpotifyWebPlaybackSDKReady;
  const chained = prev ? () => { prev(); fire(); } : fire;
  if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
    window.onSpotifyWebPlaybackSDKReady = chained;
    const s = document.createElement("script");
    s.src   = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(s);
  } else {
    // Script already in DOM — just chain the callback.
    window.onSpotifyWebPlaybackSDKReady = chained;
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
  // Resumes the internal AudioContext — must be called within a user gesture.
  activateElement(): void;
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

export interface ActiveSource {
  mode:            "collection" | "dig";
  spotifyUri?:      string;
  spotifyTrackUri?: string;
  /** Spotify album URI for dig mode — used as context_uri so Spotify queues
   *  the full album, which is the same behaviour as the pre-refactor player. */
  albumUri?:        string;
  previewUrl?:      string;
  artist?:          string;
  albumTitle?:      string;
  /** Called by the Provider when the current track/preview finishes naturally
   *  (not on user-initiated pause). Dig page uses this to advance to the next rec. */
  onEnded?:         () => void;
}

interface SpotifyPlaybackContextValue {
  tokenData:     TokenData | null;
  deviceId:      string | null;
  playing:       boolean;
  position:      number;
  duration:      number;
  volume:        number;
  currentTrack:  { artist: string; name: string } | null;
  playError:     number | null;
  useSDK:        boolean;
  usePreview:    boolean;
  setActiveSource:  (source: ActiveSource) => void;
  handlePlayPause:  () => Promise<void>;
  handleSeek:       (pct: number) => Promise<void>;
  handleVolume:     (vol: number) => void;
  previousTrack:    () => void;
  nextTrack:        () => void;
  reconnect:        () => void;
}

const SpotifyPlaybackContext = createContext<SpotifyPlaybackContextValue | null>(null);

export function useSpotifyPlayback(): SpotifyPlaybackContextValue {
  const ctx = useContext(SpotifyPlaybackContext);
  if (!ctx) throw new Error("useSpotifyPlayback must be used within SpotifyPlayerProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
// Mounted once at the root layout so the underlying Spotify Connect device and
// its WebSocket connection survive client-side route navigation — playback
// keeps going in the background when the user leaves /collection, and there's
// no reconnect race (and resulting spurious 401) when they come back.

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const [tokenData,    setTokenData]    = useState<TokenData | null>(null);
  const [deviceId,     setDeviceId]     = useState<string | null>(null);
  const [playing,      setPlaying]      = useState(false);
  const [position,     setPosition]     = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(0.8);
  const [sdkReady,     setSdkReady]     = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ artist: string; name: string } | null>(null);
  const [playError,    setPlayError]    = useState<number | null>(null);
  const [source,       setSource]       = useState<ActiveSource | null>(null);

  const playerRef  = useRef<SpotifySDKPlayer | null>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceKeyRef = useRef<string | null>(null);
  // Always-current reference to source so SDK event listeners (set up once on
  // mount) can read the latest onEnded callback without stale closure issues.
  const sourceRef    = useRef<ActiveSource | null>(null);
  // Tracks whether the SDK was playing near the end of its track, so
  // player_state_changed can distinguish a natural end from a user pause.
  const nearEndRef   = useRef(false);

  const isPremium  = !!(tokenData?.connected && tokenData.product === "premium");
  const useSDK     = isPremium && (source?.mode === "collection" ? !!source.spotifyUri : !!(source?.albumUri ?? source?.spotifyTrackUri));
  const usePreview = !useSDK && !!source?.previewUrl;

  // ── Determine Premium status once, for the lifetime of the app session ───
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

  // ── Initialize SDK player (once — this provider never unmounts on navigation) ─
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
      setPlayError(null);
    });

    player.addListener("authentication_error", (data) => {
      console.error("[rekōdo] Spotify auth error:", data);
      // Bust the cache so getOAuthToken forces a fresh server-side refresh,
      // then reconnect silently. Only surface an error banner if the reconnect
      // itself fails — most auth errors self-heal within a second.
      bustSpotifyTokenCache();
      setTimeout(() => {
        player.connect()
          .then(success => { if (!success) setPlayError(401); })
          .catch(() => setPlayError(401));
      }, 800);
    });

    player.addListener("account_error", (data) => {
      console.error("[rekōdo] Spotify account error:", data);
      setPlayError(403);
    });

    player.addListener("playback_error", (data) => {
      console.error("[rekōdo] Spotify playback error:", data);
    });

    player.addListener("player_state_changed", (state) => {
      if (!state) return;
      // A real state update proves the connection is alive and authenticated —
      // clear any stale error banner from an earlier disconnect/auth hiccup.
      setPlayError(null);
      const s = state as SpotifyPlaybackState;
      const isPlaying = !s.paused;
      setPlaying(isPlaying);
      setPosition(s.position);
      setDuration(s.duration);
      const t = s.track_window?.current_track;
      if (t) setCurrentTrack({
        artist: t.artists?.[0]?.name ?? "",
        name:   t.name ?? "",
      });
      // Track whether we were near the end while playing, so we can detect
      // a natural track end (paused at position 0 after being near-end) vs
      // a user-initiated pause. Only fires for dig mode so collection playback
      // (which has its own queue) isn't affected.
      if (isPlaying && s.duration > 0 && (s.duration - s.position) < 2000) {
        nearEndRef.current = true;
      }
      if (s.paused && s.position === 0 && nearEndRef.current) {
        nearEndRef.current = false;
        if (sourceRef.current?.mode === "dig") {
          sourceRef.current.onEnded?.();
        }
      }
      if (!s.paused) {
        // Reset near-end flag when actively playing (e.g. user seeked back)
        if (s.duration > 0 && (s.duration - s.position) >= 2000) {
          nearEndRef.current = false;
        }
      }
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

  // ── Reset transient UI state only when the active album/track actually changes ──
  // (not on every SpotifyPlayer UI mount/unmount as pages are navigated to/from).
  useEffect(() => {
    const key = source?.mode === "collection" ? (source.spotifyUri ?? null) : (source?.albumUri ?? source?.spotifyTrackUri ?? null);
    if (key === sourceKeyRef.current) return;
    sourceKeyRef.current = key;
    setCurrentTrack(null);
    setPosition(0);
    setPlaying(false);
    setPlayError(null);
  }, [source]);

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
  // Keyed on the preview URL itself (not usePreview) so it isn't torn down the
  // moment the SDK becomes live, and survives page navigation like the SDK does.
  useEffect(() => {
    const previewUrl = source?.previewUrl;
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.preload = "auto";
    audio.volume  = volume;
    audioRef.current = audio;
    const onPlaying = () => setPlaying(true);
    const onPause   = () => setPlaying(false);
    const onEnd     = () => { setPlaying(false); setPosition(0); sourceRef.current?.onEnded?.(); };
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
  }, [source?.previewUrl]);

  // ── Play / pause ──────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    if (useSDK && playerRef.current) {
      if (playing) {
        await playerRef.current.togglePlay().catch(() => {});
      } else {
        if (!deviceId) return;
        // Unlock the SDK's internal AudioContext while still in the user-gesture
        // call stack. Browsers suspend AudioContext created outside a gesture
        // (i.e. on connect()), so without this the play command arrives but no
        // audio comes out.
        try { playerRef.current.activateElement(); } catch { /* SDK < activateElement */ }
        const body = source?.mode === "collection" && source.spotifyUri
          ? { context_uri: source.spotifyUri }
          : source?.albumUri
            ? { context_uri: source.albumUri }
            : source?.spotifyTrackUri
              ? { uris: [source.spotifyTrackUri] }
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
  }, [useSDK, playing, source, deviceId]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback(async (pct: number) => {
    if (!duration) return;
    if (useSDK) {
      const ms = Math.round(pct * duration);
      setPosition(ms);
      fetch("/api/spotify/seek", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ positionMs: ms, deviceId }),
      }).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.currentTime = (pct * duration) / 1000;
      setPosition(pct * duration);
    }
  }, [useSDK, duration, deviceId]);

  // ── Volume ────────────────────────────────────────────────────────────────
  const handleVolume = useCallback((newVol: number) => {
    setVolume(newVol);
    if (useSDK && playerRef.current) playerRef.current.setVolume(newVol).catch(() => {});
    else if (audioRef.current)       audioRef.current.volume = newVol;
  }, [useSDK]);

  const previousTrack = useCallback(() => {
    playerRef.current?.previousTrack().catch(() => {});
  }, []);

  const nextTrack = useCallback(() => {
    playerRef.current?.nextTrack().catch(() => {});
  }, []);

  const reconnect = useCallback(() => {
    playerRef.current?.connect().catch(() => {});
  }, []);

  const setActiveSource = useCallback((next: ActiveSource) => {
    sourceRef.current = next;
    setSource(next);
  }, []);

  // ── Media Session: lets the OS (lock screen, media keys, etc.) control
  // playback and treats this tab as active background media, which helps
  // browsers avoid throttling it while it's not in the foreground.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play",  () => { void handlePlayPause(); });
    navigator.mediaSession.setActionHandler("pause", () => { void handlePlayPause(); });
    navigator.mediaSession.setActionHandler("previoustrack", () => previousTrack());
    navigator.mediaSession.setActionHandler("nexttrack",     () => nextTrack());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (duration > 0 && details.seekTime != null) handleSeek((details.seekTime * 1000) / duration);
    });
    return () => {
      navigator.mediaSession.setActionHandler("play",  null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack",     null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [handlePlayPause, previousTrack, nextTrack, handleSeek, duration]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const title  = currentTrack?.name   ?? source?.albumTitle ?? "";
    const artist = currentTrack?.artist ?? source?.artist     ?? "";
    navigator.mediaSession.metadata = (title || artist)
      ? new MediaMetadata({ title, artist, album: "rekōdo" })
      : null;
  }, [currentTrack, source]);

  return (
    <SpotifyPlaybackContext.Provider value={{
      tokenData, deviceId, playing, position, duration, volume, currentTrack, playError,
      useSDK, usePreview, setActiveSource, handlePlayPause, handleSeek, handleVolume,
      previousTrack, nextTrack, reconnect,
    }}>
      {children}
    </SpotifyPlaybackContext.Provider>
  );
}
