"use client";

import { useState, useEffect } from "react";
import type { TasteProfile as TasteProfileData, TasteMetrics } from "@/lib/tasteProfile";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

// ── Archetype metadata ─────────────────────────────────────────────────────────

const ARCHETYPE_COLORS: Record<string, string> = {
  archaeologist: "#185FA5",
  cartographer:  "#0F6E56",
  archivist:     "#533AB7",
  emotional:     "#CC5500",
  sensualist:    "#854F0B",
  scout:         "#3B6D11",
  custodian:     "#2C2820",
  biographer:    "#9A1F1F",
};

const ARCHETYPE_COPY: Record<string, { title: string; short: string }> = {
  archaeologist: {
    title: "The Archaeologist",
    short: "Patient, principled, precise. You move slowly because the right copy matters more than having a copy.",
  },
  cartographer: {
    title: "The Cartographer",
    short: "You collect countries as much as records. Every geography is a different set of pressures that produced different music.",
  },
  archivist: {
    title: "The Archivist",
    short: "You have identified a tradition and are building the definitive record of it. Methodical. Irreplaceable.",
  },
  emotional: {
    title: "The Emotional Collector",
    short: "Your collection is a diary. Records cluster around periods of intensity. It is the most honest form of collecting there is.",
  },
  sensualist: {
    title: "The Sensualist",
    short: "You collect for the listening experience above all. Condition is not vanity — it is the point.",
  },
  scout: {
    title: "The Scout",
    short: "Your Bandcamp is a forecast. You are perpetually ahead of the physical supply chain.",
  },
  custodian: {
    title: "The Custodian",
    short: "You have found your world and you are tending it. This is not stagnation. It is mastery.",
  },
  biographer: {
    title: "The Biographer",
    short: "You do not collect music — you collect artists. Every record is a chapter in a story you are reading obsessively.",
  },
};

// ── Format helpers ─────────────────────────────────────────────────────────────

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function fmtEcosystem(t: string) {
  return ({ monastic: "Monastic", solar_system: "Solar System", archipelago: "Archipelago", open_sea: "Open Sea" }[t] ?? t);
}
function fmtCoherence(t: string) {
  return ({ curated_world: "Curated World", themed_eclectic: "Themed Eclectic", deliberate_omnivore: "Deliberate Omnivore" }[t] ?? t);
}
function fmtCuration(t: string) {
  return ({ non_curator: "Non-curator", centre_curator: "Centre Curator", edge_curator: "Edge Curator" }[t] ?? t);
}
function fmtGeography(t: string) {
  return ({ counter_canonical: "Counter-canonical", mixed: "Mixed", mainstream: "Mainstream" }[t] ?? t);
}

// ── Metric display spec ────────────────────────────────────────────────────────

interface MetricSpec {
  key:          string;
  label:        string;
  japaneseLabel: string;
  getValue:     (m: TasteMetrics) => string;
  getSubtext:   (m: TasteMetrics) => string;
  getScore?:    (m: TasteMetrics) => number | undefined;
  noData?:      (m: TasteMetrics) => boolean;
}

