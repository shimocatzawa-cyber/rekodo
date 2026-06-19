"use client";

import { useState, useEffect, useRef } from "react";
import { useSpotifyPlayback, type ActiveSource } from "@/components/SpotifyPlayerProvider";

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const INK           = "#0a0a0a";
const RULE          = "#e0e0da";
const SPOTIFY_GREEN = "#1DB954";

type Track = { uri: string; name: string; album: string };

interface Props {
  artist: string | null;
}

function IconPlay() {
  return <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden><polygon points="3,1 3,15 14,8" fill="currentColor"/></svg>;
}
function IconPause() {
  return <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden><rect x="2" y="1" width="4.5" height="14" fill="currentColor"/><rect x="9.5" y="1" width="4.5" height="14" fill="currentColor"/></svg>;
}
function IconPrev() {
  return <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden><polygon points="19,3 19,19 8,11" fill="currentColor"/><rect x="3" y="3" width="3" height="16" fill="currentColor"/></svg>;
}
function IconNext() {
  return <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden><polygon points="3,3 3,19 14,11" fill="currentColor"/><rect x="16" y="3" width="3" height="16" fill="currentColor"/></svg>;
}
function IconShuffle() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2,5 h4 l6,8 h4 M16,5 h-4 M16,13 h-4 M12,3 l4,2 -4,2 M12,11 l4,2 -4,2 M2,13 h3 l2,-2"/>
    </svg>
  );
}

function SmallBtn({
  children, disabled, onClick, ariaLabel, primary,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        background:     primary ? (disabled ? "#ccc" : INK) : "none",
        border:         "none",
        cursor:         disabled ? "default" : "pointer",
        padding:        primary ? 0 : "2px",
        color:          primary ? "#fff" : (disabled ? "#ccc" : INK),
        opacity:        !primary && disabled ? 0.3 : 1,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          primary ? 28 : 20,
        height:         primary ? 28 : 20,
        flexShrink:     0,
      }}
    >
      {children}
    </button>
  );
}

