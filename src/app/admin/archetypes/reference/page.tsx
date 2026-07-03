import type { Metadata } from "next";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Archetype Computation Reference — rekōdo" };

const MONO  = "'DM Mono', 'Courier New', monospace";
const SERIF = "Georgia, serif";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";
const MUTED  = "#777";

// ── Data ──────────────────────────────────────────────────────────────────────

const SIGNALS = [
  {
    id: "labelLoyalty",
    label: "Label Loyalty",
    source: "records.label",
    formula: "% of collection covered by the top 3 labels → clamped 0–100",
    labels: [">70 = Devoted · 50–70 = Loyal · 30–50 = Selective · <30 = Eclectic"],
  },
  {
    id: "conditionStandard",
    label: "Condition Standard",
    source: "user_records.media_condition",
    formula: "% of graded records that are Mint (M) or Near Mint (NM / M−) → clamped 0–100",
    labels: [">60 = Fastidious · 30–60 = Quality-conscious · <30 = Content-first"],
    unavailable: "Requires at least one graded record",
  },
  {
    id: "formatFidelity",
    label: "Format Fidelity",
    source: "records.format",
    formula: '% of records where format contains "LP", "Album", or \'12\'" → clamped 0–100',
    labels: [">90 = LP Purist · 70–90 = Album-focused · <70 = Format-agnostic"],
  },
  {
    id: "sonicCoherence",
    label: "Sonic Coherence",
    source: "records.genre, records.year, records.country",
    formula: "Pairwise Manhattan distance across (genre-index, decade-index, country-index) vectors on a 150-record sample. score = clamp(100 − (avgDist / 3) × 100)",
    labels: [">70 = Curated World · 45–70 = Themed · <45 = Eclectic"],
  },
  {
    id: "geographicRange",
    label: "Geographic Range",
    source: "records.country",
    formula: "Weighted sum of pressing country counts, where counter-canonical countries score higher (Japan ×2.0, Nigeria ×1.9, Germany ×1.8, Jamaica ×1.8, Brazil ×1.7, Norway/Sweden/Denmark/Finland ×1.6, France ×1.5, Australia ×1.0, US/UK ×0.6–0.8). score = clamp((weightedSum / totalRecords) × 50)",
    labels: [">65 = Counter-canonical · 40–65 = Mixed · <40 = Mainstream"],
  },
  {
    id: "pressingOriginDiversity",
    label: "Pressing Origin Diversity",
    source: "records.country",
    formula: "Two components averaged: (1) diversity = min(uniqueCountries × 5, 100); (2) nonAngloScore = % of records not from UK / USA / Australia. score = clamp((diversity + nonAngloScore) / 2)",
    labels: ["Raw count of unique pressing countries"],
  },
  {
    id: "trophyRatio",
    label: "Trophy Ratio",
    source: "records.community_have, community_want, price_low, community_num_for_sale, edition_size",
    formula: "Each record is assigned a desirability tier (rare=5pts, cult=3pts, in-demand=2pts, widely-loved=1pt). score = clamp((totalPoints / (records × 5)) × 100)",
    labels: [">40 = Obsessive Hunter · 20–40 = Rarity-aware · <20 = Music-first"],
    unavailable: "Requires Discogs community data",
  },
  {
    id: "historicalDepth",
    label: "Historical Depth",
    source: "records.year",
    formula: "Find the modal decade of the collection. Map to decade score: 1920s–1960s=100, 1970s=80, 1980s=60, 1990s=40, 2000s=20, 2010s/2020s=5",
    labels: [">70 = Historian · 40–70 = Bridge · <40 = Contemporary"],
  },
  {
    id: "acquisitionRhythm",
    label: "Acquisition Rhythm",
    source: "user_records.date_added (Discogs date only — created_at excluded)",
    formula: "Group records by calendar year. Compute coefficient of variation (stdDev / mean) across year-counts. Rhythmist: ≥4 active years AND CV<0.8. Measured: ≥2 years AND CV<1.5. Binge: otherwise. score = clamp(CV × 50)",
    labels: ["Rhythmist · Measured · Binge"],
    unavailable: "Requires ≥10 records with Discogs date_added",
  },
  {
    id: "styleRange",
    label: "Style Range",
    source: "records.styles[]",
    formula: "Count unique Discogs style tags. score = clamp(√uniqueStyles × 6)",
    labels: [">100 styles = Omnivore · 30–100 = Broad · <30 = Focused"],
    unavailable: "Requires Discogs style data",
  },
  {
    id: "transgressiveIndex",
    label: "Transgressive Index",
    source: "records.styles[]",
    formula: "Six fringe clusters: Noise, Experimental, Psychedelic Fringe, Free Jazz, Fringe Folk, Electronic Margins. transgressivePct = records containing any cluster tag / total. clustersHit = how many of the 6 clusters are represented. score = clamp(transgressivePct × 0.6 + (clustersHit/6 × 100 × 0.4))",
    labels: [">50 = Anti-canonical · 25–50 = Adventurous · <25 = Conventional"],
    unavailable: "Requires Discogs style data",
  },
  {
    id: "aspirationRatio",
    label: "Aspiration Ratio",
    source: "wantlist count vs owned record count",
    formula: "ratio = wantlistCount / totalRecords. score = clamp(ratio × 100)",
    labels: [">0.5 = Active Seeker · 0.2–0.5 = Selective · <0.2 = Content"],
    unavailable: "Requires a non-empty wantlist",
  },
  {
    id: "curatorialReach",
    label: "Curatorial Reach",
    source: "lists, list_items, records.genre",
    formula: "Compare top genre of collection vs top genre of lists. editorial = if genres differ: min(70 + lists×5, 100), else min(30 + lists×3, 60). listsPerRecord = lists / (total/50). score = clamp(editorial×0.7 + min(listsPerRecord×20, 30))",
    labels: [">60 = Edge Curator · 30–60 = Centre Curator · <30 = Non-curator"],
    unavailable: "Requires at least one list",
  },
  {
    id: "digitalDivergence",
    label: "Digital Divergence",
    source: "digital_imports (Bandcamp) vs user_records",
    formula: "overlap = digital artists also in vinyl. divergence = 100 − (overlap / digitalArtists × 100). score = clamp(divergence)",
    labels: [">60 = Two Worlds · 30–60 = Overlapping · <30 = Aligned"],
    unavailable: "Requires Bandcamp import",
  },
  {
    id: "emotionalRange",
    label: "Emotional Signature",
    source: "user_records.feeling",
    formula: "Count unique feeling tags applied to records. score = clamp(uniqueFeelings × 8)",
    labels: [">7 feelings = Full Spectrum · 4–7 = Varied · <4 = Focused"],
    unavailable: "Requires records tagged with a feeling",
  },
  {
    id: "canonObscurity",
    label: "Canon Obscurity",
    source: "records.community_have, records.community_want",
    formula: "Per record: ratio = community_have / community_want. Avg across collection. score = clamp(100 − (min(avgRatio, 15) / 15) × 100). High score = obscure; low = canonical.",
    labels: [">66 = Obscurist · 33–66 = Mixed · <33 = Canonical"],
    unavailable: "Requires Discogs community data",
  },
  {
    id: "artistConcentration",
    label: "Artist Concentration",
    source: "records.artist",
    formula: "completistArtists = artists with ≥3 records. score = clamp(completistArtists / totalArtists × 100)",
    labels: [">30% = Completist · 10–30% = Selective depth · <10% = Wide-ranging"],
  },
  {
    id: "listeningIntensity",
    label: "Listening Intensity",
    source: "user_records.play_count (Spotify) · dig_history count (proxy)",
    formula: "If Spotify data: score = clamp(playedRatio×0.5 + min(avgPlays×5, 50)). If no Spotify: score = clamp(√digHistoryCount × 14). 40 digs ≈ maximum proxy score.",
    labels: [">60 = Deep listener · 30–60 = Regular listener · <30 = Collector-first"],
    unavailable: "Requires Spotify connection or Dig usage",
  },
];

