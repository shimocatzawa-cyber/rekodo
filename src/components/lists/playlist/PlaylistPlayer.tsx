"use client";

import { useEffect } from "react";
import { useSpotifyPlayback } from "@/components/SpotifyPlayerProvider";
import type { GeneratedTrack } from "@/components/lists/PlaylistTab";

const MONO          = "var(--font-mono)";
const ORANGE        = "#CC5500";
const RULE          = "#e0e0da";
const INK           = "#0a0a0a";
const SPOTIFY_GREEN = "#1DB954";

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <polygon points="3,1 3,15 14,8" fill="currentColor" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="1" width="4" height="14" fill="currentColor" />
      <rect x="10" y="1" width="4" height="14" fill="currentColor" />
    </svg>
  );
}
function IconPrev() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="1" width="2" height="14" fill="currentColor" />
      <polygon points="14,1 14,15 4,8" fill="currentColor" />
    </svg>
  );
}
function IconNext() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="12" y="1" width="2" height="14" fill="currentColor" />
      <polygon points="2,1 2,15 12,8" fill="currentColor" />
    </svg>
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function PlaylistPlayer({ tracks, moodLabel }: { tracks: GeneratedTrack[]; moodLabel: string }) {
  const {
    tokenData, deviceId, playing, position, duration, currentTrack, playError,
    useSDK, setActiveSource, handlePlayPause, handleSeek, previousTrack, nextTrack,
  } = useSpotifyPlayback();

  useEffect(() => {
    if (!tracks.length) return;
    setActiveSource({
      mode: "playlist",
      spotifyTrackUris: tracks.map(t => t.spotify_uri),
      artist: tracks[0]?.artist,
      albumTitle: `${moodLabel} — via rekōdo`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  if (!tracks.length) return null;
  if (tokenData === null) return null;

  if (!tokenData.connected) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.04em", color: "#aaaaaa", padding: "12px 0" }}>
        Connect Spotify in Settings to preview this playlist.
      </p>
    );
  }

  if (tokenData.product !== "premium") {
    return (
      <p style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.04em", color: "#aaaaaa", padding: "12px 0" }}>
        Preview requires Spotify Premium. Open individual tracks in Spotify below instead.
      </p>
    );
  }

  // Cosmetic only — doesn't gate the Play button. A null deviceId here just
  // means the SDK is mid-(re)connect (e.g. after the tab was idle); clicking
  // Play still has to work in that state since handlePlayPause itself
  // reconnects and waits for a device before sending the play command.
  const sdkConnecting = useSDK && !deviceId;
  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(pct);
  };

  const nowPlayingText = sdkConnecting
    ? "Connecting to Spotify…"
    : currentTrack ? `${currentTrack.artist} — ${currentTrack.name}` : "Ready to play";

  return (
    <div style={{ background: "#ffffff", border: `1px solid ${RULE}` }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "14px" }}>
        <button
          onClick={previousTrack}
          aria-label="Previous track"
          disabled={sdkConnecting}
          style={{
            width: "28px", height: "28px", flexShrink: 0,
            background: "transparent", color: sdkConnecting ? "#cccccc" : INK, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: sdkConnecting ? "default" : "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => { if (!sdkConnecting) (e.currentTarget as HTMLButtonElement).style.color = ORANGE; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = sdkConnecting ? "#cccccc" : INK; }}
        >
          <IconPrev />
        </button>

        <button
          onClick={handlePlayPause}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: "36px", height: "36px", flexShrink: 0,
            background: sdkConnecting ? "#cccccc" : INK, color: "#ffffff", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", opacity: sdkConnecting ? 0.5 : 1,
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = sdkConnecting ? "#cccccc" : INK; }}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        <button
          onClick={nextTrack}
          aria-label="Next track"
          disabled={sdkConnecting}
          style={{
            width: "28px", height: "28px", flexShrink: 0,
            background: "transparent", color: sdkConnecting ? "#cccccc" : INK, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: sdkConnecting ? "default" : "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => { if (!sdkConnecting) (e.currentTarget as HTMLButtonElement).style.color = ORANGE; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = sdkConnecting ? "#cccccc" : INK; }}
        >
          <IconNext />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: INK, margin: "0 0 6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nowPlayingText}
          </p>
          <div onClick={onSeek} style={{ position: "relative", height: "2px", background: RULE, cursor: "pointer" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progressPct}%`, background: ORANGE }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.04em", color: "#aaaaaa" }}>{fmt(position)}</span>
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.04em", color: "#aaaaaa" }}>{duration > 0 ? fmt(duration) : "--:--"}</span>
          </div>
        </div>

        <span style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0, border: `1px solid ${RULE}`, padding: "4px 8px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SPOTIFY_GREEN }} />
          <span style={{ fontFamily: MONO, fontSize: "8px", color: SPOTIFY_GREEN, letterSpacing: "0.04em" }}>spotify</span>
        </span>
      </div>

      {playError !== null && (
        <p style={{ fontFamily: MONO, fontSize: "9px", color: "#cc3300", padding: "0 16px 10px" }}>
          Playback error {playError} — try again in a moment.
        </p>
      )}
    </div>
  );
}