export default function ArtistPlayer({ artist }: Props) {
  const {
    tokenData,
    deviceId,
    playing,
    position,
    duration,
    currentTrack,
    playError,
    useSDK,
    handlePlayPause,
    handleSeek,
    nextTrack,
    previousTrack,
    reconnect,
    setActiveSource,
  } = useSpotifyPlayback();

  const [tracks,  setTracks]  = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const loadedForRef = useRef<string | null>(null);

  // Fetch top tracks when artist changes
  useEffect(() => {
    if (!artist || !tokenData?.connected) return;
    if (loadedForRef.current === artist) return;

    loadedForRef.current = artist;
    setTracks([]);
    setShuffled(false);
    setLoading(true);

    fetch(`/api/spotify/artist-top-tracks?artist=${encodeURIComponent(artist)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { tracks: Track[] }) => setTracks(data.tracks ?? []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [artist, tokenData?.connected]);

  // Sync source with provider whenever tracks / artist change
  useEffect(() => {
    if (!tracks.length || !artist) return;
    setActiveSource({
      mode:             "dig",
      spotifyTrackUris: tracks.map(t => t.uri),
      artist:           artist,
      albumTitle:       "Top Tracks",
    } as ActiveSource);
  }, [tracks, artist, setActiveSource]);

  // Don't render for non-Spotify users; null while still loading token
  if (tokenData === null) return null;
  if (!tokenData.connected) return null;
  if (!artist) return null;

  const sdkConnecting = useSDK && !deviceId;
  const playDisabled  = sdkConnecting || loading || !tracks.length;

  function fmt(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const trackLabel = sdkConnecting
    ? "Connecting…"
    : loading
      ? "Loading tracks…"
      : tracks.length === 0
        ? "No tracks found"
        : currentTrack
          ? `${currentTrack.artist} — ${currentTrack.name}`
          : `${tracks[0].name}`;

  const eyebrow = sdkConnecting ? "Connecting" : "Top Tracks";

  const errorLabel = playError === null ? null
    : playError === 403 ? "Premium required"
    : playError === 401 ? "Auth error — reconnect Spotify"
    : playError === 429 ? "Rate limited — wait a moment"
    : `Spotify error ${playError}`;

  function handleShuffle() {
    if (!tracks.length || !artist) return;
    const order = shuffled ? [...tracks] : [...tracks].sort(() => Math.random() - 0.5);
    setShuffled(!shuffled);
    setActiveSource({
      mode:             "dig",
      spotifyTrackUris: order.map(t => t.uri),
      artist:           artist,
      albumTitle:       "Top Tracks",
    } as ActiveSource);
  }

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div style={{
      width:      196,
      flexShrink: 0,
      border:     `1px solid ${RULE}`,
      alignSelf:  "flex-start",
    }}>

      {/* Eyebrow + Spotify dot */}
      <div style={{
        padding:       "6px 10px",
        borderBottom:  `1px solid ${RULE}`,
        display:       "flex",
        alignItems:    "center",
        justifyContent:"space-between",
        gap:           6,
      }}>
        <span style={{
          fontFamily:    MONO,
          fontSize:      "0.48rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         sdkConnecting ? "#aaaaaa" : ORANGE,
        }}>
          {eyebrow}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: SPOTIFY_GREEN, flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: "0.42rem", color: SPOTIFY_GREEN, letterSpacing: "0.04em" }}>
            Spotify
          </span>
        </div>
      </div>

      {/* Track name */}
      <div style={{
        padding:      "6px 10px",
        borderBottom: `1px solid ${RULE}`,
        overflow:     "hidden",
        whiteSpace:   "nowrap",
        textOverflow: "ellipsis",
      }}>
        <span style={{
          fontFamily:    MONO,
          fontSize:      "0.58rem",
          color:         (sdkConnecting || loading || !tracks.length) ? "#aaaaaa" : INK,
          letterSpacing: "0.01em",
        }}>
          {trackLabel}
        </span>
      </div>

      {/* Error strip */}
      {errorLabel && (
        <div style={{
          padding:      "4px 10px",
          background:   "#fff8f5",
          borderBottom: `1px solid ${RULE}`,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          gap: 6,
        }}>
          <span style={{ fontFamily: MONO, fontSize: "0.42rem", color: "#cc3300", letterSpacing: "0.04em", flex: 1, minWidth: 0 }}>
            {errorLabel}
          </span>
          {playError === 401 && (
            <button onClick={reconnect} style={{
              fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.08em",
              textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`,
              padding: "2px 6px", cursor: "pointer", color: INK, flexShrink: 0,
            }}>
              Reconnect
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div style={{
        padding:       "6px 10px",
        borderBottom:  `1px solid ${RULE}`,
        display:       "flex",
        alignItems:    "center",
        justifyContent:"center",
        gap:           8,
      }}>
        <SmallBtn disabled={!currentTrack} onClick={previousTrack} ariaLabel="Previous">
          <IconPrev />
        </SmallBtn>

        <SmallBtn
          primary
          disabled={playDisabled}
          onClick={handlePlayPause}
          ariaLabel={playing ? "Pause" : "Play"}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </SmallBtn>

        <SmallBtn disabled={!currentTrack} onClick={nextTrack} ariaLabel="Next">
          <IconNext />
        </SmallBtn>

        <SmallBtn
          disabled={!tracks.length}
          onClick={handleShuffle}
          ariaLabel="Shuffle"
        >
          <span style={{ color: shuffled ? ORANGE : "inherit" }}>
            <IconShuffle />
          </span>
        </SmallBtn>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "6px 10px 8px" }}>
        <div
          onClick={onSeek}
          style={{ position: "relative", height: 2, background: RULE, cursor: "pointer", marginBottom: 4 }}
        >
          <div style={{
            position: "absolute", left: 0, top: 0,
            height: "100%", width: `${progressPct}%`,
            background: ORANGE,
          }} />
          {duration > 0 && (
            <div style={{
              position:  "absolute", top: "50%", left: `${progressPct}%`,
              transform: "translate(-50%, -50%)",
              width: 6, height: 6, borderRadius: "50%", background: ORANGE,
            }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.06em", color: "#aaaaaa" }}>
            {fmt(position)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.06em", color: "#aaaaaa" }}>
            {duration > 0 ? fmt(duration) : "--:--"}
          </span>
        </div>
      </div>

    </div>
  );
}