const ARCHETYPES = [
  {
    id: "keeper", name: "The Keeper", color: "#185FA5",
    description: "Feels responsible for what they own. The collection is a trust held on behalf of the music itself.",
    formula: [
      ["Label Loyalty",        "0.25"],
      ["Format Fidelity",      "0.15"],
      ["Artist Concentration", "0.20"],
      ["Condition Standard",   "0.10"],
      ["Sonic Coherence",      "0.10"],
      ["Historical Depth",     "0.10"],
      ["(100 − Acquisition Rhythm)", "0.10"],
    ],
    notes: "Low acquisition rhythm (slow, even buying) increases the score — the Keeper is not a binger.",
  },
  {
    id: "seeker", name: "The Seeker", color: "#0F6E56",
    description: "In permanent motion. Discovery is the experience — arrival is the beginning of the next search.",
    formula: [
      ["Geographic Range",            "0.20"],
      ["Style Range",                 "0.20"],
      ["Digital Divergence",          "0.15"],
      ["Aspiration Ratio",            "0.10"],
      ["Canon Obscurity",             "0.10"],
      ["(100 − Label Loyalty)",       "0.10"],
      ["(100 − Artist Concentration)","0.10"],
      ["Pressing Origin Diversity",   "0.05"],
    ],
    notes: "Digital Divergence uses raw score (0 if unavailable, not midpoint) — lack of Bandcamp data doesn't boost the Seeker.",
  },
  {
    id: "scholar", name: "The Scholar", color: "#533AB7",
    description: "The collection as evidence. Every record is data in an ongoing inquiry.",
    formula: [
      ["Historical Depth",           "0.20"],
      ["Geographic Range",           "0.15"],
      ["Pressing Origin Diversity",   "0.15"],
      ["Style Range",                "0.15"],
      ["Artist Concentration",       "0.10"],
      ["Sonic Coherence",            "0.10"],
      ["(100 − Canon Obscurity)",    "0.10"],
      ["Condition Standard",         "0.05"],
    ],
    notes: "Inverted Canon Obscurity rewards canonical, well-documented collections — the Scholar values records that exist within music history.",
  },
  {
    id: "ritualist", name: "The Ritualist", color: "#854F0B",
    description: "Depth over breadth. Returns to the same records the way one returns to a practice.",
    formula: [
      ["Sonic Coherence",             "0.30"],
      ["Condition Standard",          "0.20"],
      ["Listening Intensity",         "0.20"],
      ["(100 − Aspiration Ratio)",    "0.15"],
      ["(100 − Acquisition Rhythm)",  "0.15"],
    ],
    notes: "Small wantlist and low acquisition rhythm both increase this score — the Ritualist tends what they have rather than chasing more.",
  },
  {
    id: "hunter", name: "The Hunter", color: "#9A1F1F",
    description: "The chase is the experience. Pressing matters for scarcity, not stewardship.",
    formula: [
      ["Condition Standard",          "0.30"],
      ["Aspiration Ratio",            "0.25"],
      ["Pressing Origin Diversity",   "0.20"],
      ["Acquisition Rhythm",          "0.10"],
      ["Trophy Ratio",                "0.10"],
      ["(100 − Listening Intensity)", "0.05"],
    ],
    notes: "Higher acquisition rhythm (bursty buying) and lower listening intensity both increase the score — the Hunter acquires more than they listen.",
  },
  {
    id: "lover", name: "The Lover", color: "#CC5500",
    description: "The collection is a diary. Records mark emotional events, relationships, periods of life.",
    formula: [
      ["Acquisition Rhythm",      "0.20"],
      ["Listening Intensity",     "0.15"],
      ["Emotional Range",         "0.15"],
      ["(100 − Label Loyalty)",   "0.15"],
      ["Artist Concentration",    "0.15"],
      ["Aspiration Ratio",        "0.10"],
      ["Style Range",             "0.10"],
    ],
    notes: "Emotional Range (feeling tags) is the only signal unique to this archetype — the most direct measure of emotional engagement with the collection.",
  },
  {
    id: "alchemist", name: "The Alchemist", color: "#3B6D11",
    description: "Music is material. Transforms what they collect into something else — a set, a mix, an experience.",
    formula: [
      ["Style Range",                "0.20"],
      ["(100 − Sonic Coherence)",    "0.15"],
      ["Curatorial Reach",           "0.15"],
      ["Digital Divergence",         "0.15"],
      ["Geographic Range",           "0.15"],
      ["Transgressive Index",        "0.10"],
      ["Canon Obscurity",            "0.10"],
    ],
    notes: "Inverted Sonic Coherence rewards eclecticism — the Alchemist collects diverse raw material, not a curated single world.",
  },
  {
    id: "pilgrim", name: "The Pilgrim", color: "#2C6B7A",
    description: "Follows music to its source. Wants the pressing made in the country where the music was created.",
    formula: [
      ["Pressing Origin Diversity",  "0.35"],
      ["Geographic Range",           "0.25"],
      ["Canon Obscurity",            "0.15"],
      ["Historical Depth",           "0.15"],
      ["(100 − Label Loyalty)",      "0.10"],
    ],
    notes: "The highest single-signal weight in any archetype: Pressing Origin Diversity at 0.35 makes geography the defining axis.",
  },
  {
    id: "ruler", name: "The Ruler", color: "#2C2820",
    description: "Defines and dominates a canon. Not content to collect within a field — wants to own the field's definition.",
    formula: [
      ["Label Loyalty",          "0.30"],
      ["(100 − Style Range)",    "0.25"],
      ["Artist Concentration",   "0.15"],
      ["Condition Standard",     "0.10"],
      ["Historical Depth",       "0.10"],
      ["Sonic Coherence",        "0.10"],
    ],
    notes: "Inverted Style Range rewards narrow focus — the Ruler owns a territory deeply, not broadly.",
  },
  {
    id: "outlaw", name: "The Outlaw", color: "#6B1F6B",
    description: "Collects against the grain deliberately. Anti-canonical by intention.",
    formula: [
      ["Transgressive Index",      "0.35"],
      ["Canon Obscurity",          "0.25"],
      ["Style Range",              "0.15"],
      ["(100 − Label Loyalty)",    "0.15"],
      ["Geographic Range",         "0.10"],
    ],
    notes: "Transgressive Index at 0.35 is the highest weighting for a single alternative-culture signal across all archetypes.",
  },
  {
    id: "caregiver", name: "The Caregiver", color: "#1F5C3A",
    description: "The collection exists partly to give away. Makes lists as gifts. Introduces people to music.",
    formula: [
      ["Style Range",                "0.20"],
      ["Listening Intensity",        "0.20"],
      ["Digital Divergence",         "0.15"],
      ["Curatorial Reach",           "0.15"],
      ["Geographic Range",           "0.10"],
      ["Artist Concentration",       "0.10"],
      ["(100 − Sonic Coherence)",    "0.10"],
    ],
    notes: "Shares its formula shape with The Alchemist but weights Listening Intensity and Curatorial Reach more heavily — the Caregiver shares music, the Alchemist makes it.",
  },
];

