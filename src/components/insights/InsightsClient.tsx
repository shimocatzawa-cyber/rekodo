"use client";

import { AreaChart, BarList, ProgressBar } from "@tremor/react";
import AppNav from "@/components/AppNav";

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
  topRecordsByValue: { artist: string; album: string; price_median: number; price_low: number; price_high: number }[];
  mediaConditionBreakdown:  { grade: string; count: number; pct: number }[];
  sleeveConditionBreakdown: { grade: string; count: number; pct: number }[];
  genreBreakdown:  { genre: string; count: number; valueSum: number; pct: number }[];
  styleBreakdown:  { style: string; count: number; pct: number }[];
  hasStyles:       boolean;
  countryBreakdown: { country: string; count: number; valueSum: number }[];
  topLabels:       { label: string; count: number; valueSum: number }[];
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionDivider() {
  return <div style={{ borderTop: `1px solid ${RULE}`, margin: "56px 0" }} />;
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <p style={{
        fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em",
        textTransform: "uppercase", color: ORANGE, margin: "0 0 10px",
      }}>
        {eyebrow}
      </p>
      <h2 style={{
        fontFamily: SERIF, fontSize: "30px", fontWeight: 700,
        color: INK, lineHeight: 1.1, margin: "0 0 20px",
      }}>
        {title}
      </h2>
      <div style={{ borderTop: `1px solid ${RULE}` }} />
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
      textTransform: "uppercase", color: INK, margin: "0 0 16px",
    }}>
      {children}
    </p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InsightsClient({
  username, displayLabel, avatarUrl, currency,
  totalLow, totalMed, totalHigh, totalRecords, snapshots, topRecordsByValue,
  mediaConditionBreakdown, sleeveConditionBreakdown,
  genreBreakdown, styleBreakdown, hasStyles,
  countryBreakdown, topLabels,
}: InsightsProps) {

  const hasSparkline = snapshots.length >= 2;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      <main style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{
            fontFamily: SERIF, fontSize: "48px", fontWeight: 700,
            color: INK, lineHeight: 1.1, margin: "0 0 6px",
          }}>
            Insights
          </h1>
          <p style={{
            fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em",
            textTransform: "uppercase", color: ORANGE, margin: 0,
          }}>
            インサイト
          </p>
        </div>
        <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "56px" }} />

        {/* ── Section 1: Collection Value ──────────────────────────────────── */}
        <SectionHeader eyebrow="Collection Value" title="What Your Collection Is Worth" />

        {/* Three stat boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", marginBottom: "40px" }}>
          {([
            { label: "LOW",     value: totalLow  > 0 ? fmtCurrency(totalLow,  currency) : "—" },
            { label: "MEDIAN",  value: totalMed  > 0 ? fmtCurrency(totalMed,  currency) : "—" },
            { label: "HIGH",    value: totalHigh > 0 ? fmtCurrency(totalHigh, currency) : "—" },
          ] as const).map(({ label, value }) => (
            <div key={label} style={{ padding: "24px 0" }}>
              <div style={{
                fontFamily: SERIF, fontSize: "34px", fontWeight: 700,
                color: ORANGE, lineHeight: 1, marginBottom: "8px",
              }}>
                {value}
              </div>
              <div style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
                textTransform: "uppercase", color: INK,
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Sparkline or placeholder */}
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

        {/* Top 5 records table */}
        {topRecordsByValue.length > 0 && (
          <div>
            <SubLabel>Top records by value</SubLabel>
            <div style={{ borderTop: `0.5px solid ${RULE}` }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 130px 110px",
                gap: "16px", padding: "10px 0",
                borderBottom: `0.5px solid ${RULE}`,
              }}>
                {["Artist", "Album", "Median", "Low"].map((h) => (
                  <span key={h} style={{
                    fontFamily: MONO, fontSize: "9px",
                    letterSpacing: "0.12em", textTransform: "uppercase", color: INK,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {topRecordsByValue.map((r, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 130px 110px",
                  gap: "16px", padding: "14px 0",
                  borderBottom: `0.5px solid ${RULE}`,
                }}>
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
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>
                    {r.price_low > 0 ? fmtCurrency(r.price_low, currency) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SectionDivider />

        {/* ── Section 2: Collection Condition ──────────────────────────────── */}
        <SectionHeader eyebrow="Collection Condition" title="Record & Sleeve Grades" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
          {([
            { label: "Media Grade",  data: mediaConditionBreakdown  },
            { label: "Sleeve Grade", data: sleeveConditionBreakdown },
          ] as const).map(({ label, data }) => (
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
                      <ProgressBar value={pct} color="orange" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <SectionDivider />

        {/* ── Section 3: Genre Analysis ─────────────────────────────────────── */}
        <SectionHeader eyebrow="Genre Analysis" title="Genre & Style" />

        <SubLabel>By genre</SubLabel>
        {genreBreakdown.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: "0 0 40px" }}>
            No genre data available.
          </p>
        ) : (
          <div style={{ marginBottom: "48px" }}>
            <BarList
              data={genreBreakdown.map(({ genre, count }) => ({ name: genre, value: count }))}
              color="orange"
              valueFormatter={(v: number) => `${v} records`}
            />
          </div>
        )}

        <SubLabel>By style</SubLabel>
        {!hasStyles ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
            Style data available after your next sync.
          </p>
        ) : (
          <BarList
            data={styleBreakdown.map(({ style, count }) => ({ name: style, value: count }))}
            color="orange"
            valueFormatter={(v: number) => `${v} records`}
          />
        )}

        <SectionDivider />

        {/* ── Section 4: Geographic DNA ──────────────────────────────────────── */}
        <SectionHeader eyebrow="Geographic DNA" title="Pressing Origins" />

        {countryBreakdown.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
            No country data available.
          </p>
        ) : (
          <BarList
            data={countryBreakdown.map(({ country, count }) => ({ name: country, value: count }))}
            color="orange"
            valueFormatter={(v: number) => `${v} records`}
          />
        )}

        <SectionDivider />

        {/* ── Section 5: Label Obsession ────────────────────────────────────── */}
        <SectionHeader eyebrow="Label Obsession" title="Most Collected Labels" />

        {topLabels.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
            No label data available.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {topLabels.map(({ label, count, valueSum }, i) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
                <span style={{
                  fontFamily: SERIF, fontSize: "36px", fontWeight: 700,
                  color: ORANGE, lineHeight: 1, minWidth: "44px",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ flex: 1, paddingTop: "4px" }}>
                  <div style={{
                    fontFamily: MONO, fontSize: "13px", letterSpacing: "0.04em",
                    color: INK, marginBottom: "4px",
                  }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: INK }}>
                    {count} record{count !== 1 ? "s" : ""}
                    {valueSum > 0 && (
                      <> · <span style={{ color: ORANGE }}>{fmtCurrency(valueSum, currency)}</span></>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionDivider />

        {/* ── Section 6: Vinyl Colour ───────────────────────────────────────── */}
        <SectionHeader eyebrow="Vinyl Colour" title="Colour Breakdown" />
        {/* TODO: requires vinyl_colour column on records table + sync update */}
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: 0 }}>
          Vinyl colour analysis requires a schema update and resync. Coming soon.
        </p>

      </main>
    </div>
  );
}
