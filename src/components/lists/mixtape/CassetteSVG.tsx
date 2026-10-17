"use client";

// Uses the real cassette photo with the mixtape title overlaid on the white label.
// sideAFill / sideBFill are kept in the interface for compatibility but not
// visualised — the photo is a static asset.

interface Props {
  title: string;
  sideAFill: number;
  sideBFill: number;
  activeSide: "A" | "B";
  width?: number;
}

export default function CassetteSVG({ title, activeSide, width = 520 }: Props) {
  // Image is 1536 × 1024 — maintain aspect ratio
  const height = Math.round(width * (1024 / 1536));

  // Scale font relative to display width and title length
  const baseSize = width * 0.072;
  const fontSize  = title.length > 22 ? baseSize * 0.48
                  : title.length > 16 ? baseSize * 0.58
                  : title.length > 10 ? baseSize * 0.72
                  : baseSize;

  return (
    <div style={{ position: "relative", width, height, display: "inline-block", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cassette-tape.png"
        alt="Cassette tape"
        width={width}
        height={height}
        style={{ display: "block", width: "100%", height: "100%" }}
      />

      {/* Mixtape title — overlaid on the white label where "rekodo" appears */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "62%",
          textAlign: "center",
          fontFamily: '"Bradley Hand", "Caveat", "Kalam", cursive',
          fontSize: Math.round(fontSize),
          color: "#0d0d0d",
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title || "My Mixtape"}
      </div>

      {/* Side indicator */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: '"Courier New", monospace',
          fontSize: Math.round(width * 0.018),
          color: "#888",
          letterSpacing: "0.22em",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {`SIDE ${activeSide}`}
      </div>
    </div>
  );
}
