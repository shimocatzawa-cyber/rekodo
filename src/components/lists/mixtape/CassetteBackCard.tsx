"use client";

// J-card style tracklist view — rendered as a div for html-to-image compatibility.
// Uses system cursive for the handwritten aesthetic.

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

const ORANGE = "#CC5500";
const INK    = "#1a1a1a";
const MUTED  = "#888";
const MONO   = '"Courier New", monospace';
const HAND   = '"Bradley Hand", "Caveat", "Kalam", cursive';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function SideCol({ side, tracks }: { side: "A" | "B"; tracks: TrackItem[] }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div style={{
        fontFamily: MONO, fontSize: 8, letterSpacing: "0.22em",
        textTransform: "uppercase", color: ORANGE,
        borderBottom: `1.5px solid ${ORANGE}`,
        paddingBottom: 4, marginBottom: 10,
      }}>
        Side {side}
      </div>

      {/* Tracks */}
      {tracks.map((t, i) => (
        <div key={i} style={{
          display: "flex", gap: 6, alignItems: "baseline",
          borderBottom: "1px solid #e8e4da",
          padding: "5px 0",
        }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, flexShrink: 0, width: 14 }}>
            {i + 1}.
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: HAND, fontSize: 13, color: INK, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {t.title}
            </div>
            <div style={{
              fontFamily: HAND, fontSize: 10, color: MUTED,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {t.artist}
            </div>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED, flexShrink: 0 }}>
            {t.duration_ms > 0 ? fmt(t.duration_ms) : ""}
          </span>
        </div>
      ))}

      {tracks.length === 0 && (
        <div style={{ fontFamily: HAND, fontSize: 13, color: "#ccc", paddingTop: 6 }}>—</div>
      )}
    </div>
  );
}

export default function CassetteBackCard({ title, sideA, sideB, cassetteType, width = 520 }: Props) {
  return (
    <div style={{
      width,
      background: "#f4f1e8",
      backgroundImage: `repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 25px,
        #e5e0d4 25px,
        #e5e0d4 26px
      )`,
      border: "1px solid #d8d3c8",
      borderRadius: 4,
      padding: "20px 24px 16px",
      boxSizing: "border-box",
    }}>
      {/* Title row */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 16,
      }}>
        <div style={{ fontFamily: HAND, fontSize: 28, fontWeight: 700, color: INK, lineHeight: 1 }}>
          {title || "My Mixtape"}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.1em" }}>
          {cassetteType}
        </div>
      </div>

      {/* Two-column track listing */}
      <div style={{ display: "flex", gap: 24 }}>
        <SideCol side="A" tracks={sideA} />
        <div style={{ width: 1, background: "#d8d3c8", flexShrink: 0 }} />
        <SideCol side="B" tracks={sideB} />
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 14, borderTop: "1px solid #d8d3c8", paddingTop: 8,
        fontFamily: MONO, fontSize: 8, color: "#b0aa9f",
        letterSpacing: "0.12em", textAlign: "center",
      }}>
        rekōdo
      </div>
    </div>
  );
}
