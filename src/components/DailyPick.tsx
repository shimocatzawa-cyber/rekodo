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
  label: string | null;
  country: string | null;
  year: number | null;
  genre: string | null;
  style: string | null;
  format: string | null;
  producers: string | null;
  playCount: number;
};

function LinerRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.06)", alignItems: "baseline" }}>
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", width: "64px", flexShrink: 0, lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: "11px", color: INK, letterSpacing: "0.03em", lineHeight: 1.4 }}>
        {value}
      </span>
    </div>
  );
}

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
      <div className="rk-daily-pick-grid" style={{ padding: "0 0 18px", display: "grid", gridTemplateColumns: "240px 1fr", gap: "20px" }}>
        <div
          className="rk-daily-pick-cover"
          style={{
            width: "240px",
            height: "240px",
            background: dailyPick.coverUrl ? undefined : "#f0ede8",
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
        <div>
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1rem", lineHeight: 1.5, color: INK, margin: "0 0 12px 0" }}>
            {dailyPick.blurb}
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 5px 0", lineHeight: 1.2 }}>
            {dailyPick.artist}
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.4, margin: "0 0 12px 0" }}>
            {dailyPick.album}
          </p>

          {/* Liner notes */}
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <LinerRow label="Label"   value={dailyPick.label} />
            <LinerRow label="Country" value={dailyPick.country} />
            <LinerRow label="Year"    value={dailyPick.year ? String(dailyPick.year) : null} />
            <LinerRow label="Genre"   value={dailyPick.genre} />
            <LinerRow label="Style"   value={dailyPick.style} />
            <LinerRow label="Format"  value={dailyPick.format} />
            <LinerRow label="Credits" value={dailyPick.producers} />
            <LinerRow label="Spins"   value={dailyPick.playCount > 0 ? `${dailyPick.playCount} logged` : null} />
          </div>
        </div>
      </div>
    </div>
  );
}
