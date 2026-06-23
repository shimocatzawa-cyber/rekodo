// components/DailyPick.tsx

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

export type DailyPickData = {
  artist: string;
  album: string;
  coverUrl: string | null;
  feeling: string | null;
  blurb: string;
};

export default function DailyPick({ dailyPick }: { dailyPick: DailyPickData | null }) {
  if (!dailyPick) return null;

  return (
    <div style={{ fontFamily: MONO, color: INK, borderTop: `1px solid ${RULE}` }}>
      {/* Eyebrow row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE }}>
          Daily Pick
        </span>
        <span style={{ fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.35 }}>
          A new spin each day
        </span>
      </div>

      {/* Gatefold spread */}
      <div style={{ padding: "0 0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", position: "relative" }}>
        <div
          style={{
            aspectRatio: "1 / 1",
            background: dailyPick.coverUrl ? undefined : "#f0ede8",
            boxShadow: "inset -8px 0 8px -8px rgba(0,0,0,0.15)",
          }}
        >
          {dailyPick.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dailyPick.coverUrl}
              alt={dailyPick.album}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          )}
        </div>
        <div
          style={{
            padding: "16px 0 0 20px",
            boxShadow: "inset 8px 0 8px -8px rgba(0,0,0,0.15)",
          }}
        >
          <p style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 5px 0", lineHeight: 1.2 }}>
            {dailyPick.artist}
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.4, margin: "0 0 7px 0" }}>
            {dailyPick.album}
          </p>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.7, opacity: 0.65, margin: 0 }}>
            {dailyPick.blurb}
          </p>
        </div>
      </div>
    </div>
  );
}
