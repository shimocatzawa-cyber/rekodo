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

export const MAX_BACK_TRACKS = 7;

// Y-position of each ruled line as % of image height (1536×1024 source image)
const LINE_Y = [35.6, 43.6, 51.5, 59.4, 67.3, 75.2, 83.1];

const HAND = '"Bradley Hand", "Caveat", "Kalam", cursive';
const MONO = '"Courier New", monospace';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function SideLines({
  tracks, left, right, fs, fsSmall, gap,
}: {
  tracks: TrackItem[];
  left: string; right: string;
  fs: number; fsSmall: number; gap: number;
}) {
  return (
    <>
      {LINE_Y.map((lineY, i) => {
        const t = tracks[i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${lineY - 3.5}%`,
              left, right,
              display: "flex",
              alignItems: "baseline",
              gap,
              overflow: "hidden",
            }}
          >
            <span style={{
              fontFamily: MONO, fontSize: fsSmall,
              color: "#bbb", flexShrink: 0, lineHeight: 1,
            }}>
              {i + 1}.
            </span>
            <span style={{
              fontFamily: HAND, fontSize: fs,
              color: t ? "#0d0d0d" : "transparent",
              flex: 1, overflow: "hidden", whiteSpace: "nowrap",
              textOverflow: "ellipsis", lineHeight: 1,
            }}>
              {t ? t.title : "x"}
            </span>
            {t && t.duration_ms > 0 && (
              <span style={{
                fontFamily: MONO, fontSize: fsSmall,
                color: "#999", flexShrink: 0, lineHeight: 1,
              }}>
                {fmt(t.duration_ms)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function CassetteBackCard({ sideA, sideB, width = 520 }: Props) {
  const height = Math.round(width * (1024 / 1536));
  const fs      = Math.round(width * 0.021);
  const fsSmall = Math.round(width * 0.015);
  const gap     = Math.round(width * 0.007);

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
        <SideLines
          tracks={sideA.slice(0, MAX_BACK_TRACKS)}
          left="8.5%" right="54%"
          fs={fs} fsSmall={fsSmall} gap={gap}
        />
        <SideLines
          tracks={sideB.slice(0, MAX_BACK_TRACKS)}
          left="53.5%" right="8%"
          fs={fs} fsSmall={fsSmall} gap={gap}
        />
      </div>
    </div>
  );
}
