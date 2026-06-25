"use client";

import { useEffect } from "react";
import {
  useSpotifyPlayback,
  getFreshSpotifyToken,
  bustSpotifyTokenCache,
} from "@/components/SpotifyPlayerProvider";

export { getFreshSpotifyToken, bustSpotifyTokenCache };

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const RULE          = "#e0e0da";
const INK           = "#0a0a0a";
const SPOTIFY_GREEN = "#1DB954";

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
// Presentational only — the actual SDK player/connection lives in
// SpotifyPlayerProvider (mounted at the root layout) so playback survives
// navigating away from this page. This component just tells the provider
// which album/track is currently selected and renders its state.

export default function SpotifyPlayer({
  mode, spotifyUri, previewUrl, spotifyTrackUri, artist, albumTitle,
}: SpotifyPlayerProps) {
  const {
    tokenData, deviceId, playing, position, duration, currentTrack, playError,
    useSDK, usePreview, setActiveSource, handlePlayPause, handleSeek,
    previousTrack, nextTrack, reconnect,
  } = useSpotifyPlayback();

  useEffect(() => {
    setActiveSource({ mode, spotifyUri, spotifyTrackUri, previewUrl, artist, albumTitle });
  }, [mode, spotifyUri, spotifyTrackUri, previewUrl, artist, albumTitle, setActiveSource]);

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
  // Cosmetic only — doesn't gate the Play button. A null deviceId here just
  // means the SDK is mid-(re)connect (e.g. after the tab was idle); clicking
  // Play still has to work in that state since handlePlayPause itself
  // reconnects and waits for a device before sending the play command.
  const sdkConnecting = useSDK && !deviceId;
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
    : playError === 404 ? "Spotify device unavailable — tap to reconnect"
    : playError ===   0 ? "Network error — check your connection"
    : playError ===  -1 ? "Could not get Spotify token — try reconnecting in Settings"
    : `Spotify error ${playError}`;

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(pct);
  };

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
      {errorLabel && (
        <div style={{
          padding: "6px 12px", background: "#fff8f5",
          borderBottom: `1px solid ${RULE}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ fontFamily: MONO, fontSize: "0.48rem", color: "#cc3300", letterSpacing: "0.04em" }}>
            {errorLabel}
          </span>
          {playError === 401 && (
            <button
              onClick={reconnect}
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

          <CtrlBtn disabled={!currentTrack} onClick={previousTrack} aria-label="Previous">
            <IconPrev />
          </CtrlBtn>

          <button
            onClick={handlePlayPause}
            aria-label={playing ? "Pause" : "Play"}
            style={{
              width: "44px", height: "44px", flexShrink: 0,
              background: sdkConnecting ? "#cccccc" : INK,
              color: "#ffffff", border: "none",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: sdkConnecting ? 0.5 : 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = sdkConnecting ? "#cccccc" : INK; }}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>

          <CtrlBtn disabled={!currentTrack} onClick={nextTrack} aria-label="Next">
            <IconNext />
          </CtrlBtn>

          <CtrlBtn disabled aria-label="Repeat"><IconRepeat /></CtrlBtn>
        </div>

      </div>

      {/* ── Progress (bottom) ── */}
      <div style={{ padding: "0.5rem 0.9rem 0.6rem" }}>
        <div
          onClick={onSeek}
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
