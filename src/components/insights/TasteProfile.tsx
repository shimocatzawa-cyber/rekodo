const SERIF     = "var(--font-editorial)";
const MONO      = "var(--font-mono)";
const ORANGE    = "#CC5500";
const INK       = "#0a0a0a";
const RULE      = "#e0e0da";
const DARK_BLUE = "#1B3A66";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SpectrumData {
  abrasivePosition:       number | null;
  rarityPosition:         number | null;
  nostalgicPosition:      number | null;
  completistPosition:     number | null;
  nonWesternPosition:     number | null;
  curatorPosition:        number | null;
  formatAgnosticPosition: number | null;
}

interface TasteProfileProps {
  styleBreakdown: { style: string; count: number; pct: number }[];
  hasStyles:      boolean;
  spectrum:       SpectrumData;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TasteSectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <p style={{
        fontFamily: MONO, fontSize: "11px", letterSpacing: "0.12em",
        textTransform: "uppercase", color: ORANGE, margin: "0 0 8px",
      }}>
        {eyebrow}
      </p>
      <h2 style={{
        fontFamily: SERIF, fontSize: "16px", fontWeight: 600,
        color: INK, lineHeight: 1.3, margin: "0 0 16px",
      }}>
        {title}
      </h2>
      <div style={{ borderTop: `1px solid ${RULE}` }} />
    </div>
  );
}

function PercentBar({ pct, maxPct = 100 }: { pct: number; maxPct?: number }) {
  const fill = maxPct > 0 ? Math.min((pct / maxPct) * 100, 100) : Math.min(pct, 100);
  return (
    <div style={{ height: "3px", background: RULE, borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ width: `${fill}%`, height: "100%", background: ORANGE, borderRadius: "2px" }} />
    </div>
  );
}

interface SpectrumAxis {
  left:  string;
  right: string;
  value: number | null;
}

function SpectrumRow({ left, right, value }: SpectrumAxis) {
  const hasData = value != null;
  const pos = hasData ? Math.max(5, Math.min(95, value)) : 50;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "13px 0", borderBottom: `1px solid ${DARK_BLUE}` }}>
      <span style={{
        width: "56px", flexShrink: 0, textAlign: "right",
        fontFamily: MONO, fontSize: "10px", color: DARK_BLUE,
      }}>
        {left}
      </span>
      <div style={{ flex: 1, height: "3px", background: DARK_BLUE, position: "relative" }}>
        <div style={{
          position: "absolute", top: "50%", left: `${pos}%`,
          transform: "translate(-50%, -50%)",
          width: "10px", height: "10px",
          border: `2px solid ${ORANGE}`,
          background: "#ffffff",
          opacity: hasData ? 1 : 0.45,
        }} />
      </div>
      <span style={{
        width: "56px", flexShrink: 0, textAlign: "left",
        fontFamily: MONO, fontSize: "10px", color: DARK_BLUE,
      }}>
        {right}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TasteProfile({ styleBreakdown, hasStyles, spectrum }: TasteProfileProps) {
  const maxStylePct = styleBreakdown[0]?.pct ?? 100;

  const axes: SpectrumAxis[] = [
    { left: "Ambient",     right: "Abrasive",        value: spectrum.abrasivePosition },
    { left: "Canon",       right: "Obscure",         value: spectrum.rarityPosition },
    { left: "Nostalgic",   right: "Contemporary",    value: spectrum.nostalgicPosition },
    { left: "Broad",       right: "Completist",      value: spectrum.completistPosition },
    { left: "Western",     right: "Non-western",     value: spectrum.nonWesternPosition },
    { left: "Accumulator", right: "Curator",         value: spectrum.curatorPosition },
    { left: "Vinyl pure",  right: "Format agnostic", value: spectrum.formatAgnosticPosition },
  ];

  return (
    <>
      {/* ── Spectrum Dimensions ───────────────────────────────────────────── */}
      <TasteSectionHeader eyebrow="SPECTRUM DIMENSIONS" title="Where you sit on each axis." />

      <div>
        {axes.map((axis) => (
          <SpectrumRow key={`${axis.left}-${axis.right}`} {...axis} />
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${RULE}`, margin: "40px 0" }} />

      {/* ── Style ─────────────────────────────────────────────────────────── */}
      <TasteSectionHeader eyebrow="Style" title="What you reach for." />

      {!hasStyles ? (
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
          Style data available after a full resync of your collection.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {styleBreakdown.map(({ style, count, pct }) => (
            <div key={style}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: "6px",
              }}>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>{style}</span>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                  {count} items · <span style={{ color: ORANGE }}>{pct}%</span>
                </span>
              </div>
              <PercentBar pct={pct} maxPct={maxStylePct} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
