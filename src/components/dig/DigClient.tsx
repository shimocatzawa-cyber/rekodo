"use client";

import { useState, useEffect, useRef } from "react";
import AppNav from "@/components/AppNav";
import { addToWantlist } from "@/app/dig/actions";
import RecordSpinner from "@/components/RecordSpinner";
import { isAppleMusicUrl, openAppleMusicLink } from "@/lib/openAppleMusic";

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
  availableStyles: string[];
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
  activateElement(): void;
};

let _digSdkLoaded = false;
const _digSdkCbs: Array<() => void> = [];
function ensureDigSDK(cb: () => void) {
  if (_digSdkLoaded) { cb(); return; }
  _digSdkCbs.push(cb);
  if (typeof window === "undefined") return;
  if (window.Spotify) {
    _digSdkLoaded = true; _digSdkCbs.splice(0).forEach(f => f()); return;
  }
  // Chain onto any existing global handler (may be SpotifyPlayerProvider's)
  // so neither set of callbacks is silently dropped when both load on the same page.
  const fire = () => { _digSdkLoaded = true; _digSdkCbs.splice(0).forEach(f => f()); };
  const prev = window.onSpotifyWebPlaybackSDKReady;
  const chained = prev ? () => { prev(); fire(); } : fire;
  if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
    window.onSpotifyWebPlaybackSDKReady = chained;
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(s);
  } else {
    // Script already in DOM (loaded by Provider) — just chain the callback.
    window.onSpotifyWebPlaybackSDKReady = chained;
  }
}

let _digToken: string | null = null;
let _digTokenExpiry           = 0;

async function getFreshToken(): Promise<string | null> {
  if (_digToken && Date.now() < _digTokenExpiry) return _digToken;
  try {
    const res  = await fetch("/api/spotify/token");
    const data = await res.json() as DigTokenData & { expires_at?: number };
    _digToken       = data.access_token ?? null;
    _digTokenExpiry = data.expires_at
      ? data.expires_at - 60_000
      : Date.now() + 50 * 60 * 1000;
    return _digToken;
  } catch {
    return null;
  }
}

function bustDigTokenCache() {
  _digToken       = null;
  _digTokenExpiry = 0;
}