const METRIC_DISPLAY: MetricSpec[] = [
  {
    key:          "m01",
    label:        "Desire / Reality Gap",
    japaneseLabel: "欲望と現実",
    getValue:     (m) => m.m01.noData ? "—" : cap(m.m01.type),
    getSubtext:   (m) => m.m01.noData ? "No wantlist data yet" :
      m.m01.reachingToward ? `Reaching toward ${m.m01.reachingToward}` : "Wanting more of what you already love",
    getScore:     (m) => m.m01.noData ? undefined : m.m01.score,
    noData:       (m) => !!m.m01.noData,
  },
  {
    key:          "m02",
    label:        "Two Musical Selves",
    japaneseLabel: "二つの音楽的自己",
    getValue:     (m) => m.m02.noData ? "No digital imports yet" : `${m.m02.convergenceScore}% convergence`,
    getSubtext:   (m) => m.m02.noData ? "Import your Bandcamp collection in Deep Dive" :
      m.m02.digitalOnlyArtists.length > 0 ? `Digital-only: ${m.m02.digitalOnlyArtists.slice(0, 2).join(", ")}` :
      "Vinyl and digital taste align closely",
    getScore:     (m) => m.m02.noData ? undefined : 100 - m.m02.convergenceScore,
    noData:       (m) => !!m.m02.noData,
  },
  {
    key:          "m03",
    label:        "Acquisition Rhythm",
    japaneseLabel: "収集のリズム",
    getValue:     (m) => m.m03.noData ? "—" : cap(m.m03.rhythmType),
    getSubtext:   (m) => m.m03.noData ? "Not enough date data" : `Collection is ${m.m03.trend}`,
    noData:       (m) => !!m.m03.noData,
  },
  {
    key:          "m04",
    label:        "Completist Fingerprint",
    japaneseLabel: "完全主義の指紋",
    getValue:     (m) => m.m04.intensity === "devoted" ? "Devoted completist" : cap(m.m04.intensity),
    getSubtext:   (m) => m.m04.commonThread || `${m.m04.targets.length} artists with 3+ records`,
    getScore:     (m) => m.m04.score,
  },
  {
    key:          "m05",
    label:        "Label Ecosystem",
    japaneseLabel: "レーベルの生態系",
    getValue:     (m) => fmtEcosystem(m.m05.ecosystemType),
    getSubtext:   (m) => `${m.m05.dominantLabel} · ${Math.round(m.m05.dominantLabelPct)}% of collection`,
    getScore:     (m) => Math.min(m.m05.dominantLabelPct * 2, 100),
  },
  {
    key:          "m06",
    label:        "Listening Condition",
    japaneseLabel: "リスニングの基準",
    getValue:     (m) => cap(m.m06.collectorType.replace(/_/g, " ")),
    getSubtext:   (m) => `${Math.round(m.m06.pctVGPlus)}% VG+ or above`,
    getScore:     (m) => m.m06.conditionScore * 100,
  },
  {
    key:          "m07",
    label:        "Taste Drift",
    japaneseLabel: "テイストの変化",
    getValue:     (m) => m.m07.noData ? "—" : cap(m.m07.driftType),
    getSubtext:   (m) => m.m07.noData ? "Not enough date data" : (m.m07.primaryShift || "Taste consistent over time"),
    getScore:     (m) => m.m07.noData ? undefined : m.m07.driftScore,
    noData:       (m) => !!m.m07.noData,
  },
  {
    key:          "m08",
    label:        "Sonic Coherence",
    japaneseLabel: "音楽的一貫性",
    getValue:     (m) => fmtCoherence(m.m08.coherenceType),
    getSubtext:   (m) => m.m08.outlierRecord
      ? `Outlier: ${m.m08.outlierRecord.artist} — ${m.m08.outlierRecord.album}`
      : "No significant outliers",
    getScore:     (m) => m.m08.coherenceScore,
  },
  {
    key:          "m09",
    label:        "Curation Identity",
    japaneseLabel: "キュレーションの個性",
    getValue:     (m) => fmtCuration(m.m09.curationStyle),
    getSubtext:   (m) => m.m09.noData ? "Create lists to unlock this metric" :
      `${Math.round(m.m09.curationRate)}% of collection curated`,
    getScore:     (m) => m.m09.noData ? undefined : m.m09.editorialCourage,
    noData:       (m) => !!m.m09.noData,
  },
  {
    key:          "m10",
    label:        "Discovery Pipeline",
    japaneseLabel: "発見のパイプライン",
    getValue:     (m) => m.m10.noData ? "Vinyl only" : cap(m.m10.pipelineType),
    getSubtext:   (m) => m.m10.noData ? "Import Bandcamp to see your pipeline" :
      `${m.m10.uncommittedCount} Bandcamp artists not yet on vinyl`,
    noData:       (m) => !!m.m10.noData,
  },
  {
    key:          "m11",
    label:        "Cultural Geography",
    japaneseLabel: "文化的地理",
    getValue:     (m) => fmtGeography(m.m11.geographyType),
    getSubtext:   (m) => m.m11.mostDistinctiveCountry ? `Most distinctive: ${m.m11.mostDistinctiveCountry}` : "",
    getScore:     (m) => m.m11.counterCanonicalScore,
  },
  {
    key:          "m12",
    label:        "Aspiration Pattern",
    japaneseLabel: "願望のパターン",
    getValue:     (m) => cap(m.m12.patienceType.replace(/_/g, " ")),
    getSubtext:   (m) => `Wantlist is ${Math.round(m.m12.aspirationRatio * 100)}% of collection size`,
    getScore:     (m) => Math.min(m.m12.aspirationRatio * 100, 100),
  },
  {
    key:          "m13",
    label:        "Era Relationship",
    japaneseLabel: "時代との関係",
    getValue:     (m) => cap(m.m13.eraType),
    getSubtext:   (m) => `${Math.round(m.m13.historicWeight)}% pre-1980 · Modal decade: ${m.m13.modalDecade}`,
    getScore:     (m) => m.m13.historicWeight,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ height: "2px", background: RULE, marginTop: "8px" }}>
      <div style={{ width: `${Math.min(score, 100)}%`, height: "100%", background: ORANGE }} />
    </div>
  );
}

