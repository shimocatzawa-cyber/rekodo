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
  topPlayedRecords:     { artist: string; album: string; coverUrl: string | null; lastPlayedAt: string; playCount: number }[];
  playedStyleBreakdown: { style: string; count: number; pct: number }[];
  usageStats: {
    digDiscover:   number;
    digExplore:    number;
    digStyle:      number;
    deepDiveCount: number;
    listsTotal:    number;
    listLikes:     number;
  };
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

// ── Donut chart colours ─────────────────────────────────────────────────────────
const DONUT_COLOURS = [
  "#CC5500", // orange (brand)
  "#1B3A66", // dark blue
  "#9FE1CB", // teal
  "#FAC775", // gold
  "#CECBF6", // lavender
  "#C0DD97", // green
  "#F0997B", // salmon
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

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

function StyleLegend({ data }: { data: { style: string; count: number; pct: number }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
      {data.map((d, i) => (
        <div key={d.style} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", flexShrink: 0, background: DONUT_COLOURS[i % DONUT_COLOURS.length] }} />
          <span style={{ fontFamily: MONO, fontSize: "10px", color: INK, lineHeight: 1.2, flex: 1 }}>
            {d.style}
          </span>
          <span style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa" }}>
            {d.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TasteProfile({
  styleBreakdown, hasStyles, vinylColourBreakdown, spectrum,
  topPlayedRecords, playedStyleBreakdown, usageStats,
}: TasteProfileProps) {
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
      {/* ── Listening History ─────────────────────────────────────────────── */}
      {topPlayedRecords.length > 0 && (
        <>
          <TasteSectionHeader eyebrow="Listening History" title="What you've been reaching for." />

          <div className="rk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>

            {/* Top 5 Played */}
            <div>
              <SubLabel>Most played</SubLabel>
              <div style={{ borderTop: `0.5px solid ${RULE}` }}>
                {topPlayedRecords.map((rec, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
                  }}>
                    {rec.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rec.coverUrl}
                        alt=""
                        width={36}
                        height={36}
                        style={{ width: 36, height: 36, objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, background: RULE, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa" }}>—</span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: MONO, fontSize: "11px", color: INK,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {rec.artist}
                      </div>
                      <div style={{
                        fontFamily: MONO, fontSize: "10px", color: "#888",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginTop: "2px",
                      }}>
                        {rec.album}
                      </div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: "10px", color: ORANGE, flexShrink: 0 }}>
                      {`×${Math.max(rec.playCount, 1)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Played by Style donut */}
            <div>
              <SubLabel>Played by style</SubLabel>
              {playedStyleBreakdown.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#aaaaaa", margin: 0 }}>
                  Style data will appear once your played records have been enriched.
                </p>
              ) : (
                <StyleLegend data={playedStyleBreakdown} />
              )}
            </div>

          </div>

          <div style={{ borderTop: `1px solid ${RULE}`, margin: "40px 0" }} />
        </>
      )}

      {/* ── rekodo Activity ───────────────────────────────────────────────── */}
      <TasteSectionHeader eyebrow="rekodo Activity" title="How you use the app." />

      {/* Stat tiles */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        border: `1px solid ${RULE}`, marginBottom: "32px",
      }}>
        {[
          { hero: usageStats.digDiscover.toLocaleString(),   label: "Digs · In Collection" },
          { hero: usageStats.digExplore.toLocaleString(),    label: "Digs · Outside" },
          { hero: usageStats.digStyle.toLocaleString(),      label: "Digs · By Style" },
          { hero: usageStats.deepDiveCount.toLocaleString(), label: "Deep Dives" },
          { hero: usageStats.listsTotal.toLocaleString(),    label: "Lists Created" },
          { hero: usageStats.listLikes.toLocaleString(),     label: "List Likes" },
        ].map((tile, i) => (
          <div key={i} style={{
            padding: "16px 18px",
            borderRight: (i + 1) % 3 !== 0 ? `1px solid ${RULE}` : "none",
            borderBottom: i < 3 ? `1px solid ${RULE}` : "none",
          }}>
            <p style={{
              fontFamily: "var(--font-editorial)", fontSize: "1.4rem", fontWeight: 400,
              color: INK, lineHeight: 1.1, margin: "0 0 5px", letterSpacing: "-0.01em",
            }}>
              {tile.hero}
            </p>
            <p style={{
              fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#aaaaaa", margin: 0,
            }}>
              {tile.label}
            </p>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${RULE}`, margin: "40px 0" }} />

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

      <div className="rk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
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
            <div className="rk-ins-fmt" style={{ borderTop: `0.5px solid ${RULE}` }}>
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
