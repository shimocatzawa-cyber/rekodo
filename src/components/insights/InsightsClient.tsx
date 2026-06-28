"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useUrlTab } from "@/lib/useUrlTab";
import Link from "next/link";
import { BarChart, type CustomTooltipProps } from "@tremor/react";
import AppNav from "@/components/AppNav";
import TasteProfile, { type SpectrumData } from "@/components/insights/TasteProfile";
import LunarListeningRitual from "@/components/LunarListeningRitual";
import InsightsShareModal from "@/components/insights/InsightsShareModal";
import EssentialsWallModal from "@/components/insights/EssentialsWallModal";
import CollectorDNAModal from "@/components/insights/CollectorDNAModal";
import CollectionStyleMapModal from "@/components/insights/CollectionStyleMapModal";
import CollectionGenreMapModal from "@/components/insights/CollectionGenreMapModal";
import CollectionStoryModal from "@/components/insights/CollectionStoryModal";
import RecordShelfModal from "@/components/insights/RecordShelfModal";
import SpectrumShareModal from "@/components/insights/SpectrumShareModal";
import ArchetypeShareModal from "@/components/archetypes/ArchetypeShareModal";
import DailyPick, { type DailyPickData } from "@/components/DailyPick";
import OnThisDay, { type OnThisDayPick } from "@/components/OnThisDay";
import type { DesirabilityTier } from "@/lib/desirability";
import { feelingLabel } from "@/lib/feelings";

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
  essentials: {
    total:           number;
    primaryGenre:    string | null;
    primaryGenrePct: number;
    covers:          { artist: string; album: string; coverUrl: string | null }[];
  };
  feelingBreakdown: { feeling: string; count: number; pct: number }[];
  collectionLifespan: { period: string; Added: number }[];
  collectionByMonth: { period: string; Added: number }[];
  spectrum:           SpectrumData;
  topPlayedRecords:   { artist: string; album: string; coverUrl: string | null; lastPlayedAt: string; playCount: number }[];
  playedStyleBreakdown: { style: string; count: number; pct: number }[];
  avgReleaseYear:    number | null;
  topDecade:         string | null;
  collectorArchetype:  string | null;
  collectorSinceYear:  number | null;
  collectionPhotoUrl:  string | null;
  oldestAlbum:      { year: number; artist: string; album: string } | null;
  newestAlbum:      { year: number; artist: string; album: string } | null;
  topVinylArtist:        string | null;
  topVinylArtistCount:   number | null;
  collectorArchetypeId:      string | null;
  collectorArchetypeShadow:  string | null;
  collectorArchetypeScore:   number | null;
  collectorArchetypeScores:  Record<string, number> | null;
  dailyPick:    DailyPickData | null;
  onThisDay:    OnThisDayPick | null;
  usageStats:   {
    digDiscover:   number;
    digExplore:    number;
    digStyle:      number;
    deepDiveCount: number;
    listsTotal:    number;
    listLikes:     number;
  };
}

// ── Tier metadata ──────────────────────────────────────────────────────────────

