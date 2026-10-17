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

// Track list occupies this vertical band of the image (% of height)
const TRACK_TOP    = 25;
const TRACK_BOTTOM = 87;

const HAND = '"Bradley Hand", "Caveat", "Kalam", cursive';
const MONO = '"Courier New", monospace';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function TrackColumn({
  tracks, left, right, n, fs, fsSmall, gap,
}: {
  tracks: TrackItem[];
  left: string; right: string;
  n: number; fs: number; fsSmall: number; gap: number;
}) {
  const rowPct = (TRACK_BOTTOM - TRACK_TOP) / n;

  return (
    <>
      {tracks.map((t, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${TRACK_TOP + i * rowPct + rowPct * 0.5}%`,
            left, right,
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "baseline",
            gap,
            overflow: "hidden",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: fsSmall, color: "#bbb", flexShrink: 0, lineHeight: 1 }}>
            {i + 1}.
          </span>
          <span style={{
            fontFamily: HAND, fontSize: fs, color: "#0d0d0d",
            flex: 1, overflow: "hidden", whiteSpace: "nowrap",
            textOverflow: "ellipsis", lineHeight: 1,
          }}>
            {t.title}
          </span>
          {t.duration_ms > 0 && (
            <span style={{ fontFamily: MONO, fontSize: fsSmall, color: "#999", flexShrink: 0, lineHeight: 1 }}>
              {fmt(t.duration_ms)}
            </span>
          )}
        </div>
      ))}
    </>
  );
}

export default function CassetteBackCard({ sideA, sideB, width = 520 }: Props) {
  const height = Math.round(width * (1024 / 1536));

  // Font scales with available row height; caps at a comfortable max
  const n            = Math.max(sideA.length, sideB.length, 1);
  const rowHeightPx  = height * (TRACK_BOTTOM - TRACK_TOP) / 100 / n;
  const fs           = Math.max(7, Math.min(Math.round(rowHeightPx * 0.52), Math.round(width * 0.026)));
  const fsSmall      = Math.max(6, Math.round(fs * 0.72));
  const gap          = Math.max(2, Math.round(fs * 0.35));

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
        <TrackColumn
          tracks={sideA}
          left="8%" right="55%"
          n={n} fs={fs} fsSmall={fsSmall} gap={gap}
        />
        <TrackColumn
          tracks={sideB}
          left="44%" right="8%"
          n={n} fs={fs} fsSmall={fsSmall} gap={gap}
        />
      </div>
    </div>
  );
}
