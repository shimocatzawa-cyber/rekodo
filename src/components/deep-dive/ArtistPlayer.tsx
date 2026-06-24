"use client";

import { useState, useEffect, useRef } from "react";
import { useSpotifyPlayback, type ActiveSource } from "@/components/SpotifyPlayerProvider";

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const RULE          = "#e0e0da";
const SPOTIFY_GREEN = "#1DB954";

type Track = { uri: string; name: string; album: string; preview_url: string | null };

interface Props {
  artist: string | null;
}

export default function ArtistPlayer({ artist }: Props) {
  const {
    tokenData, deviceId, playing, position, duration,
    currentTrack, playError,
    useSDK, usePreview,
    setActiveSource, handlePlayPause, handleSeek: ctxSeek,
    previousTrack, nextTrack, reconnect,
  } = useSpotifyPlayback();

  const [tracks,      setTracks]      = useState<Track[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [shuffled,    setShuffled]    = useState(false);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [retryCount,  setRetryCount]  = useState(0);
  const loadedForRef = useRef<string | null>(null);

  // Fetch top tracks when artist changes
  useEffect(() => {
    if (!artist || !tokenData?.connected) return;
    if (loadedForRef.current === artist) return;
    loadedForRef.current = artist;
    setTracks([]);
    setFetchError(null);
    setShuffled(false);
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/spotify/artist-top-tracks?artist=${encodeURIComponent(artist)}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try { const j = await r.json() as { error?: string }; if (j.error) msg = `${j.error} (${r.status})`; } catch { /* ignore */ }
          throw new Error(msg);
        }
        return r.json() as Promise<{ tracks: Track[] }>;
      })
      .then(d => { setTracks(d.tracks ?? []); })
      .catch((err: Error) => {
        if (err?.name === "AbortError") return;
        console.error("[ArtistPlayer] fetch error:", err.message);
        setFetchError(err.message ?? "Failed to load tracks");
        setTracks([]);
      })
      .finally(() => setLoading(false));
    return () => { controller.abort(); };
  }, [artist, tokenData?.connected, retryCount]);

  // Keep provider source in sync
  useEffect(() => {
    if (!tracks.length || !artist) return;
    setActiveSource({
      mode:             "dig",
      spotifyTrackUris: tracks.map(t => t.uri),
      previewUrl:       tracks[0]?.preview_url ?? undefined,
      artist,
      albumTitle:       "Top Tracks",
    } as ActiveSource);
  }, [tracks, artist, setActiveSource]);

  if (tokenData === null || !tokenData.connected || !artist) return null;

  const isPremium    = !!(tokenData.product === "premium");
  // sdkWanted: the user/source WANTS SDK playback (premium + tracks known locally)
  const sdkWanted    = isPremium && tracks.length > 0;
  // sdkLive: provider has source set AND device is ready — use provider's useSDK
  // as the authoritative flag so we don't enable the button before setActiveSource
  // has propagated through the provider and the handlePlayPause closure is current.
  const sdkLive      = useSDK && !!deviceId;
  const sdkConnecting = sdkWanted && !sdkLive && !playError && !loading && tracks.length > 0;
  // usePreview from provider is the authoritative flag for preview mode.
  // Deliberately NOT requiring deviceId (sdkLive) here — a null deviceId just
  // means the SDK is mid-(re)connect (e.g. after the tab was idle), and the
  // button needs to stay clickable so handlePlayPause's own reconnect-and-wait
  // logic gets a chance to run instead of being unreachable behind `disabled`.
  const canPlay      = (useSDK || usePreview) && !loading;

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect  = e.currentTarget.getBoundingClientRect();
    ctxSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }

  function handleShuffle() {
    if (!tracks.length || !artist) return;
    const order = shuffled
      ? [...tracks]
      : [...tracks].sort(() => Math.random() - 0.5);
    setShuffled(!shuffled);
    setActiveSource({
      mode:             "dig",
      spotifyTrackUris: order.map(t => t.uri),
      previewUrl:       order[0]?.preview_url ?? undefined,
      artist,
      albumTitle:       "Top Tracks",
    } as ActiveSource);
  }

  const eyebrow = playError ? "Error"
    : fetchError            ? "Error"
    : sdkConnecting         ? "Connecting"
    : loading               ? "Loading"
    : sdkLive               ? "Now Playing"
    : usePreview            ? "Preview"
    :                         "Top Tracks";

  const trackLabel = playError
    ? (playError === 403 ? "Premium required or unavailable in your region"
      : playError === 401 ? "Auth error — reconnect Spotify in Settings"
      : playError === 429 ? "Rate limited — wait a moment"
      : playError === 404 ? "Device unavailable — tap to reconnect"
      : `Spotify error ${playError}`)
    : fetchError    ? fetchError
    : sdkConnecting ? "Connecting to Spotify…"
    : loading       ? "Loading tracks…"
    : !tracks.length ? "No tracks found"
    : sdkLive && currentTrack
      ? `${currentTrack.artist} — ${currentTrack.name}`
      : `${artist} — Top Tracks`;

  const iconBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", padding: "4px",
    color: "#888", display: "flex", alignItems: "center", flexShrink: 0,
    transition: "color 0.15s",
  };

  return (
    <div
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "10px",
        padding:    "10px 2.5rem",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      {/* Eyebrow + track label */}
      <div style={{ flex: "0 1 38%", display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <span style={{
          fontFamily:    MONO,
          fontSize:      "8px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         (sdkConnecting || loading) ? "#aaaaaa" : (playError || fetchError) ? "#cc3300" : ORANGE,
          flexShrink:    0,
        }}>
          {eyebrow}
        </span>
        <span style={{
          fontFamily:    MONO,
          fontSize:      "10px",
          color:         (playError || fetchError) ? "#cc3300" : "#0d0d0d",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}>
          {trackLabel}
        </span>
      </div>

      {/* Transport controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        {fetchError && (
          <button
            onClick={() => { loadedForRef.current = null; setFetchError(null); setRetryCount(c => c + 1); }}
            style={{ ...iconBtn, fontSize: "8px", fontFamily: MONO, letterSpacing: "0.08em", color: ORANGE, padding: "4px 6px" }}
          >
            Retry
          </button>
        )}
        {sdkLive && (
          <button
            onClick={() => previousTrack()}
            style={iconBtn}
            aria-label="Previous"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0d0d0d"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
          >
            <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden>
              <polygon points="19,3 19,19 8,11" fill="currentColor"/>
              <rect x="3" y="3" width="3" height="16" fill="currentColor"/>
            </svg>
          </button>
        )}

        <button
          onClick={() => {
            if (playError) { reconnect(); return; }
            void handlePlayPause();
          }}
          disabled={!canPlay && !playError}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: "30px", height: "30px", flexShrink: 0,
            background: (!canPlay && !playError) ? "#cccccc" : "#0d0d0d",
            color: "#ffffff", border: "none",
            cursor: (!canPlay && !playError) ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => {
            if (canPlay || playError) (e.currentTarget as HTMLButtonElement).style.background = ORANGE;
          }}
          onMouseLeave={e => {
            if (canPlay || playError) (e.currentTarget as HTMLButtonElement).style.background = "#0d0d0d";
          }}
        >
          {playing
            ? <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><rect x="2" y="1" width="4" height="14" fill="currentColor"/><rect x="10" y="1" width="4" height="14" fill="currentColor"/></svg>
            : <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><polygon points="3,1 3,15 14,8" fill="currentColor"/></svg>
          }
        </button>

        {sdkLive && (
          <button
            onClick={() => nextTrack()}
            style={iconBtn}
            aria-label="Next"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0d0d0d"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
          >
            <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden>
              <polygon points="3,3 3,19 14,11" fill="currentColor"/>
              <rect x="16" y="3" width="3" height="16" fill="currentColor"/>
            </svg>
          </button>
        )}

        {tracks.length > 0 && (
          <button
            onClick={handleShuffle}
            style={{ ...iconBtn, color: shuffled ? ORANGE : "#888" }}
            aria-label="Shuffle"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = shuffled ? ORANGE : "#0d0d0d"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = shuffled ? ORANGE : "#888"; }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2,5 h4 l6,8 h4 M16,5 h-4 M16,13 h-4 M12,3 l4,2 -4,2 M12,11 l4,2 -4,2 M2,13 h3 l2,-2"/>
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", flexShrink: 0 }}>
          {fmt(position)}
        </span>
        <div
          onClick={handleSeekClick}
          style={{ flex: 1, height: "2px", background: RULE, position: "relative", cursor: "pointer" }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: ORANGE }} />
          {duration > 0 && (
            <div style={{
              position: "absolute", top: "50%", left: `${pct}%`,
              transform: "translate(-50%, -50%)",
              width: "8px", height: "8px", borderRadius: "50%", background: ORANGE,
            }} />
          )}
        </div>
        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", flexShrink: 0 }}>
          {duration > 0 ? fmt(duration) : "--:--"}
        </span>
      </div>

      {/* Spotify badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: SPOTIFY_GREEN, display: "inline-block" }} />
        <span style={{ fontFamily: MONO, fontSize: "8px", color: SPOTIFY_GREEN, whiteSpace: "nowrap" }}>
          {sdkLive ? "Streaming" : "Spotify"}
        </span>
      </div>
    </div>
  );
}