const TIER_META: Record<DesirabilityTier, { label: string; bg: string; color: string }> = {
  "rare":         { label: "Rare",          bg: "#F0997B", color: "#712B13" },
  "cult":         { label: "Cult Pressing", bg: "#CECBF6", color: "#3C3489" },
  "widely-loved": { label: "Widely Loved",  bg: "#C0DD97", color: "#27500A" },
  "in-demand":    { label: "In Demand",     bg: "#9FE1CB", color: "#085041" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string): string {
  const prefixes: Record<string, string> = {
    AUD: "A$", USD: "$", GBP: "£", EUR: "€", JPY: "¥",
    CAD: "C$", NZD: "NZ$", SGD: "S$", HKD: "HK$",
    CHF: "CHF ", SEK: "SEK ", NOK: "NOK ", DKK: "DKK ",
    KRW: "₩", INR: "₹", BRL: "R$", MXN: "MX$", ZAR: "R ", CNY: "¥",
  };
  const prefix = prefixes[currency.toUpperCase()] ?? `${currency} `;
  return `${prefix}${Math.round(amount).toLocaleString()}`;
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
  return `${prefix}${Math.round(amount).toLocaleString()}`;
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
    <div className="rk-stat-bar" style={{
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
  totalMed, totalRecords, topRecordsByValue,
  mediaConditionBreakdown, sleeveConditionBreakdown,
  genreBreakdown, styleBreakdown, hasStyles,
  countryBreakdown, topLabels, topArtists, topProducers,
  formatBreakdown, desirabilityBreakdown,
  topFormat, yearRange, mostPopularYear, vinylColourBreakdown,
  essentials, feelingBreakdown,
  collectionLifespan, collectionByMonth, spectrum,
  topPlayedRecords, playedStyleBreakdown,
  dailyPick, onThisDay, usageStats,
  avgReleaseYear, topDecade, collectorArchetype, collectorArchetypeId, collectorArchetypeShadow, collectorArchetypeScore, collectorArchetypeScores, collectorSinceYear, collectionPhotoUrl, oldestAlbum, newestAlbum, topVinylArtist, topVinylArtistCount,
}: InsightsProps) {

  const [oneLiner, setOneLiner] = useState<string | null>(null);
  const defaultTab = "taste-profile";
  const [insightsTab, setInsightsTab] = useUrlTab<"collection" | "taste-profile">("tab", ["collection", "taste-profile"], defaultTab);
  const [showShare, setShowShare] = useState(false);
  const [showEssentialsShare, setShowEssentialsShare] = useState(false);
  const [showDNAModal, setShowDNAModal]       = useState(false);
  const [showStyleMap, setShowStyleMap]       = useState(false);
  const [showGenreMap, setShowGenreMap]       = useState(false);
  const [showStory, setShowStory]             = useState(false);
  const [showShelf, setShowShelf]             = useState(false);
  const [showSpectrum, setShowSpectrum]         = useState(false);
  const [showArchetype, setShowArchetype]       = useState(false);

  useEffect(() => {
    if (totalRecords < 5) return;
    fetch("/api/insights", { method: "POST" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.oneLiner) setOneLiner(d.oneLiner); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxGenrePct     = genreBreakdown[0]?.pct      ?? 100;
  const maxCountryCount = countryBreakdown[0]?.count  ?? 1;
  const maxFeelingPct   = feelingBreakdown[0]?.pct    ?? 100;

  // Derive stats bar tiles from available data
  const rareCount       = desirabilityBreakdown.find((d) => d.tier === "rare")?.count ?? 0;
  const rareCultCount   = desirabilityBreakdown.filter(d => d.tier === "rare" || d.tier === "cult").reduce((s, d) => s + d.count, 0);
  const rarityPct       = totalRecords > 0 ? Math.round((rareCultCount / totalRecords) * 100) : null;
  const topRealGenre    = genreBreakdown.find((g) => g.genre !== "Unknown" && g.genre !== "");
  const topPressOrigin  = countryBreakdown[0] ?? null;
  const topArtist       = topArtists[0] ?? null;
  const topLabel        = topLabels[0]  ?? null;

  const statTiles: StatTile[] = [
    { hero: totalRecords.toLocaleString(), label: "Items" },
    ...(topFormat ? [{ hero: topFormat.count.toLocaleString(), label: fmtFormatLabel(topFormat.name) }] : []),
    ...(topRealGenre ? [{ hero: `${topRealGenre.pct}%`, label: topRealGenre.genre }] : []),
    ...(topPressOrigin ? [{ hero: `${topPressOrigin.pct}%`, label: topPressOrigin.country }] : []),
    ...(topVinylArtist ? [{ hero: topVinylArtist, label: `${topVinylArtistCount} vinyl records` }] : []),
    ...(topLabel ? [{ hero: topLabel.label, label: `${topLabel.count} label items` }] : []),
    ...(yearRange ? [{ hero: yearRange.oldest !== yearRange.newest ? `${yearRange.oldest} → ${yearRange.newest}` : String(yearRange.oldest), label: "Collection span" }] : []),
    ...(mostPopularYear ? [{ hero: String(mostPopularYear), label: "Most collected year" }] : []),
    ...(rareCount > 0 ? [{ hero: rareCount.toLocaleString(), label: "Rare" }] : []),
    { hero: totalMed > 0 ? fmtValueShort(totalMed, currency) : "—", label: "Median collection value" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Tab bar ── */}
      <div className="rk-profile-tabs" style={{ display: "flex", justifyContent: "center", gap: "24px", paddingTop: "14px", paddingBottom: "2px", background: "#ffffff" }}>
        {(["taste-profile", "collection"] as const).map((tab) => {
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

      {insightsTab === "collection" && totalRecords === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px", textAlign: "center" }}>
          <p style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 400, color: INK, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Your collection insights live here.
          </p>
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#aaaaaa", margin: "0 0 28px", lineHeight: 1.7, maxWidth: "360px" }}>
            Import your Discogs collection to unlock genre breakdowns, value analysis, taste spectrum, and more.
          </p>
          <Link
            href="/collection"
            style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: ORANGE, color: "#ffffff", padding: "11px 24px", textDecoration: "none", display: "inline-block" }}
          >
            Import collection →
          </Link>
        </div>
      )}

      {insightsTab === "collection" && totalRecords > 0 && (
      <main className="rk-arch-main" style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>


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

        {/* ── Section -1: Essentials Wall (records you've tagged Essential) ──── */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{
                fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em",
                textTransform: "uppercase", color: ORANGE, margin: "0 0 8px",
              }}>
                Essentials
              </p>
              <h2 style={{
                fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 600,
                color: INK, letterSpacing: "-0.025em", lineHeight: 1.15,
                margin: "0 0 6px",
              }}>
                Your essentials wall.
              </h2>
              <p style={{ fontFamily: MONO, fontSize: "10px", color: "#999999", letterSpacing: "0.04em", margin: "0 0 16px" }}>
                Built from records you&apos;ve tagged Essential — not your full collection.
              </p>
            </div>
            {essentials.covers.length > 0 && (
              <button
                onClick={() => setShowEssentialsShare(true)}
                style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.06em", flexShrink: 0, marginLeft: 16 }}
              >
                Share ↗
              </button>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "20px" }} />

          {essentials.covers.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: INK, margin: "0 0 40px" }}>
              Tag records as Essential from your collection to build your wall.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(30px, 1fr))",
              gap: "6px",
              marginBottom: "40px",
            }}>
              {essentials.covers.map((c, i) => (
                c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={c.coverUrl}
                    alt={`${c.artist} — ${c.album}`}
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block", background: RULE }}
                  />
                ) : (
                  <div key={i} style={{ width: "100%", aspectRatio: "1 / 1", background: RULE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa" }}>—</span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        <SectionDivider />

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

        {/* Format breakdown */}
        {formatBreakdown.length > 0 && (
          <div style={{ marginBottom: "40px" }}>
            <SubLabel>Collection by format</SubLabel>
            <div className="rk-ins-fmt" style={{ borderTop: `0.5px solid ${RULE}` }}>
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
            <div className="rk-ins-fmt" style={{ borderTop: `0.5px solid ${RULE}` }}>
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
            <div className="rk-ins-top" style={{ borderTop: `0.5px solid ${RULE}` }}>
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

        <div className="rk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
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

        {/* ── Section 3a: Feeling ──────────────────────────────────────────────── */}
        <SectionHeader eyebrow="Feeling" title="How it makes you feel." />

        {feelingBreakdown.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0 }}>
            Tag records with a feeling from the collection view to see this breakdown.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {feelingBreakdown.map(({ feeling, count, pct }) => (
              <div key={feeling}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", marginBottom: "6px", gap: "12px",
                }}>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>{feelingLabel(feeling)}</span>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: INK, whiteSpace: "nowrap" }}>
                    {count} items · <span style={{ color: ORANGE }}>{pct}%</span>
                  </span>
                </div>
                <PercentBar pct={pct} maxPct={maxFeelingPct} />
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

        <div className="rk-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "40px" }}>
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

      </main>
      )}

      {showShare && (
        <InsightsShareModal
          onClose={() => setShowShare(false)}
          avatarUrl={avatarUrl ?? null}
          username={username}
          totalRecords={totalRecords}
          topGenre={topRealGenre?.genre ?? null}
          mostPopularYear={mostPopularYear}
          topArtist={topArtist?.artist ?? null}
          topLabel={topLabel?.label ?? null}
          topCountry={topPressOrigin?.country ?? null}
          countryCount={countryBreakdown.length}
          rareCount={rareCount}
        />
      )}

      {showEssentialsShare && (
        <EssentialsWallModal
          onClose={() => setShowEssentialsShare(false)}
          username={username}
          covers={essentials.covers}
          total={essentials.total}
          primaryGenre={essentials.primaryGenre}
          primaryGenrePct={essentials.primaryGenrePct}
        />
      )}

      {showSpectrum && (
        <SpectrumShareModal
          onClose={() => setShowSpectrum(false)}
          username={username}
          spectrum={spectrum}
        />
      )}

      {showArchetype && collectorArchetypeId && collectorArchetypeShadow && (
        <ArchetypeShareModal
          onClose={() => setShowArchetype(false)}
          username={username}
          archetypeId={collectorArchetypeId}
          score={collectorArchetypeScore ?? 0}
          shadowId={collectorArchetypeShadow}
          shadowScore={collectorArchetypeScores?.[collectorArchetypeShadow] ?? 0}
        />
      )}

      {/* ── Collection share card modals ── */}
      {showDNAModal && (
        <CollectorDNAModal
          onClose={() => setShowDNAModal(false)}
          username={username}
          primaryStyle={topRealGenre?.genre ?? null}
          styleObsession={styleBreakdown[0]?.style ?? null}
          avgReleaseYear={topDecade}
          topCountry={countryBreakdown[0]?.country ?? null}
          rarityPct={rarityPct}
          collectorArchetype={collectorArchetype}
          collectorSinceYear={collectorSinceYear}
          totalRecords={totalRecords}
        />
      )}
      {showStyleMap && (
        <CollectionStyleMapModal
          onClose={() => setShowStyleMap(false)}
          username={username}
          totalRecords={totalRecords}
          styleBreakdown={styleBreakdown}
        />
      )}
      {showGenreMap && (
        <CollectionGenreMapModal
          onClose={() => setShowGenreMap(false)}
          username={username}
          totalRecords={totalRecords}
          genreBreakdown={genreBreakdown}
        />
      )}
      {showStory && (
        <CollectionStoryModal
          onClose={() => setShowStory(false)}
          username={username}
          totalRecords={totalRecords}
          collectionLifespan={collectionLifespan}
          collectorSinceYear={collectorSinceYear}
          yearRange={yearRange}
          countryCount={countryBreakdown.length}
        />
      )}
      {showShelf && (
        <RecordShelfModal
          onClose={() => setShowShelf(false)}
          username={username}
          totalRecords={totalRecords}
          styleBreakdown={styleBreakdown}
          genreBreakdown={genreBreakdown}
          desirabilityBreakdown={desirabilityBreakdown}
          topArtist={topVinylArtist ?? topArtists[0]?.artist ?? null}
          topArtistCount={topVinylArtistCount}
          oldestAlbum={oldestAlbum}
          newestAlbum={newestAlbum}
          collectionPhotoUrl={collectionPhotoUrl}
          formatBreakdown={formatBreakdown}
        />
      )}

      {insightsTab === "taste-profile" && (
        <main className="rk-arch-main" style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>

          {/* ── Share card bar ── */}
          {totalRecords >= 5 && (
            <div style={{ marginBottom: 12, paddingBottom: 8 }}>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px" }}>Share your collection on socials</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
                {[
                  { label: "Record Shelf",         onClick: () => setShowShelf(true) },
                  { label: "Essentials Wall",      onClick: () => setShowEssentialsShare(true) },
                  { label: "Collector DNA",        onClick: () => setShowDNAModal(true) },
                  { label: "Collection Story",     onClick: () => setShowStory(true) },
                  { label: "Genre Map",            onClick: () => setShowGenreMap(true) },
                  { label: "Style Map",            onClick: () => setShowStyleMap(true) },
                  { label: "Spectrum",             onClick: () => setShowSpectrum(true) },
                  ...(collectorArchetypeId ? [{ label: "Archetype", onClick: () => setShowArchetype(true) }] : []),
                ].map(({ label, onClick }) => (
                  <button key={label} onClick={onClick} style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                    background: "none", border: `1px solid ${RULE}`, cursor: "pointer",
                    padding: "8px 14px", color: INK, flex: 1, textAlign: "center",
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Lunar Listening Ritual + On This Month ── */}
          <div className="rk-grid-2" style={{ marginTop: "16px", display: "grid", gridTemplateColumns: onThisDay ? "1fr 1px 1fr" : "1fr", gap: onThisDay ? "16px" : undefined }}>
            <LunarListeningRitual />
            {onThisDay && <div style={{ background: RULE }} />}
            <OnThisDay pick={onThisDay} />
          </div>

          {/* ── Daily pick ── */}
          <div style={{ marginTop: "16px" }}>
            <DailyPick dailyPick={dailyPick} />
          </div>

          <div style={{ marginTop: "40px" }}>
            <TasteProfile
              username={username}
              styleBreakdown={styleBreakdown}
              hasStyles={hasStyles}
              vinylColourBreakdown={vinylColourBreakdown}
              spectrum={spectrum}
              topPlayedRecords={topPlayedRecords}
              playedStyleBreakdown={playedStyleBreakdown}
              usageStats={usageStats}
            />
          </div>
        </main>
      )}
    </div>
  );
}