const STAR_SIGN_NUDGES: Record<string, [string, string]> = {
  Aries:       ["hunter",    "outlaw"],
  Taurus:      ["keeper",    "ritualist"],
  Gemini:      ["seeker",    "alchemist"],
  Cancer:      ["caregiver", "lover"],
  Leo:         ["ruler",     "lover"],
  Virgo:       ["scholar",   "keeper"],
  Libra:       ["caregiver", "alchemist"],
  Scorpio:     ["outlaw",    "hunter"],
  Sagittarius: ["pilgrim",   "seeker"],
  Capricorn:   ["ruler",     "scholar"],
  Aquarius:    ["outlaw",    "alchemist"],
  Pisces:      ["lover",     "pilgrim"],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArchetypeReference() {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page-break { page-break-before: always; }
        }
        body { background: #fafaf8; }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 32px 80px", fontFamily: SERIF, color: INK, lineHeight: 1.6 }}>

        {/* Print button */}
        <div className="no-print" style={{ marginBottom: 32, display: "flex", gap: 12 }}>
          <PrintButton />
        </div>

        {/* Header */}
        <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 24, marginBottom: 40 }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE, margin: "0 0 8px" }}>
            rekōdo · Internal Reference
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Archetype Computation Reference
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, margin: 0 }}>
            How collection signals are computed and weighted to produce archetype scores
          </p>
        </div>

        {/* Overview */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 16 }}>
            How It Works
          </h2>
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>
            Archetypes are computed in three stages:
          </p>
          <ol style={{ fontSize: 14, paddingLeft: 20, margin: "0 0 12px" }}>
            <li style={{ marginBottom: 8 }}><strong>Signal extraction</strong> — 18 collection signals are computed from the user&apos;s records, wantlist, lists, and listening data. Each signal produces a score from 0–100.</li>
            <li style={{ marginBottom: 8 }}><strong>Archetype scoring</strong> — Each of the 11 archetypes is scored as a weighted sum of signals. Weights sum to 1.0. Some terms use an inverted signal (100 − score) to reward the opposite behaviour.</li>
            <li style={{ marginBottom: 8 }}><strong>Result assembly</strong> — Scores are ranked. The top score is the primary archetype. The second score becomes secondary if it is ≥40. The lowest-scoring archetype (excluding primary and secondary) becomes the shadow. A star sign nudge (+6 pts) is applied to two aligned archetypes before ranking if the user has set their star sign.</li>
          </ol>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, background: "#f3f3ef", padding: "10px 14px", margin: 0 }}>
            Unavailable signals (no data) are substituted with 50 (midpoint) rather than 0, so missing data is genuinely neutral and does not inadvertently boost archetypes that use an inverted term.
          </p>
        </section>

        {/* Signals */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 24 }}>
            The 18 Collection Signals
          </h2>
          {SIGNALS.map((sig, i) => (
            <div key={sig.id} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: i < SIGNALS.length - 1 ? `1px solid ${RULE}` : "none" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, minWidth: 20 }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{sig.label}</h3>
              </div>
              <div style={{ paddingLeft: 30 }}>
                <p style={{ fontFamily: MONO, fontSize: "10px", color: ORANGE, margin: "0 0 4px", letterSpacing: "0.06em" }}>
                  Source: {sig.source}
                </p>
                <p style={{ fontSize: 13, margin: "0 0 4px" }}>{sig.formula}</p>
                <p style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, margin: "0 0 4px" }}>
                  Labels: {sig.labels[0]}
                </p>
                {sig.unavailable && (
                  <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", margin: 0 }}>
                    Unavailable when: {sig.unavailable}
                  </p>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Archetypes */}
        <div className="page-break" />
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 24 }}>
            The 11 Archetypes
          </h2>
          {ARCHETYPES.map((a) => (
            <div key={a.id} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${RULE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, background: a.color, flexShrink: 0 }} />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{a.name}</h3>
              </div>
              <p style={{ fontSize: 13, fontStyle: "italic", color: MUTED, margin: "0 0 10px" }}>{a.description}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "4px 8px 4px 0", borderBottom: `1px solid ${RULE}` }}>Signal</th>
                    <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "right", padding: "4px 0 4px 8px", borderBottom: `1px solid ${RULE}`, width: 60 }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {a.formula.map(([signal, weight]) => (
                    <tr key={signal}>
                      <td style={{ fontFamily: MONO, fontSize: "11px", padding: "4px 8px 4px 0", color: INK }}>{signal}</td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", padding: "4px 0 4px 8px", textAlign: "right", color: ORANGE }}>{weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {a.notes && (
                <p style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, margin: 0, background: "#f3f3ef", padding: "8px 10px" }}>
                  {a.notes}
                </p>
              )}
            </div>
          ))}
        </section>

        {/* Named Pairings — summary table */}
        <div className="page-break" />
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 16 }}>
            Named Pairings (Primary + Secondary)
          </h2>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>
            When a secondary archetype scores ≥40, the combination may produce a named pairing. All 77 named pairings are listed below.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f3f3ef" }}>
                <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>Primary + Secondary</th>
                <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>Named Pairing</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["keeper + scholar",     "The Conservator"],
                ["keeper + pilgrim",     "The Purist"],
                ["keeper + ruler",       "The Custodian"],
                ["keeper + seeker",      "The Completist"],
                ["keeper + hunter",      "The Registrar"],
                ["keeper + lover",       "The Diarist"],
                ["keeper + alchemist",   "The Curator"],
                ["keeper + outlaw",      "The Preservationist"],
                ["keeper + caregiver",   "The Librarian"],
                ["seeker + scholar",     "The Etymologist"],
                ["seeker + outlaw",      "The Dissident"],
                ["seeker + pilgrim",     "The Anthropologist"],
                ["seeker + ritualist",   "The Pathfinder"],
                ["seeker + hunter",      "The Prospector"],
                ["seeker + alchemist",   "The Tastemaker"],
                ["seeker + ruler",       "The Arbiter"],
                ["seeker + caregiver",   "The Evangelist"],
                ["scholar + pilgrim",    "The Archaeologist"],
                ["scholar + ruler",      "The Taxonomist"],
                ["scholar + outlaw",     "The Revisionist"],
                ["scholar + lover",      "The Connoisseur"],
                ["ritualist + lover",    "The Devotee"],
                ["ritualist + keeper",   "The Monk"],
                ["ritualist + scholar",  "The Contemplative"],
                ["ritualist + outlaw",   "The Heretic"],
                ["ritualist + hunter",   "The Perfectionist"],
                ["ritualist + alchemist","The Maestro"],
                ["ritualist + pilgrim",  "The Disciple"],
                ["ritualist + ruler",    "The Steward"],
                ["ritualist + caregiver","The Sensei"],
                ["hunter + ruler",       "The Sovereign"],
                ["hunter + scholar",     "The Authenticator"],
                ["hunter + pilgrim",     "The Expeditionist"],
                ["hunter + lover",       "The Romantic"],
                ["hunter + alchemist",   "The Forager"],
                ["hunter + outlaw",      "The Iconoclast"],
                ["hunter + caregiver",   "The Patron"],
                ["lover + alchemist",    "The Poet"],
                ["lover + outlaw",       "The Rebel"],
                ["lover + seeker",       "The Dreamer"],
                ["lover + caregiver",    "The Empath"],
                ["lover + pilgrim",      "The Wanderer"],
                ["lover + ruler",        "The Idealist"],
                ["alchemist + scholar",  "The Critic"],
                ["alchemist + caregiver","The Teacher"],
                ["alchemist + outlaw",   "The Provocateur"],
                ["alchemist + pilgrim",  "The Ambassador"],
                ["alchemist + ruler",    "The Auteur"],
                ["pilgrim + outlaw",     "The Exile"],
                ["pilgrim + ruler",      "The Oracle"],
                ["pilgrim + caregiver",  "The Emissary"],
                ["ruler + outlaw",       "The Revolutionary"],
                ["ruler + caregiver",    "The Elder"],
                ["outlaw + caregiver",   "The Liberator"],
              ].map(([pair, name], i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#f9f9f7" }}>
                  <td style={{ fontFamily: MONO, fontSize: "11px", padding: "5px 10px", color: MUTED }}>{pair}</td>
                  <td style={{ fontFamily: MONO, fontSize: "11px", padding: "5px 10px" }}>{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Shadow */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 16 }}>
            Shadow Archetype
          </h2>
          <p style={{ fontSize: 13, margin: "0 0 12px" }}>
            The shadow is the lowest-scoring archetype, excluding the primary and secondary. It is not a thematic opposite — it is the most suppressed, least-expressed dimension of the collector&apos;s identity, in the Jungian sense.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: "#f3f3ef" }}>
                <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>Archetype</th>
                <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>Shadow Prompt</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["The Keeper",     "Your collection has almost nothing surprising in it. You are keeping music beautifully. You are not being surprised by it."],
                ["The Seeker",     "Your collection is growing in all directions. Nothing is being tended."],
                ["The Scholar",    "You understand this music with extraordinary precision. You haven't let it surprise you emotionally in some time."],
                ["The Ritualist",  "You know what you have with extraordinary depth. There are whole worlds of music you haven't let in yet."],
                ["The Hunter",     "You find extraordinary records. Some of them you've played twice."],
                ["The Lover",      "You feel this music with great intensity. You've never really studied what it is or where it came from."],
                ["The Alchemist",  "You create beautifully for others. When did you last just sit and listen for yourself?"],
                ["The Pilgrim",    "You've gone deep into the source. The music you've found deserves to be shared. Almost no one knows it exists."],
                ["The Ruler",      "You've defined the territory with extraordinary authority. You stopped exploring it years ago."],
                ["The Outlaw",     "You've refused every canon that was offered to you. You haven't built one of your own yet."],
                ["The Caregiver",  "You share music with great generosity. You rarely go somewhere others can't follow."],
              ].map(([name, prompt], i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#f9f9f7" }}>
                  <td style={{ fontFamily: MONO, fontSize: "11px", padding: "6px 10px", whiteSpace: "nowrap", verticalAlign: "top" }}>{name}</td>
                  <td style={{ fontSize: "12px", padding: "6px 10px", fontStyle: "italic", color: MUTED }}>{prompt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Star sign nudges */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 16 }}>
            Star Sign Nudge
          </h2>
          <p style={{ fontSize: 13, margin: "0 0 12px" }}>
            If the user has set their star sign, two thematically-aligned archetypes receive a <strong>+6 point nudge</strong> before ranking. This is a deliberately small prior — collection signals still drive the result. The nudge is applied to both primary and secondary candidates equally.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f3f3ef" }}>
                <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>Star Sign</th>
                <th style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>Nudged Archetypes (+6 each)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(STAR_SIGN_NUDGES).map(([sign, [a, b]], i) => (
                <tr key={sign} style={{ background: i % 2 === 0 ? "transparent" : "#f9f9f7" }}>
                  <td style={{ fontFamily: MONO, fontSize: "11px", padding: "5px 10px" }}>{sign}</td>
                  <td style={{ fontFamily: MONO, fontSize: "11px", padding: "5px 10px", color: ORANGE }}>
                    {a} · {b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>rekōdo · Archetype Computation Reference</span>
          <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>rekodo.co</span>
        </div>
      </div>
    </>
  );
}
