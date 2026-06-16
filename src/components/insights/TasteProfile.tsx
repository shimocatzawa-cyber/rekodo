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
  styleBreakdown:       { style: string; count: number; pct: number }[];
  hasStyles:            boolean;
  vinylColourBreakdown: { colour: string; count: number; pct: number }[];
  spectrum:             SpectrumData;
}

// Colour-name keyword → badge palette, used to render vinyl colours as labels.
const COLOUR_BADGE_RULES: { kw: string; bg: string; color: string }[] = [
  { kw: "black",         bg: "#2b2b2b", color: "#ffffff" },
  { kw: "white",         bg: "#f2f2ec", color: "#0a0a0a" },
  { kw: "picture disc",  bg: "#1a1a1a", color: "#ffffff" },
  { kw: "clear",         bg: "#eef0ee", color: "#3a3a34" },
  { kw: "transparent",   bg: "#eef0ee", color: "#3a3a34" },
  { kw: "translucent",   bg: "#eef0ee", color: "#3a3a34" },
  { kw: "red",           bg: "#F0997B", color: "#712B13" },
  { kw: "blue",          bg: "#AFCBEB", color: "#1B3A66" },
  { kw: "green",         bg: "#C0DD97", color: "#27500A" },
  { kw: "yellow",        bg: "#FAC775", color: "#633806" },
  { kw: "gold",          bg: "#FAC775", color: "#633806" },
  { kw: "orange",        bg: "#F7B978", color: "#6B3A05" },
  { kw: "purple",        bg: "#CECBF6", color: "#3C3489" },
  { kw: "violet",        bg: "#CECBF6", color: "#3C3489" },
  { kw: "pink",          bg: "#F3C9D9", color: "#7A1F44" },
  { kw: "marbled",       bg: "#DCD5C4", color: "#4A4030" },
  { kw: "splatter",      bg: "#DCD5C4", color: "#4A4030" },
  { kw: "silver",        bg: "#E2E2DC", color: "#3a3a3a" },
  { kw: "grey",          bg: "#cfcfc8", color: "#2b2b2b" },
  { kw: "gray",          bg: "#cfcfc8", color: "#2b2b2b" },
  { kw: "brown",         bg: "#C9A876", color: "#4A2E0A" },
];
const DEFAULT_BADGE = { bg: "#EDEDE8", color: "#3a3a34" };

function colourBadge(value: string): { bg: string; color: string } {
  const v = value.toLowerCase();
  return COLOUR_BADGE_RULES.find((r) => v.includes(r.kw)) ?? DEFAULT_BADGE;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
      textTransform: "uppercase", color: INK, fontWeight: 700,
      margin: "0 0 14px",
    }}>
      {children}
    </p>
  );
}

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

export default function TasteProfile({ styleBreakdown, hasStyles, vinylColourBreakdown, spectrum }: TasteProfileProps) {
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

      {/* ── Style + Pressing Colours ─────────────────────────────────────── */}
      <TasteSectionHeader eyebrow="Style" title="What you reach for." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
        <div>
          <SubLabel>Style</SubLabel>
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
        </div>

        <div>
          <SubLabel>Pressing Colours</SubLabel>
          {vinylColourBreakdown.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
              Colour data will appear here after your next Discogs sync.
            </p>
          ) : (
            <div style={{ borderTop: `0.5px solid ${RULE}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 56px 64px",
                gap: "12px", padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
              }}>
                {["Colour", "Items", "Share"].map((h) => (
                  <span key={h} style={{
                    fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: INK,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {vinylColourBreakdown.map(({ colour, count, pct }) => {
                const badge = colourBadge(colour);
                return (
                  <div key={colour} style={{
                    display: "grid", gridTemplateColumns: "1fr 56px 64px",
                    gap: "12px", padding: "12px 0", borderBottom: `0.5px solid ${RULE}`,
                    alignItems: "center",
                  }}>
                    <span style={{
                      display: "inline-block", width: "fit-content",
                      fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                      background: badge.bg, color: badge.color,
                      padding: "3px 8px", borderRadius: "3px",
                      whiteSpace: "nowrap",
                    }}>
                      {colour}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                      {count}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
