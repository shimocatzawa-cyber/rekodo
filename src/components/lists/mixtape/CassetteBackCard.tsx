"use client";

interface TrackItem {
  title: string;
  artist: string;
  duration_ms: number;
}

interface Props {
  title: string;
  sideA: TrackItem[];
  sideB: TrackItem[];
  cassetteType: string;
  width?: number;
}

// Usable band inside the j-card image (% of 1024px image height)
const TRACK_TOP    = 22;
const TRACK_BOTTOM = 86;

const HAND = '"Bradley Hand", "Caveat", "Kalam", cursive';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function TrackColumn({
  tracks, left, right, fs,
}: {
  tracks: TrackItem[];
  left: string; right: string;
  fs: number;
}) {
  if (tracks.length === 0) return null;
  const fsDur = Math.round(fs * 0.85);

  return (
    <div style={{
      position: "absolute",
      top: `${TRACK_TOP}%`,
      bottom: `${100 - TRACK_BOTTOM}%`,
      left, right,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-evenly",
      overflow: "hidden",
    }}>
      {tracks.map((t, i) => {
        const label = `${i + 1}. ${t.title}${t.artist ? ` — ${t.artist}` : ""}`;
        const duration = t.duration_ms > 0 ? fmt(t.duration_ms) : "";

        return (
          <div
            key={i}
            style={{ display: "flex", alignItems: "flex-start", gap: Math.round(fs * 0.3), flexShrink: 0 }}
          >
            <span style={{
              fontFamily: HAND, fontSize: fs, color: "#0d0d0d", lineHeight: 1.35, flex: 1,
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>
              {label}
            </span>
            {duration && (
              <span style={{ fontFamily: HAND, fontSize: fsDur, color: "#555", lineHeight: 1.35, flexShrink: 0 }}>
                {duration}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CassetteBackCard({ sideA, sideB, width = 520 }: Props) {
  const height     = Math.round(width * (1024 / 1536));
  const n          = Math.max(sideA.length, sideB.length, 1);
  const containerH = height * (TRACK_BOTTOM - TRACK_TOP) / 100;
  // Each track gets ~38% of its slot for text height; cap at comfortable max
  const fs = Math.max(7, Math.min(Math.round(containerH / n * 0.38), Math.round(width * 0.022)));

  return (
    <div style={{ position: "relative", width, height, display: "inline-block", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cassette-back.png"
        alt="Cassette back"
        width={width}
        height={height}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <TrackColumn tracks={sideA} left="8%" right="54%" fs={fs} />
        <TrackColumn tracks={sideB} left="44%" right="7%" fs={fs} />
      </div>
    </div>
  );
}
