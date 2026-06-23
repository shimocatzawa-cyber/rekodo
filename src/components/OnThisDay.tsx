// components/OnThisDay.tsx

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

export type OnThisDayItem = {
  artist: string;
  album: string;
  coverUrl: string | null;
  yearsAgo: number;
};

export default function OnThisDay({ items }: { items: OnThisDayItem[] }) {
  if (items.length === 0) return null;

  return (
    <div style={{ fontFamily: MONO, color: INK, borderTop: `1px solid ${RULE}` }}>
      {/* Eyebrow row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE }}>
          On This Day
        </span>
        <span style={{ fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.35 }}>
          Added to your collection
        </span>
      </div>

      {/* Rows */}
      <div style={{ padding: "4px 0 18px" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr",
              gap: "14px",
              alignItems: "center",
              padding: "9px 0",
            }}
          >
            <div style={{ width: "40px", height: "40px", background: item.coverUrl ? undefined : "#f0ede8" }}>
              {item.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.coverUrl}
                  alt={item.album}
                  style={{ width: "40px", height: "40px", objectFit: "cover", display: "block" }}
                />
              )}
            </div>
            <div>
              <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 2px 0", lineHeight: 1.25 }}>
                {item.artist} — {item.album}
              </p>
              <p style={{ fontSize: "0.72rem", letterSpacing: "0.04em", opacity: 0.5, margin: 0 }}>
                {item.yearsAgo} year{item.yearsAgo === 1 ? "" : "s"} ago today
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
