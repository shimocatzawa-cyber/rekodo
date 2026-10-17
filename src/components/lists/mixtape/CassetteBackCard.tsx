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

const INK  = "#0d0d0d";
const MONO = '"Courier New", monospace';
const HAND = '"Bradley Hand", "Caveat", "Kalam", cursive';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function SideBadge({ letter }: { letter: string }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: INK, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: HAND, fontSize: 20, fontWeight: 700, flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

function TrackCircle({ n }: { n: number }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: "50%",
      border: "1.5px solid #1a1a1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: MONO, fontSize: 9, color: INK, flexShrink: 0,
    }}>
      {n}
    </div>
  );
}

function SideCol({ side, tracks }: { side: "A" | "B"; tracks: TrackItem[] }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Side header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SideBadge letter={side} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.18em", color: "#888" }}>
            SIDE
          </div>
          <div style={{ fontFamily: HAND, fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1 }}>
            {side}
          </div>
        </div>
      </div>

      {/* Tracks */}
      {tracks.map((t, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 7,
          borderBottom: "1px solid #ddd",
          padding: "5px 0",
        }}>
          <TrackCircle n={i + 1} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: HAND, fontSize: 13, color: INK, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {t.title}
            </div>
            <div style={{
              fontFamily: HAND, fontSize: 10, color: "#666",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {t.artist}
            </div>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#444", flexShrink: 0 }}>
            {t.duration_ms > 0 ? fmt(t.duration_ms) : ""}
          </span>
        </div>
      ))}

      {tracks.length === 0 && (
        <div style={{ fontFamily: HAND, fontSize: 13, color: "#bbb", padding: "6px 0" }}>—</div>
      )}
    </div>
  );
}

export default function CassetteBackCard({ title, sideA, sideB, cassetteType, width = 520 }: Props) {
  return (
    <div style={{
      width,
      background: "#ffffff",
      backgroundImage: `repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 26px,
        #e8e8e8 26px,
        #e8e8e8 27px
      )`,
      border: "1px solid #ccc",
      boxSizing: "border-box",
    }}>
      {/* Top header bar — black */}
      <div style={{
        background: INK,
        padding: "10px 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontFamily: HAND, fontSize: 22, color: "#fff", fontWeight: 700 }}>
          {title || "My Mixtape"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: "#aaa", letterSpacing: "0.14em" }}>
            {cassetteType}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#fff", letterSpacing: "0.06em" }}>
            rek<span style={{ color: "#CC5500" }}>ō</span>do
          </span>
        </div>
      </div>

      {/* Two-column track listing */}
      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ flex: 1, minWidth: 0, padding: "14px 16px 16px" }}>
          <SideCol side="A" tracks={sideA} />
        </div>
        <div style={{ width: 1, background: "#ddd", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: "14px 16px 16px" }}>
          <SideCol side="B" tracks={sideB} />
        </div>
      </div>
    </div>
  );
}