async function sendPlay(deviceId: string, body: object): Promise<number | null> {
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

function DigCompactPlayer({ previewUrl, albumUri, trackUri, artist, album, recIdx }: {
  previewUrl: string | null;
  albumUri:   string | null;
  trackUri:   string | null;
  artist:     string;
  album:      string;
  recIdx:     number;
}) {
  const [isPremium,    setIsPremium]    = useState(false);
  const [deviceId,     setDeviceId]     = useState<string | null>(null);
  const [sdkReady,     setSdkReady]     = useState(false);
  const [playing,      setPlaying]      = useState(false);
  const [position,     setPosition]     = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(0.8);
  const [nowTrack,     setNowTrack]     = useState<{ artist: string; name: string } | null>(null);
  const [playPending,  setPlayPending]  = useState(false);
  const [authError,    setAuthError]    = useState(false);
  const [playError,    setPlayError]    = useState<number | null>(null);

  const playerRef      = useRef<DigSdkPlayer | null>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const sdkStartedRef  = useRef(false);
  const pendingPlayRef = useRef<{ albumUri: string | null; trackUri: string | null; recIdx: number } | null>(null);
  const recIdxRef      = useRef(recIdx);

  const useSDK  = isPremium && !!(albumUri || trackUri);
  const sdkLive = useSDK && !!deviceId;

  // Determine Premium status and seed the module cache while we have the token.
  useEffect(() => {
    fetch("/api/spotify/token")
      .then(r => r.json() as Promise<DigTokenData & { expires_at?: number }>)
      .then(d => {
        if (d.access_token) {
          _digToken       = d.access_token;
          _digTokenExpiry = d.expires_at
            ? d.expires_at - 60_000
            : Date.now() + 50 * 60 * 1000;
        }
        if (d.connected && d.product === "premium") setIsPremium(true);
      })
      .catch(() => {});
  }, []);

  // Load SDK when Premium
  useEffect(() => {
    if (!isPremium) return;
    if (_digSdkLoaded) { setSdkReady(true); return; }
    ensureDigSDK(() => setSdkReady(true));
  }, [isPremium]);

  // Init SDK player — only once per mount
  useEffect(() => {
    if (!sdkReady || playerRef.current) return;
    const player = new window.Spotify.Player({
      name: "rekōdo",
      // The SDK calls this whenever it needs a token for its own requests
      getOAuthToken: async (cb) => {
        for (let i = 0; i < 3; i++) {
          const token = await getFreshToken();
          if (token) { cb(token); return; }
          bustDigTokenCache();
          await new Promise(r => setTimeout(r, 500));
        }
        cb("");
      },
      volume: 0.8,
    }) as unknown as DigSdkPlayer;

    player.addListener("ready", (d) => {
      setDeviceId((d as { device_id: string }).device_id);
      setAuthError(false);
    });
    player.addListener("authentication_error", (d) => {
      console.error("[rekōdo] Dig Spotify auth error:", d);
      // Same recovery as the collection player: the access token expired
      // mid-session, not the refresh token. Bust the cache and reconnect
      // instead of leaving playback dead.
      bustDigTokenCache();
      setAuthError(true);
      setTimeout(() => {
        player.connect().then(success => { if (success) setAuthError(false); }).catch(() => {});
      }, 800);
    });
    player.addListener("account_error", (d) => {
      console.error("[rekōdo] Dig Spotify account error:", d);
    });
    player.addListener("playback_error", (d) => {
      console.error("[rekōdo] Dig Spotify playback error:", d);
    });
    player.addListener("player_state_changed", (s) => {
      if (!s) return;
      // A real state update proves the connection is alive — clear any
      // stale error banner left over from an earlier disconnect/auth hiccup.
      setAuthError(false);
      // Ignore events for tracks we haven't intentionally started — prevents
      // stale SDK events from the previous rec overriding the reset state.
      if (!sdkStartedRef.current) return;
      const state = s as DigPlaybackState;
      setPlaying(!state.paused);
      setPosition(state.position);
      setDuration(state.duration);
      const t = state.track_window?.current_track;
      if (t) setNowTrack({ artist: t.artists?.[0]?.name ?? "", name: t.name ?? "" });
    });
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
    return () => { player.disconnect(); playerRef.current = null; setDeviceId(null); };
  }, [sdkReady]);

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

  // Keep recIdxRef current so the deviceId effect can guard stale pending commands.
  useEffect(() => { recIdxRef.current = recIdx; }, [recIdx]);

  // Stop playback immediately when the user navigates to a new rec. This fires
  // before new preview data arrives so the player never plays the old rec's audio
  // while the new card is visible. audioRef is nulled here so handlePlayPause
  // won't restart old audio; the previewUrl cleanup effect destroys the element.
  useEffect(() => {
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = null;
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    setNowTrack(null);
    setPlayPending(false);
    setPlayError(null);
    sdkStartedRef.current = false;
    pendingPlayRef.current = null;
  }, [recIdx]);

  // Also reset when the preview/URI data itself changes (e.g. new data arriving
  // for this rec) — keeps state in sync with whatever the player props say.
  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    setNowTrack(null);
    setPlayPending(false);
    sdkStartedRef.current = false;
    pendingPlayRef.current = null;
  }, [albumUri, trackUri, previewUrl]);

  // Preview audio element — state driven by element events, not play() promise
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

  // When deviceId arrives: stop preview audio and fire any queued play command.
  // Guard against a race where deviceId arrives after the user navigated to a
  // different rec — compare the stored recIdx in pendingPlayRef against the
  // current recIdxRef so we never play the previous card's album.
  useEffect(() => {
    if (!deviceId) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      setPosition(0);
    }
    const pending = pendingPlayRef.current;
    if (!pending) return;
    if (pending.recIdx !== recIdxRef.current) {
      pendingPlayRef.current = null;
      setPlayPending(false);
      return;
    }
    pendingPlayRef.current = null;
    const body = pending.albumUri ? { context_uri: pending.albumUri } : { uris: [pending.trackUri!] };
    sendPlay(deviceId, body).then(err => {
      if (err === null) sdkStartedRef.current = true;
      else setPlayError(err);
      setPlayPending(false);
    });
  }, [deviceId]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  async function handlePlayPause() {
    if (playPending) return;
    setPlayError(null);

    // activateElement must be called synchronously within the user-gesture
    // call stack — do it before any await, and for both the live and pending paths.
    if (useSDK && playerRef.current) {
      try { playerRef.current.activateElement(); } catch { /* SDK < activateElement */ }
    }

    if (sdkLive && playerRef.current) {
      if (!sdkStartedRef.current) {
        setPlayPending(true);
        if (deviceId) {
          const body = albumUri ? { context_uri: albumUri } : { uris: [trackUri!] };
          const err  = await sendPlay(deviceId, body);
          if (err === null) sdkStartedRef.current = true;
          else setPlayError(err);
        }
        setPlayPending(false);
      } else {
        await playerRef.current.togglePlay().catch(() => {});
      }
    } else if (useSDK && !sdkLive && (albumUri || trackUri)) {
      // SDK still connecting — queue play; fires the moment deviceId arrives.
      // Store recIdx so the deviceId effect can discard stale commands after navigation.
      pendingPlayRef.current = { albumUri, trackUri, recIdx };
      setPlayPending(true);
      setTimeout(() => {
        if (!pendingPlayRef.current) return;
        pendingPlayRef.current = null;
        setPlayPending(false);
        if (audioRef.current) audioRef.current.play().catch(() => {});
      }, 8000);
    } else if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }

  async function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (sdkLive && duration) {
      const ms = Math.round(ratio * duration);
      setPosition(ms);
      fetch("/api/spotify/seek", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ positionMs: ms, deviceId }),
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

  // Invisible until there's something to play
  if (!useSDK && !previewUrl) return null;

  const eyebrow        = authError ? "Reconnecting" : playError ? "Error" : sdkLive ? "Now Playing" : "Preview";
  const nowPlayingText = authError
    ? "Spotify session expired — reconnecting…"
    : playError === 403 ? "Spotify: Premium required or unavailable in your region"
    : playError === 401 ? "Spotify auth failed — try reconnecting in Settings"
    : playError === 429 ? "Spotify: rate limited — wait a moment and try again"
    : playError === 0   ? "Network error — check your connection"
    : playError         ? `Spotify error ${playError}`
    : sdkLive && nowTrack
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
          textTransform: "uppercase", color: authError ? "#aaaaaa" : ORANGE, flexShrink: 0,
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
          disabled={playPending}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: "30px", height: "30px", flexShrink: 0,
            background: playPending ? "#888" : "#0d0d0d", color: "#ffffff",
            border: "none", cursor: playPending ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { if (!playPending) (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
          onMouseLeave={e => { if (!playPending) (e.currentTarget as HTMLButtonElement).style.background = "#0d0d0d"; }}
        >
          {playPending
            ? <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="16" strokeDashoffset="4"><animateTransform attributeName="transform" type="rotate" from="0 5 5" to="360 5 5" dur="0.7s" repeatCount="indefinite"/></circle></svg>
            : playing
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
                    {added ? "Added ✓" : "+ Wantlist"}
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
          placeholder="Filter styles…"
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
      {item("discover", "Outside Collection")}
      {item("explore",  "Inside Collection")}
      {item("style",    "Style Dig")}
      {item("history",  "Dig History · Last 7 Days")}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function DigClient({ username, displayLabel, avatarUrl, collectionCount, listsCount, availableStyles }: Props) {
  const [recs,          setRecs]          = useState<Recommendation[] | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [idx,           setIdx]           = useState(0);
  const [activeTab,     setActiveTab]     = useState<DigTab>("discover");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [wantlistAdded, setWantlistAdded] = useState<Set<string>>(new Set());
  const [wantlistError, setWantlistError] = useState<string | null>(null);
  const [digSpotify,    setDigSpotify]    = useState<{
    previewUrl: string | null; trackUri: string | null; albumUri: string | null; artist: string; album: string;
  } | null>(null);

  // Derived — the active dig mode (history tab has no mode)
  const mode: DigMode = activeTab === "history" ? "discover" : activeTab;

  // Accumulates artists and full recs shown this session so the API can avoid
  // repeating the same artists, genres, and stylistic territory
  const shownArtists = useRef<string[]>([]);
  const shownRecs    = useRef<Array<{ artist: string; album: string }>>([]);

  // fetchKey drives all fetches. Incrementing `n` re-triggers the effect for
  // "dig again" without changing mode; swapping `mode` handles mode changes.
  // `style` is only set when mode is "style" — the effect skips fetching until it is.
  const [fetchKey, setFetchKey] = useState<{ mode: DigMode; n: number; style?: string }>({ mode: "discover", n: 0 });

  // Clear player on mode/fetch change and also on rec navigation — until the
  // new card's onPreviewReady fires, the player should show nothing rather than
  // the previous album's metadata.
  useEffect(() => { setDigSpotify(null); }, [mode, fetchKey]);
  useEffect(() => { setDigSpotify(null); }, [idx]);

  // All setState calls inside the effect are in async callbacks, never synchronously
  // in the effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    if (fetchKey.mode === "style" && !fetchKey.style) return;
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

  function navigate(dir: -1 | 1) {
    const total = recs?.length ?? 1;
    setIdx(i => Math.min(Math.max(i + dir, 0), total - 1));
  }

  async function handleAddToWantlist(rec: Recommendation) {
    const key = `${rec.artist}||${rec.album}`;
    setWantlistAdded(prev => new Set(prev).add(key));
    setWantlistError(null);
    const result = await addToWantlist(rec.artist, rec.album, rec.year);
    if (result?.error) {
      setWantlistAdded(prev => { const s = new Set(prev); s.delete(key); return s; });
      setWantlistError(result.error);
      setTimeout(() => setWantlistError(null), 4000);
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

          <ModeToggle mode={activeTab} onChange={handleTabChange} disabled={loading} />

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
          <DigCompactPlayer
            recIdx={idx}
            previewUrl={digSpotify?.previewUrl ?? null}
            albumUri={digSpotify?.albumUri ?? null}
            trackUri={digSpotify?.trackUri ?? null}
            artist={digSpotify?.artist ?? ""}
            album={digSpotify?.album ?? ""}
          />

        </div>
      </main>

    </div>
  );
}
