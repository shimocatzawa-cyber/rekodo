"use client";

import { useState, useEffect, useRef } from "react";
import { useSpotifyPlayback, type ActiveSource } from "@/components/SpotifyPlayerProvider";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

type Track = { uri: string; name: string; album: string };

interface Props {
  artist: string | null;
}

export default function ArtistPlayer({ artist }: Props) {
  const {
    tokenData,
    playing,
    currentTrack,
    handlePlayPause,
    nextTrack,
    previousTrack,
    setActiveSource,
  } = useSpotifyPlayback();

  const [tracks,  setTracks]  = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedForRef = useRef<string | null>(null);

  // Fetch top tracks when artist changes
  useEffect(() => {
    if (!artist || !tokenData?.connected) return;
    if (loadedForRef.current === artist) return;

    setTracks([]);
    loadedForRef.current = artist;

    setLoading(true);
    fetch(`/api/spotify/artist-top-tracks?artist=${encodeURIComponent(artist)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { tracks: Track[] }) => setTracks(data.tracks ?? []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [artist, tokenData?.connected]);

  // Keep the provider source in sync with the loaded tracks
  useEffect(() => {
    if (!tracks.length || !artist) return;
    setActiveSource({
      mode:             "dig",
      spotifyTrackUris: tracks.map(t => t.uri),
      artist:           artist,
      albumTitle:       "Top Tracks",
    });
  }, [tracks, artist, setActiveSource]);

  // Only show if Spotify is connected (Apple Music will slot in here later)
  if (!tokenData?.connected) return null;
  if (!artist) return null;

  // Is this player's artist currently loaded in the provider?
  const isOurSource = !!currentTrack;
  const isPlaying   = isOurSource && playing;

  return (
    <div style={{
      marginLeft:  "auto",
      flexShrink:  0,
      width:       164,
      border:      `1px solid ${RULE}`,
      padding:     "10px 12px",
      background:  "#FDFCF8",
      display:     "flex",
      flexDirection: "column",
      gap:         6,
      boxSizing:   "border-box",
    }}>
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontFamily:    MONO,
          fontSize:      "8px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         ORANGE,
        }}>
          Top Tracks
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill={ORANGE} aria-hidden>
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.949-.583-.1-.422.159-.851.583-.949 4.91-1.121 9.12-.641 12.511 1.421.38.249.49.731.241 1.101l.037.006zm1.47-3.27c-.301.461-.921.6-1.381.3-3.46-2.13-8.73-2.75-12.82-1.5-.521.16-1.07-.13-1.23-.65-.16-.521.13-1.07.65-1.23 4.671-1.42 10.47-.73 14.44 1.71.46.301.6.921.3 1.381l.041-.011zm.13-3.4c-4.15-2.46-11.02-2.69-14.99-1.49-.64.19-1.31-.17-1.5-.81-.19-.64.17-1.31.81-1.5 4.56-1.38 12.14-1.11 16.93 1.72.58.35.77 1.09.42 1.67-.34.58-1.09.77-1.67.42z"/>
        </svg>
      </div>

      {/* Track name */}
      <div style={{
        fontFamily:   MONO,
        fontSize:     "9px",
        color:        INK,
        letterSpacing:"0.02em",
        overflow:     "hidden",
        whiteSpace:   "nowrap",
        textOverflow: "ellipsis",
        height:       13,
      }}>
        {loading
          ? <span style={{ color: "#bbb" }}>Loading…</span>
          : tracks.length === 0
            ? <span style={{ color: "#bbb" }}>—</span>
            : (currentTrack?.name ?? tracks[0]?.name ?? "—")
        }
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
        <ControlBtn title="Previous" onClick={previousTrack} disabled={!tracks.length}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </ControlBtn>

        <ControlBtn
          title={isPlaying ? "Pause" : "Play"}
          onClick={handlePlayPause}
          disabled={!tracks.length || loading}
          primary
        >
          {isPlaying ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </ControlBtn>

        <ControlBtn title="Next" onClick={nextTrack} disabled={!tracks.length}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm2.5-6 8.5 6V6l-8.5 6zm7.5 6h2V6h-2v12z"/>
          </svg>
        </ControlBtn>

        <ShuffleBtn tracks={tracks} artist={artist} setActiveSource={setActiveSource} />
      </div>
    </div>
  );
}

function ControlBtn({
  children, title, onClick, disabled, primary,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          primary ? 24 : 20,
        height:         primary ? 24 : 20,
        border:         primary ? `1px solid #0a0a0a` : "none",
        borderRadius:   "50%",
        background:     primary ? "#0a0a0a" : "none",
        color:          primary ? "#ffffff" : disabled ? "#ccc" : "#555",
        cursor:         disabled ? "default" : "pointer",
        padding:        0,
        flexShrink:     0,
      }}
    >
      {children}
    </button>
  );
}

function ShuffleBtn({
  tracks, artist, setActiveSource,
}: {
  tracks: Track[];
  artist: string | null;
  setActiveSource: (s: ActiveSource) => void;
}) {
  function shuffle() {
    if (!tracks.length || !artist) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setActiveSource({
      mode:             "dig",
      spotifyTrackUris: shuffled.map(t => t.uri),
      artist:           artist,
      albumTitle:       "Top Tracks (Shuffled)",
    });
  }

  return (
    <button
      title="Shuffle"
      onClick={shuffle}
      disabled={!tracks.length}
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          20,
        height:         20,
        border:         "none",
        background:     "none",
        color:          tracks.length ? "#555" : "#ccc",
        cursor:         tracks.length ? "pointer" : "default",
        padding:        0,
        flexShrink:     0,
        marginLeft:     "auto",
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41 13.42 14.82 16.55 18H14.5v2h6v-6h-2v2.04z"/>
      </svg>
    </button>
  );
}
