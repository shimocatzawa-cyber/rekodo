"use client";

import { useState, useEffect, type ReactNode } from "react";
import { AreaChart, BarChart, type CustomTooltipProps } from "@tremor/react";
import AppNav from "@/components/AppNav";
import TasteProfile, { type SpectrumData } from "@/components/insights/TasteProfile";
import type { DesirabilityTier } from "@/lib/desirability";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InsightsProps {
  username:       string;
  displayLabel?:  string;
  avatarUrl?:     string | null;
  currency:       string;
  totalLow:       number;
  totalMed:       number;
  totalHigh:      number;
  totalRecords:   number;
  snapshots:      { date: string; "Total Value": number }[];
  topRecordsByValue: { artist: string; album: string; coverUrl: string | null; price_median: number; price_low: number; price_high: number }[];
  mediaConditionBreakdown:  { grade: string; count: number; pct: number }[];
  sleeveConditionBreakdown: { grade: string; count: number; pct: number }[];
  genreBreakdown:  { genre: string; count: number; valueSum: number; pct: number }[];
  styleBreakdown:  { style: string; count: number; pct: number }[];
  hasStyles:       boolean;
  countryBreakdown: { country: string; count: number; valueSum: number; pct: number }[];
  topLabels:     { label: string; count: number; valueSum: number }[];
  topArtists:    { artist: string; count: number; valueSum: number }[];
  topProducers:  { producer: string; count: number; valueSum: number }[];
  formatBreakdown: { format: string; count: number; valueSum: number }[];
  desirabilityBreakdown: { tier: DesirabilityTier; count: number; valueSum: number }[];
  topFormat:       { name: string; count: number } | null;
  yearRange:       { oldest: number; newest: number } | null;
  mostPopularYear: number | null;
  vinylColourBreakdown: { colour: string; count: number; pct: number }[];
  collectionLifespan: { period: string; Added: number }[];
  collectionByMonth: { period: string; Added: number }[];
  spectrum:           SpectrumData;
}

// ── Tier metadata ──────────────────────────────────────────────────────────────

const TIER_META: Record<DesirabilityTier, { label: string; bg: string; color: string }> = {
  "holy-grail":   { label: "Holy Grail",    bg: "#FAC775", color: "#633806" },
  "rare":         { label: "Rare",          bg: "#F0997B", color: "#712B13" },
  "cult":         { label: "Cult Pressing", bg: "#CECBF6", color: "#3C3489" },
  "widely-loved": { label: "Widely Loved",  bg: "#C0DD97", color: "#27500A" },
  "in-demand":    { label: "In Demand",     bg: "#9FE1CB", color: "#085041" },
};

// Colour-name keyword → badge palette, used to render vinyl colours as labels
// in the same style as the desirability tier pills above.
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string): string {
  const prefixes: Record<string, string> = {
    AUD: "A$", USD: "$", GBP: "£", EUR: "€", JPY: "¥",
    CAD: "C$", NZD: "NZ$", SGD: "S$", HKD: "HK$",
    CHF: "CHF ", SEK: "SEK ", NOK: "NOK ", DKK: "DKK ",
    KRW: "₩", INR: "₹", BRL: "R$", MXN: "MX$", ZAR: "R ", CNY: "¥",
  };
  const prefix = prefixes[currency.toUpperCase()] ?? `${currency} `;
  return `${prefix}${Math.round(amount).toLocaleString("en-AU")}`;
}

function fmtValueShort(amount: number, currency: string): string {
  const prefixes: Record<string, string> = {
    AUD: "A$", USD: "$", GBP: "£", EUR: "€", JPY: "¥",
    CAD: "C$", NZD: "NZ$", SGD: "S$", HKD: "HK$",
    CHF: "CHF ", SEK: "SEK ", NOK: "NOK ", DKK: "DKK ",
    KRW: "₩", INR: "₹", BRL: "R$", MXN: "MX$", ZAR: "R ", CNY: "¥",
  };
  const prefix = prefixes[currency.toUpperCase()] ?? `${currency} `;
  if (amount >= 1000) return `${prefix}${(amount / 1000).toFixed(1)}k`;
  return `${prefix}${Math.round(amount).toLocaleString("en-AU")}`;
}