function MetricCard({ spec, metrics }: { spec: MetricSpec; metrics: TasteMetrics }) {
  const isNoData = spec.noData?.(metrics) ?? false;
  const value    = spec.getValue(metrics);
  const subtext  = spec.getSubtext(metrics);
  const score    = spec.getScore?.(metrics);

  return (
    <div style={{ padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
      <p style={{
        fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
        textTransform: "uppercase", color: ORANGE, margin: "0 0 6px",
      }}>
        {spec.label}
        <span style={{ color: ORANGE, opacity: 0.6, marginLeft: "6px" }}>{spec.japaneseLabel}</span>
      </p>
      <p style={{
        fontFamily: SERIF, fontSize: "1rem", fontWeight: isNoData ? 400 : 600,
        color: isNoData ? "#aaaaaa" : INK, margin: "0 0 4px", lineHeight: 1.3,
      }}>
        {value}
      </p>
      {score != null && !isNoData && <ScoreBar score={score} />}
      {subtext && (
        <p style={{
          fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
          color: isNoData ? "#bbbbbb" : INK, margin: "8px 0 0", lineHeight: 1.5,
        }}>
          {subtext}
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: "0" }}>
      {/* Archetype skeleton */}
      <div style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, padding: "32px 0", marginBottom: "40px" }}>
        <div style={{ width: "120px", height: "10px", background: RULE, marginBottom: "14px" }} />
        <div style={{ width: "260px", height: "28px", background: RULE, marginBottom: "12px" }} />
        <div style={{ width: "180px", height: "10px", background: RULE, marginBottom: "16px" }} />
        <div style={{ width: "400px", height: "10px", background: RULE, marginBottom: "8px" }} />
        <div style={{ width: "320px", height: "10px", background: RULE }} />
      </div>
      {/* Metric grid skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 48px" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
            <div style={{ width: "100px", height: "8px", background: RULE, marginBottom: "10px" }} />
            <div style={{ width: "160px", height: "14px", background: RULE, marginBottom: "8px" }} />
            <div style={{ width: "200px", height: "8px", background: RULE }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TasteProfile() {
  const [data,       setData]       = useState<TasteProfileData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function load(force = false) {
    if (force) setRegenerating(true);
    try {
      const res  = await fetch("/api/insights/taste-profile", { method: force ? "POST" : "GET" });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.details ?? json.error ?? "Failed to compute taste profile.");
      } else {
        setData(json as TasteProfileData);
        setError(null);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const primaryCopy = data ? ARCHETYPE_COPY[data.archetypes.primary] : null;
  const primaryColor = data ? (ARCHETYPE_COLORS[data.archetypes.primary] ?? INK) : INK;
  const secondaryCopy = data?.archetypes.secondary ? ARCHETYPE_COPY[data.archetypes.secondary] : null;

  const generatedDate = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: "28px" }}>
        <p style={{
          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em",
          textTransform: "uppercase", color: ORANGE, margin: "0 0 8px",
        }}>
          Taste Profile
        </p>
        <h2 style={{
          fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 600,
          color: INK, letterSpacing: "-0.025em", lineHeight: 1.15,
          margin: "0 0 16px",
        }}>
          What your collection says about you.
        </h2>
        <div style={{ borderTop: `1px solid ${RULE}` }} />
      </div>

      {loading && !data && <Skeleton />}

      {error && (
        <div style={{ padding: "24px", borderLeft: `2px solid ${RULE}`, marginBottom: "32px" }}>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", margin: 0 }}>{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* ── Archetype display ── */}
          <div style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, padding: "32px 0", marginBottom: "40px" }}>
            <p style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
              textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px",
            }}>
              Primary archetype · {data.archetypes.primaryScore} / 100
            </p>
            <h3 style={{
              fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 600,
              color: primaryColor, margin: "0 0 8px", lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}>
              {primaryCopy?.title ?? data.archetypes.primary}
            </h3>
            <p style={{
              fontFamily: SERIF, fontStyle: "italic",
              fontSize: "0.95rem", color: "#555555", lineHeight: 1.7,
              margin: "0 0 20px", maxWidth: "560px",
            }}>
              {primaryCopy?.short}
            </p>

            {secondaryCopy && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <p style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "#aaaaaa", margin: 0,
                }}>
                  Secondary:
                </p>
                <p style={{
                  fontFamily: SERIF, fontSize: "1rem",
                  color: ARCHETYPE_COLORS[data.archetypes.secondary!] ?? INK,
                  margin: 0,
                }}>
                  {secondaryCopy.title}
                </p>
                <p style={{
                  fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", margin: 0,
                }}>
                  {data.archetypes.secondaryScore} / 100
                </p>
              </div>
            )}
          </div>

          {/* ── Metric grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 48px" }}>
            {METRIC_DISPLAY.map(spec => (
              <MetricCard key={spec.key} spec={spec} metrics={data.metrics} />
            ))}
          </div>

          {/* ── Footer ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "12px",
            marginTop: "40px", paddingTop: "20px", borderTop: `1px solid ${RULE}`,
          }}>
            <p style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
              color: "#aaaaaa", margin: 0,
            }}>
              {generatedDate ? `Calculated ${generatedDate} · ${data.recordCount} items` : `${data.recordCount} items`}
            </p>
            <button
              type="button"
              onClick={regenerating ? undefined : () => load(true)}
              disabled={regenerating}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em",
                color: regenerating ? "#aaaaaa" : ORANGE,
                background: "none", border: "none", padding: 0,
                cursor: regenerating ? "default" : "pointer",
              }}
            >
              {regenerating ? "Recalculating…" : "Recalculate profile →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
