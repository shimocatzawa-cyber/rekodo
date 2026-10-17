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

// Usable content band inside the j-card image (% of image height, 1536×1024 source)
const TRACK_TOP    = 22;
const TRACK_BOTTOM = 86;

const HAND = '"Bradley Hand", "Caveat", "Kalam", cursive';
const MONO = '"Courier New", monospace';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function TrackColumn({
  tracks, left, right, n, slotPx, width,
}: {
  tracks: TrackItem[];
  left: string; right: string;
  n: number; slotPx: number; width: number;
}) {
  const slotPct  = (TRACK_BOTTOM - TRACK_TOP) / n;
  // Title font scales with row height; cap at a comfortable max
  const fsTitle  = Math.max(6,  Math.min(Math.round(slotPx * 0.36), Math.round(width * 0.022)));
  const fsArtist = Math.max(5,  Math.round(fsTitle * 0.75));
  const fsNum    = Math.max(5,  Math.round(fsTitle * 0.65));
  const gap      = Math.max(2,  Math.round(fsTitle * 0.3));
  const lineGap  = Math.max(1,  Math.round(fsTitle * 0.12));
  const indent   = Math.round(fsNum * 1.5 + gap);

  return (
    <>
      {tracks.map((t, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${TRACK_TOP + i * slotPct}%`,
            height: `${slotPct * 0.88}%`,
            left, right,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Track number + title + duration */}
          <div style={{ display: "flex", alignItems: "baseline", gap, overflow: "hidden" }}>
            <span style={{ fontFamily: MONO, fontSize: fsNum, color: "#c0c0c0", flexShrink: 0, lineHeight: 1 }}>
              {i + 1}.
            </span>
            <span style={{
              fontFamily: HAND, fontSize: fsTitle, color: "#0d0d0d",
              flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1,
            }}>
              {t.title}
            </span>
            {t.duration_ms > 0 && (
              <span style={{ fontFamily: MONO, fontSize: fsNum, color: "#aaa", flexShrink: 0, lineHeight: 1 }}>
                {fmt(t.duration_ms)}
              </span>
            )}
          </div>

          {/* Artist name — indented under the title */}
          {t.artist && (
            <div style={{ paddingLeft: indent, marginTop: lineGap, overflow: "hidden" }}>
              <span style={{
                fontFamily: HAND, fontSize: fsArtist, color: "#888",
                whiteSpace: "nowrap",
              }}>
                {t.artist}
              </span>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function CassetteBackCard({ sideA, sideB, width = 520 }: Props) {
  const height  = Math.round(width * (1024 / 1536));
  const n       = Math.max(sideA.length, sideB.length, 1);
  const slotPx  = height * (TRACK_BOTTOM - TRACK_TOP) / 100 / n;

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
          left="8%" right="54%"
          n={n} slotPx={slotPx} width={width}
        />
        <TrackColumn
          tracks={sideB}
          left="44%" right="7%"
          n={n} slotPx={slotPx} width={width}
        />
      </div>
    </div>
  );
}