function fmtFormatLabel(name: string): string {
  const u = name.toUpperCase();
  if (u === "LP")       return "Vinyl LPs";
  if (u === "VINYL")    return "Vinyl";
  if (u === "CD")       return "CDs";
  if (u === "CASSETTE") return "Cassettes";
  if (u === '7"')       return '7" Singles';
  if (u === '10"')      return '10" Singles';
  if (u === '12"')      return '12" Singles';
  if (u === "EP")       return "EPs";
  return name;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionDivider() {
  return <div style={{ borderTop: `1px solid ${RULE}`, margin: "40px 0" }} />;
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <p style={{
        fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em",
        textTransform: "uppercase", color: ORANGE, margin: "0 0 8px",
      }}>
        {eyebrow}
      </p>
      <h2 style={{
        fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 600,
        color: INK, letterSpacing: "-0.025em", lineHeight: 1.15,
        margin: "0 0 16px",
      }}>
        {title}
      </h2>
      <div style={{ borderTop: `1px solid ${RULE}` }} />
    </div>
  );
}

function AddedTooltip({ payload, active, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const count = Number(payload[0]?.value ?? 0);
  return (
    <div style={{
      background: "#ffffff", border: `1px solid ${RULE}`, borderRadius: "3px",
      padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <p style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 700, color: INK, margin: "0 0 2px" }}>
        {label}
      </p>
      <p style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, margin: 0 }}>
        {count} item{count !== 1 ? "s" : ""} added
      </p>
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
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

function PercentBar({ pct, maxPct = 100 }: { pct: number; maxPct?: number }) {
  const fill = maxPct > 0 ? Math.min((pct / maxPct) * 100, 100) : Math.min(pct, 100);
  return (
    <div style={{ height: "3px", background: RULE, borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ width: `${fill}%`, height: "100%", background: ORANGE, borderRadius: "2px" }} />
    </div>
  );
}

type StatTile = {
  hero:       string;
  label:      string;
  heroColor?: string;
};

function StatBar({ tiles }: { tiles: StatTile[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      background: "#FEFBF8",
      borderBottom: `1px solid ${RULE}`,
      marginBottom: "32px",
    }}>
      {tiles.map((t, i) => {
        const hasRightBorder = (i + 1) % 5 !== 0 && i !== tiles.length - 1;
        const hasBottomBorder = i < 5;
        return (
          <div key={i} style={{
            padding: "14px 16px",
            borderRight:  hasRightBorder  ? `1px solid ${RULE}` : "none",
            borderBottom: hasBottomBorder ? `1px solid ${RULE}` : "none",
          }}>
            <p style={{
              fontFamily: SERIF, fontSize: "1.25rem", fontWeight: 400,
              color: t.heroColor ?? INK, lineHeight: 1.2,
              margin: "0 0 5px", letterSpacing: "-0.01em",
              wordBreak: "break-word",
            }}>
              {t.hero}
            </p>
            <p style={{
              fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#aaaaaa",
              lineHeight: 1.3, margin: 0,
            }}>
              {t.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InsightsClient({
  username, displayLabel, avatarUrl, currency,
  totalMed, totalRecords, snapshots, topRecordsByValue,
  mediaConditionBreakdown, sleeveConditionBreakdown,
  genreBreakdown, styleBreakdown, hasStyles,
  countryBreakdown, topLabels, topArtists, topProducers,
  formatBreakdown, desirabilityBreakdown,
  topFormat, yearRange, mostPopularYear, vinylColourBreakdown,
  collectionLifespan, collectionByMonth, spectrum,
}: InsightsProps) {

  const [oneLiner, setOneLiner] = useState<string | null>(null);
  const [insightsTab, setInsightsTab] = useState<"collection" | "taste-profile">("collection");

  useEffect(() => {
    if (totalRecords < 5) return;
    fetch("/api/insights", { method: "POST" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.oneLiner) setOneLiner(d.oneLiner); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSparkline    = snapshots.length >= 1;
  const maxGenrePct     = genreBreakdown[0]?.pct      ?? 100;
  const maxCountryCount = countryBreakdown[0]?.count  ?? 1;

  // Derive stats bar tiles from available data
  const holyGrailCount  = desirabilityBreakdown.find((d) => d.tier === "holy-grail")?.count ?? 0;
  const topRealGenre    = genreBreakdown.find((g) => g.genre !== "Unknown" && g.genre !== "");
  const topPressOrigin  = countryBreakdown[0] ?? null;
  const topArtist       = topArtists[0] ?? null;
  const topLabel        = topLabels[0]  ?? null;

  const statTiles: StatTile[] = [
    { hero: totalRecords.toLocaleString(), label: "Items" },
    ...(topFormat ? [{ hero: topFormat.count.toLocaleString(), label: fmtFormatLabel(topFormat.name) }] : []),
    ...(topRealGenre ? [{ hero: `${topRealGenre.pct}%`, label: topRealGenre.genre }] : []),
    ...(topPressOrigin ? [{ hero: `${topPressOrigin.pct}%`, label: topPressOrigin.country }] : []),
    ...(topArtist ? [{ hero: topArtist.artist, label: `${topArtist.count} vinyl items` }] : []),
    ...(topLabel ? [{ hero: topLabel.label, label: `${topLabel.count} label items` }] : []),
    ...(yearRange ? [{ hero: yearRange.oldest !== yearRange.newest ? `${yearRange.oldest} → ${yearRange.newest}` : String(yearRange.oldest), label: "Collection span" }] : []),
    ...(mostPopularYear ? [{ hero: String(mostPopularYear), label: "Most collected year" }] : []),
    ...(holyGrailCount > 0 ? [{ hero: holyGrailCount.toLocaleString(), label: "Holy Grail" }] : []),
    { hero: totalMed > 0 ? fmtValueShort(totalMed, currency) : "—", label: "Median collection value" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", justifyContent: "center", gap: "24px", paddingTop: "14px", paddingBottom: "2px", background: "#ffffff" }}>
        {(["collection", "taste-profile"] as const).map((tab) => {
          const label = tab === "collection" ? "Collection" : "Taste Profile";
          return (
            <button
              key={tab}
              onClick={() => setInsightsTab(tab)}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
                textTransform: "uppercase", background: "none", border: "none",
                borderBottom: `1.5px solid ${insightsTab === tab ? ORANGE : "transparent"}`,
                padding: "6px 0",
                color: insightsTab === tab ? INK : "#bbbbbb",
                cursor: "pointer", display: "inline-block",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {insightsTab === "collection" && (
      <main style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>


        {/* ── Stats Bar ───────────────────────────────────────────────────── */}
        <StatBar tiles={statTiles} />

        {/* ── AI one-liner ────────────────────────────────────────────────── */}
        {oneLiner && (
          <div style={{
            marginBottom: "48px",
            paddingLeft: "12px",
            borderLeft: `2px solid ${ORANGE}`,
          }}>
            <p style={{
              fontFamily: SERIF, fontStyle: "italic",
              fontSize: "14px", color: "#888888",
              letterSpacing: "0.01em", lineHeight: 1.6, margin: 0,
            }}>
              {oneLiner}
            </p>
          </div>
        )}

        {/* ── Section 0: Collection Lifespan ─────────────────────────────────── */}
        <SectionHeader eyebrow="Collection Lifespan" title="When you added to it." />

        {collectionLifespan.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
            Lifespan data will appear here after your next Discogs sync.
          </p>
        ) : (
          <div style={{ marginBottom: "40px" }}>
            <SubLabel>Collection by year</SubLabel>
            <BarChart
              data={collectionLifespan}
              index="period"
              categories={["Added"]}
              colors={["orange"]}
              showLegend={false}
              showGridLines={false}
              customTooltip={AddedTooltip}
              tickGap={0}
              className="h-48 rekodo-chart rekodo-chart--compact"
            />
          </div>
        )}

        {/* Collection by month — rolling last 12 months */}
        <div style={{ marginBottom: "40px" }}>
          <SubLabel>Collection by month (last 12 months)</SubLabel>
          <BarChart
            data={collectionByMonth}
            index="period"
            categories={["Added"]}
            colors={["orange"]}
            showLegend={false}
            showGridLines={false}
            customTooltip={AddedTooltip}
            tickGap={0}
            className="h-48 rekodo-chart rekodo-chart--compact"
          />
        </div>

        <SectionDivider />

        {/* ── Section 1: Collection Value ──────────────────────────────────── */}
        <SectionHeader eyebrow="Collection Value" title="What it's worth." />

        {/* Sparkline */}
        <div style={{ marginBottom: "40px" }}>
          <SubLabel>Median value over time</SubLabel>
          {hasSparkline ? (
            <AreaChart
              data={snapshots}
              index="date"
              categories={["Total Value"]}
              colors={["orange"]}
              showLegend={false}
              showYAxis={false}
              showGridLines={false}
              className="h-32"
            />
          ) : (
            <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
              Trend available after your next sync.
            </p>
          )}
        </div>

        {/* Format breakdown */}
        {formatBreakdown.length > 0 && (
          <div style={{ marginBottom: "40px" }}>
            <SubLabel>Collection by format</SubLabel>
            <div style={{ borderTop: `0.5px solid ${RULE}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 80px 160px",
                gap: "16px", padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
              }}>
                {["Format", "Items", "Market Value"].map((h) => (
                  <span key={h} style={{
                    fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: INK,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {formatBreakdown.map(({ format, count, valueSum }) => (
                <div key={format} style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 160px",
                  gap: "16px", padding: "12px 0", borderBottom: `0.5px solid ${RULE}`,
                  alignItems: "center",
                }}>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                    {fmtFormatLabel(format)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                    {count}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE }}>
                    {valueSum > 0 ? fmtCurrency(valueSum, currency) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desirability breakdown */}
        {desirabilityBreakdown.length > 0 && (
          <div style={{ marginBottom: "40px" }}>
            <SubLabel>Collection by desirability</SubLabel>
            <div style={{ borderTop: `0.5px solid ${RULE}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 80px 160px",
                gap: "16px", padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
              }}>
                {["Tier", "Items", "Market Value"].map((h) => (
                  <span key={h} style={{
                    fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: INK,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {desirabilityBreakdown.map(({ tier, count, valueSum }) => {
                const meta = TIER_META[tier];
                return (
                  <div key={tier} style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 160px",
                    gap: "16px", padding: "12px 0", borderBottom: `0.5px solid ${RULE}`,
                    alignItems: "center",
                  }}>
                    <span style={{
                      display: "inline-block", width: "fit-content",
                      fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                      background: meta.bg, color: meta.color,
                      padding: "3px 8px", borderRadius: "3px",
                      whiteSpace: "nowrap",
                    }}>
                      {meta.label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                      {count}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE }}>
                      {valueSum > 0 ? fmtCurrency(valueSum, currency) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top 5 records */}
        {topRecordsByValue.length > 0 && (
          <div>
            <SubLabel>Top items by value</SubLabel>
            <div style={{ borderTop: `0.5px solid ${RULE}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: "44px 1fr 1fr 160px",
                gap: "16px", padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
              }}>
                {["", "Artist", "Album", "Market Value"].map((h) => (
                  <span key={h} style={{
                    fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: INK,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {topRecordsByValue.map((r, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr 1fr 160px",
                  gap: "16px", padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
                  alignItems: "center",
                }}>
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.coverUrl}
                      alt=""
                      width={44}
                      height={44}
                      style={{ width: "44px", height: "44px", objectFit: "cover", display: "block", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: "44px", height: "44px", background: RULE,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa" }}>—</span>
                    </div>
                  )}
                  <span style={{
                    fontFamily: MONO, fontSize: "11px", color: INK,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.artist}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: "11px", color: INK,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.album}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE }}>
                    {fmtCurrency(r.price_median, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SectionDivider />

        {/* ── Section 2: Collection Condition ──────────────────────────────── */}
        <SectionHeader eyebrow="Collection Condition" title="How well you look after them." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
          {[
            { label: "Media Grade",  data: mediaConditionBreakdown  },
            { label: "Sleeve Grade", data: sleeveConditionBreakdown },
          ].map(({ label, data }) => (
            <div key={label}>
              <SubLabel>{label}</SubLabel>
              {data.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
                  No condition data recorded.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {data.map(({ grade, count, pct }) => (
                    <div key={grade}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "baseline", marginBottom: "6px",
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>{grade}</span>
                        <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                          {count}{" "}<span style={{ color: ORANGE }}>{pct}%</span>
                        </span>
                      </div>
                      <PercentBar pct={pct} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <SectionDivider />

        {/* ── Section 3: Genre ──────────────────────────────────────────────── */}
        <SectionHeader eyebrow="Genre" title="What you reach for." />

        {genreBreakdown.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
            No genre data available.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {genreBreakdown.map(({ genre, count, pct }) => (
              <div key={genre}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", marginBottom: "6px", gap: "12px",
                }}>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>{genre}</span>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK, whiteSpace: "nowrap" }}>
                    {count} items · <span style={{ color: ORANGE }}>{pct}%</span>
                  </span>
                </div>
                <PercentBar pct={pct} maxPct={maxGenrePct} />
              </div>
            ))}
          </div>
        )}

        <SectionDivider />

        {/* ── Section 4: Geographic DNA ──────────────────────────────────────── */}
        <SectionHeader eyebrow="Geographic DNA" title="Where your items come from." />

        <SubLabel>Pressing Origins</SubLabel>
        {countryBreakdown.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
            No country data available.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {countryBreakdown.map(({ country, count, pct }, i) => (
              <div key={country}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "6px", gap: "12px",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
                    <span style={{
                      fontFamily: SERIF, fontSize: "13px", fontWeight: 700,
                      color: ORANGE, minWidth: "22px",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>{country}</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK, whiteSpace: "nowrap" }}>
                    {count} items · <span style={{ color: ORANGE }}>{pct}%</span>
                  </span>
                </div>
                <PercentBar pct={count} maxPct={maxCountryCount} />
              </div>
            ))}
          </div>
        )}

        <SectionDivider />

        {/* ── Section 5: Label Obsession ────────────────────────────────────── */}
        <SectionHeader eyebrow="Most Collected" title="Who you keep going back to." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "40px" }}>
          {/* Labels */}
          <div>
            <SubLabel>Top 10 Labels</SubLabel>
            {topLabels.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
                No label data available.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {topLabels.map(({ label, count, valueSum }, i) => (
                  <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <span style={{
                      fontFamily: SERIF, fontSize: "18px", fontWeight: 700,
                      color: ORANGE, lineHeight: 1, minWidth: "28px",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1, paddingTop: "2px" }}>
                      <div style={{
                        fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em",
                        color: INK, marginBottom: "2px",
                      }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: "10px", color: INK }}>
                        {count} item{count !== 1 ? "s" : ""}
                        {valueSum > 0 && <> · <span style={{ color: ORANGE }}>{fmtCurrency(valueSum, currency)}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Artists */}
          <div>
            <SubLabel>Top 10 Artists</SubLabel>
            {topArtists.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
                No artist data available.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {topArtists.map(({ artist, count, valueSum }, i) => (
                  <div key={artist} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <span style={{
                      fontFamily: SERIF, fontSize: "18px", fontWeight: 700,
                      color: ORANGE, lineHeight: 1, minWidth: "28px",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1, paddingTop: "2px" }}>
                      <div style={{
                        fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em",
                        color: INK, marginBottom: "2px",
                      }}>
                        {artist}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: "10px", color: INK }}>
                        {count} item{count !== 1 ? "s" : ""}
                        {valueSum > 0 && <> · <span style={{ color: ORANGE }}>{fmtCurrency(valueSum, currency)}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Producers */}
          <div>
            <SubLabel>Top 10 Producers</SubLabel>
            {topProducers.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
                Producer data will appear here after your next Discogs sync.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {topProducers.map(({ producer, count, valueSum }, i) => (
                  <div key={producer} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <span style={{
                      fontFamily: SERIF, fontSize: "18px", fontWeight: 700,
                      color: ORANGE, lineHeight: 1, minWidth: "28px",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1, paddingTop: "2px" }}>
                      <div style={{
                        fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em",
                        color: INK, marginBottom: "2px",
                      }}>
                        {producer}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: "10px", color: INK }}>
                        {count} item{count !== 1 ? "s" : ""}
                        {valueSum > 0 && <> · <span style={{ color: ORANGE }}>{fmtCurrency(valueSum, currency)}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SectionDivider />

        {/* ── Section 6: Vinyl Colour ───────────────────────────────────────── */}
        <SectionHeader eyebrow="Pressing Colours" title="What colour is your collection." />

        {vinylColourBreakdown.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
            Colour data will appear here after your next Discogs sync.
          </p>
        ) : (
          <div>
            <SubLabel>Top 10 Colours</SubLabel>
            <div style={{ borderTop: `0.5px solid ${RULE}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 80px 100px",
                gap: "16px", padding: "10px 0", borderBottom: `0.5px solid ${RULE}`,
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
                    display: "grid", gridTemplateColumns: "1fr 80px 100px",
                    gap: "16px", padding: "12px 0", borderBottom: `0.5px solid ${RULE}`,
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
          </div>
        )}

      </main>
      )}

      {insightsTab === "taste-profile" && (
        <main style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>
          <TasteProfile styleBreakdown={styleBreakdown} hasStyles={hasStyles} spectrum={spectrum} />
        </main>
      )}
    </div>
  );
}
