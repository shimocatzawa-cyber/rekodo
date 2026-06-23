// components/OnThisDay.tsx

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

export type OnThisDayPick = {
  artist: string;
  album: string;
  coverUrl: string | null;
  yearsAgo: number;
  dateAddedLabel: string; // e.g. "Jun 15"
};

export default function OnThisDay({ pick }: { pick: OnThisDayPick | null }) {
  if (!pick) return null;

  return (
    <div style={{ fontFamily: MONO, color: INK, borderTop: `1px solid ${RULE}` }}>
      {/* Eyebrow row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE }}>
          On This Day
        </span>
        <span style={{ fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.35 }}>
          This month in your collection
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "22px 0", display: "grid", gridTemplateColumns: "56px 1fr", gap: "18px", alignItems: "start" }}>
        <div style={{ paddingTop: "2px", width: "56px", height: "56px", background: pick.coverUrl ? undefined : "#f0ede8" }}>
          {pick.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pick.coverUrl} alt={pick.album} style={{ width: "56px", height: "56px", objectFit: "cover", display: "block" }} />
          )}
        </div>
        <div>
          <p style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "5px" }}>
            {pick.artist}
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.4, marginBottom: "7px" }}>
            {pick.album}
          </p>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.7, opacity: 0.65 }}>
            {pick.yearsAgo} year{pick.yearsAgo === 1 ? "" : "s"} ago this month ({pick.dateAddedLabel}), you brought this into the collection.
          </p>
        </div>
      </div>
    </div>
  );
}
