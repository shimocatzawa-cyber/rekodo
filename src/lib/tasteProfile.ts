import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DesireRealityGap {
  score: number;
  type: "deepener" | "balanced" | "expander";
  reachingToward: string | null;
  noData?: boolean;
}

export interface TwoMusicalSelves {
  convergenceScore: number;
  diverged: boolean;
  digitalOnlyArtists: string[];
  digitalGenre: string | null;
  noData?: boolean;
}

export interface AcquisitionRhythm {
  rhythmType: string;
  stdDev: number;
  peakWeek: string | null;
  trend: string;
  noData?: boolean;
}

export interface CompletistFingerprint {
  score: number;
  targets: string[];
  commonThread: string;
  intensity: "light" | "selective" | "devoted";
}

export interface LabelEcosystem {
  ecosystemType: string;
  dominantLabel: string;
  dominantLabelPct: number;
  orbitingLabels: string[];
  topLabels: Array<{ label: string; count: number; pct: number }>;
}

export interface ListeningCondition {
  collectorType: string;
  conditionScore: number;
  pctVGPlus: number;
}

export interface TemporalDrift {
  driftScore: number;
  driftType: "settled" | "evolving" | "searching";
  primaryShift: string | null;
  noData?: boolean;
}

export interface SonicCoherence {
  coherenceScore: number;
  coherenceType: string;
  outlierRecord: { artist: string; album: string } | null;
}

export interface CurationIdentity {
  curationRate: number;
  totalLists: number;
  editorialCourage: number;
  curationStyle: "non_curator" | "centre_curator" | "edge_curator";
  noData?: boolean;
}

export interface DiscoveryPipeline {
  pipelineType: string;
  digitalToVinylPct: number;
  uncommittedCount: number;
  topUncommittedArtists: string[];
  noData?: boolean;
}

export interface CulturalGeography {
  geographyType: string;
  counterCanonicalScore: number;
  mostDistinctiveCountry: string | null;
  topCountries: Array<{ country: string; count: number; weight: number }>;
}

export interface WantlistPatience {
  patienceType: string;
  aspirationRatio: number;
  wantlistCount: number;
}

export interface EraNostalgia {
  eraType: string;
  historicWeight: number;
  contemporaryWeight: number;
  modalDecade: string;
}

export interface TasteMetrics {
  m01: DesireRealityGap;
  m02: TwoMusicalSelves;
  m03: AcquisitionRhythm;
  m04: CompletistFingerprint;
  m05: LabelEcosystem;
  m06: ListeningCondition;
  m07: TemporalDrift;
  m08: SonicCoherence;
  m09: CurationIdentity;
  m10: DiscoveryPipeline;
  m11: CulturalGeography;
  m12: WantlistPatience;
  m13: EraNostalgia;
}

export interface ArchetypeScores {
  scores: Record<string, number>;
  primary: string;
  primaryScore: number;
  secondary: string | null;
  secondaryScore: number;
  tertiary: string | null;
}

export interface TasteProfile {
  metrics: TasteMetrics;
  archetypes: ArchetypeScores;
  generatedAt: string;
  recordCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function calcStdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function modal<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function weightedScore(inputs: [number, number][]): number {
  return inputs.reduce((sum, [value, weight]) => sum + value * weight, 0);
}

// ── Main computation ───────────────────────────────────────────────────────────

export async function computeTasteProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<TasteProfile> {
  const BATCH = 400;
  const PAGE = 1000;

  // A. user_records (paginated)
  type LinkRow = { record_id: string; created_at: string; media_condition: string | null };
  const allLinks: LinkRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("user_records")
      .select("record_id, created_at, media_condition")
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    allLinks.push(...(data as LinkRow[]));
    if (data.length < PAGE) break;
  }

  // B. records (batched)
  type RecordRow = {
    id: string; artist: string; album: string;
    year: number | null; genre: string | null;
    country: string | null; label: string | null;
  };
  const recordIds = allLinks.map(l => l.record_id);
  const recordsMap = new Map<string, RecordRow>();
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, artist, album, year, genre, country, label")
      .in("id", recordIds.slice(i, i + BATCH));
    for (const r of data ?? []) recordsMap.set(r.id, r as RecordRow);
  }

  const enriched = allLinks
    .map(link => {
      const rec = recordsMap.get(link.record_id);
      if (!rec) return null;
      return { ...rec, created_at: link.created_at, media_condition: link.media_condition };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const totalRecords = enriched.length;

  // C. Wantlist (Discogs wantlist table)
  type WantRow = { artist: string; released: number | null; date_added: string | null };
  const { data: wantlistRows } = await supabase
    .from("wantlist")
    .select("artist, released, date_added")
    .eq("user_id", userId);
  const wantlist = (wantlistRows ?? []) as WantRow[];
  const wantlistCount = wantlist.length;

  // D. Digital imports
  type DigRow = { artist: string; album: string };
  const { data: diData } = await supabase
    .from("digital_imports")
    .select("artist, album")
    .eq("user_id", userId);
  const digitalImports = (diData ?? []) as DigRow[];

  // E. Lists + list_items for curation metrics
  type ListRow = { id: string; title: string; slug: string };
  const { data: listsData } = await supabase
    .from("lists")
    .select("id, title, slug")
    .eq("user_id", userId);
  const userLists = (listsData ?? []) as ListRow[];

  const curatedRecordIds = new Set<string>();
  const curationLists = userLists.filter(l => l.slug !== "wantlist");
  const curationListIds = curationLists.map(l => l.id);
  if (curationListIds.length > 0) {
    for (let i = 0; i < curationListIds.length; i += 100) {
      const { data: liData } = await supabase
        .from("list_items")
        .select("record_id")
        .in("list_id", curationListIds.slice(i, i + 100));
      for (const li of liData ?? []) curatedRecordIds.add(li.record_id);
    }
  }

  // ── M01 — Desire / Reality Gap ─────────────────────────────────────────────
  const m01 = ((): DesireRealityGap => {
    if (wantlistCount === 0) {
      return { score: 20, type: "deepener", reachingToward: null, noData: true };
    }
    const ownedArtistSet = new Set(enriched.map(r => r.artist.toLowerCase().trim()));
    const wantArtists = wantlist.map(w => w.artist.toLowerCase().trim());
    const wantInOwned = wantArtists.filter(a => ownedArtistSet.has(a)).length;
    // Deepening if mostly wanting more from known artists; expanding if mostly new
    const deepenPct = wantArtists.length > 0 ? wantInOwned / wantArtists.length : 1;
    // score: how much desire diverges from what they own (0 = pure deepener, 100 = pure expander)
    const score = Math.round((1 - deepenPct) * 100);
    const type: "deepener" | "balanced" | "expander" =
      score < 40 ? "deepener" : score > 60 ? "expander" : "balanced";

    // "reaching toward" — top genre of want artists NOT in owned artists
    const newArtistGenres: string[] = [];
    for (const w of wantlist) {
      if (ownedArtistSet.has(w.artist.toLowerCase().trim())) continue;
      // find this artist in owned records to infer genre
      const match = enriched.find(r => r.artist.toLowerCase().trim() === w.artist.toLowerCase().trim());
      if (match?.genre) newArtistGenres.push(match.genre);
    }
    const reachingToward = modal(newArtistGenres);

    return { score, type, reachingToward };
  })();

  // ── M02 — Two Musical Selves ───────────────────────────────────────────────
  const m02 = ((): TwoMusicalSelves => {
    if (digitalImports.length === 0) {
      return { convergenceScore: 100, diverged: false, digitalOnlyArtists: [], digitalGenre: null, noData: true };
    }
    const ownedSet = new Set(enriched.map(r => r.artist.toLowerCase().trim()));
    const digitalArtists = [...new Set(digitalImports.map(d => d.artist.toLowerCase().trim()))];
    const overlap = digitalArtists.filter(a => ownedSet.has(a));
    const convergenceScore = digitalArtists.length > 0
      ? Math.round((overlap.length / digitalArtists.length) * 100)
      : 100;
    const topDigitalOnly = digitalImports
      .filter(d => !ownedSet.has(d.artist.toLowerCase().trim()))
      .map(d => d.artist)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    return {
      convergenceScore,
      diverged: convergenceScore < 50,
      digitalOnlyArtists: topDigitalOnly,
      digitalGenre: null,
    };
  })();

  // ── M03 — Acquisition Rhythm ───────────────────────────────────────────────
  const m03 = ((): AcquisitionRhythm => {
    const dated = enriched.filter(r => r.created_at);
    if (dated.length < 10) {
      return { rhythmType: "insufficient_data", stdDev: 0, peakWeek: null, trend: "steady", noData: true };
    }
    const weekCounts = new Map<string, number>();
    for (const r of dated) {
      const week = getISOWeek(new Date(r.created_at));
      weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    }
    const counts = [...weekCounts.values()];
    const sd = calcStdDev(counts);
    const rhythmType = sd < 0.8 ? "ritualist" : sd > 2.5 ? "binge" : "measured";
    const peakWeek = [...weekCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const overallAvg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const allWeeks = [...weekCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
    const last8 = allWeeks.slice(-8).map(([, c]) => c);
    const last8Avg = last8.length > 0 ? last8.reduce((a, b) => a + b, 0) / last8.length : overallAvg;
    const trend = last8Avg > overallAvg * 1.2 ? "accelerating" : last8Avg < overallAvg * 0.8 ? "slowing" : "steady";

    return { rhythmType, stdDev: Math.round(sd * 100) / 100, peakWeek, trend };
  })();

  // ── M04 — Completist Fingerprint ───────────────────────────────────────────
  const m04 = ((): CompletistFingerprint => {
    const artistMap = new Map<string, { count: number; genres: string[]; labels: string[] }>();
    for (const r of enriched) {
      const entry = artistMap.get(r.artist) ?? { count: 0, genres: [], labels: [] };
      entry.count++;
      if (r.genre) entry.genres.push(r.genre);
      if (r.label) entry.labels.push(r.label);
      artistMap.set(r.artist, entry);
    }
    const targets = [...artistMap.entries()].filter(([, v]) => v.count >= 3).map(([a]) => a);
    const score = Math.min(100, Math.round((targets.length / Math.max(artistMap.size, 1)) * 200));
    const intensity: "light" | "selective" | "devoted" =
      score < 20 ? "light" : score < 50 ? "selective" : "devoted";

    const allTargetGenres: string[] = [];
    const allTargetLabels: string[] = [];
    for (const t of targets) {
      const e = artistMap.get(t)!;
      allTargetGenres.push(...e.genres);
      allTargetLabels.push(...e.labels);
    }
    const topGenre = modal(allTargetGenres);
    const topLabel = modal(allTargetLabels);
    const commonThread = targets.length === 0
      ? "No completist tendencies yet"
      : topGenre
        ? `${topGenre}${topLabel ? ` · ${topLabel}` : ""}`
        : `${targets.length} artists deeply collected`;

    return { score, targets: targets.slice(0, 10), commonThread, intensity };
  })();

  // ── M05 — Label Ecosystem ──────────────────────────────────────────────────
  const m05 = ((): LabelEcosystem => {
    const labelMap = new Map<string, { count: number; genres: string[] }>();
    for (const r of enriched) {
      if (!r.label) continue;
      const entry = labelMap.get(r.label) ?? { count: 0, genres: [] };
      entry.count++;
      if (r.genre) entry.genres.push(r.genre);
      labelMap.set(r.label, entry);
    }
    const sorted = [...labelMap.entries()].sort((a, b) => b[1].count - a[1].count);
    const top10 = sorted.slice(0, 10);
    const top1Pct = totalRecords > 0 ? (top10[0]?.[1].count ?? 0) / totalRecords * 100 : 0;
    const top3Count = top10.slice(0, 3).reduce((s, [, v]) => s + v.count, 0);
    const top3Pct = totalRecords > 0 ? (top3Count / totalRecords) * 100 : 0;

    let ecosystemType = "open_sea";
    if (top1Pct > 20) ecosystemType = "monastic";
    else if (top3Pct > 40) ecosystemType = "solar_system";
    else if (top3Pct > 20) ecosystemType = "archipelago";

    const dominantLabel = top10[0]?.[0] ?? "Unknown";
    const dominantLabelPct = Math.round(top1Pct * 10) / 10;
    const topLabelGenre = modal(top10[0]?.[1].genres ?? []);
    const orbitingLabels = topLabelGenre
      ? top10.slice(1, 6).filter(([, v]) => v.genres.includes(topLabelGenre)).map(([l]) => l)
      : [];

    return {
      ecosystemType,
      dominantLabel,
      dominantLabelPct,
      orbitingLabels,
      topLabels: top10.map(([label, { count }]) => ({
        label, count, pct: Math.round((count / Math.max(totalRecords, 1)) * 100),
      })),
    };
  })();

  // ── M06 — Listening Condition ──────────────────────────────────────────────
  const m06 = ((): ListeningCondition => {
    const grades = enriched.map(r => r.media_condition).filter((g): g is string => !!g);
    if (grades.length === 0) {
      return { collectorType: "listener", conditionScore: 0.5, pctVGPlus: 50 };
    }
    function gradeScore(g: string): number {
      const u = g.toUpperCase();
      if (u.includes("MINT (M)") && !u.includes("NEAR")) return 3;
      if (u.includes("NEAR MINT") || u.includes("NM") || u.includes("M-")) return 3;
      if (u.includes("VERY GOOD PLUS") || u.includes("VG+")) return 2.5;
      if (u.includes("VERY GOOD") || u.includes("VG")) return 1.5;
      if (u.includes("GOOD PLUS") || u.includes("G+")) return 0.5;
      if (u.includes("GOOD") || u.includes("(G)")) return 0.5;
      if (u.includes("FAIR") || u.includes("POOR")) return 0;
      return 1.5; // ungraded default
    }
    function isVGPlus(g: string): boolean {
      const u = g.toUpperCase();
      return u.includes("MINT") || u.includes("NM") || u.includes("M-") ||
        u.includes("VG+") || u.includes("VERY GOOD PLUS");
    }
    const totalScore = grades.reduce((s, g) => s + gradeScore(g), 0);
    const conditionScore = totalScore / (grades.length * 3);
    const pctVGPlus = Math.round((grades.filter(isVGPlus).length / grades.length) * 100);
    const collectorType = conditionScore > 0.8 ? "curator" : conditionScore >= 0.55 ? "listener" : "content_first";
    return { collectorType, conditionScore: Math.round(conditionScore * 100) / 100, pctVGPlus };
  })();

  // ── M07 — Temporal Taste Drift ─────────────────────────────────────────────
  const m07 = ((): TemporalDrift => {
    const dated = [...enriched]
      .filter(r => r.created_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (dated.length < 30) {
      return { driftScore: 0, driftType: "settled", primaryShift: null, noData: true };
    }
    const third = Math.floor(dated.length / 3);
    const first = dated.slice(0, third);
    const last  = dated.slice(-third);
    const firstGenre = modal(first.map(r => r.genre).filter((g): g is string => !!g));
    const lastGenre  = modal(last.map(r => r.genre).filter((g): g is string => !!g));
    let driftScore = 0;
    let primaryShift: string | null = null;
    if (firstGenre && lastGenre && firstGenre !== lastGenre) {
      driftScore = 75;
      primaryShift = `Moved from ${firstGenre} toward ${lastGenre}`;
    } else if (firstGenre || lastGenre) {
      driftScore = 15;
    }
    const driftType: "settled" | "evolving" | "searching" =
      driftScore < 30 ? "settled" : driftScore < 70 ? "evolving" : "searching";
    return { driftScore, driftType, primaryShift };
  })();

  // ── M08 — Sonic Coherence ──────────────────────────────────────────────────
  const m08 = ((): SonicCoherence => {
    const sample = totalRecords > 200
      ? [...enriched].sort(() => 0.5 - Math.random()).slice(0, 200)
      : enriched;
    if (sample.length < 2) {
      return { coherenceScore: 50, coherenceType: "themed_eclectic", outlierRecord: null };
    }
    const genres = [...new Set(sample.map(r => r.genre ?? "Unknown"))].sort();
    const countries = [...new Set(sample.map(r => r.country ?? "Unknown"))].sort();
    const maxGenre = Math.max(genres.length - 1, 1);
    const maxCountry = Math.max(countries.length - 1, 1);
    const maxDecade = 14;

    interface Vec { g: number; d: number; c: number; artist: string; album: string }
    const vectors: Vec[] = sample.map(r => ({
      g: genres.indexOf(r.genre ?? "Unknown"),
      d: r.year ? Math.floor(r.year / 10) - 196 : 7,
      c: countries.indexOf(r.country ?? "Unknown"),
      artist: r.artist,
      album:  r.album,
    }));

    const maxPairs = 5000;
    let totalSim = 0;
    let pairCount = 0;
    const outlierSim = new Array(vectors.length).fill(0);
    const outlierN   = new Array(vectors.length).fill(0);

    outer: for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const dist = Math.abs(vectors[i].g - vectors[j].g) / maxGenre
          + Math.abs(vectors[i].d - vectors[j].d) / maxDecade
          + Math.abs(vectors[i].c - vectors[j].c) / maxCountry;
        const sim = 1 - Math.min(dist / 3, 1);
        totalSim += sim;
        outlierSim[i] += sim; outlierN[i]++;
        outlierSim[j] += sim; outlierN[j]++;
        pairCount++;
        if (pairCount >= maxPairs) break outer;
      }
    }

    const coherenceScore = pairCount > 0 ? Math.round((totalSim / pairCount) * 100) : 50;
    const coherenceType = coherenceScore > 70 ? "curated_world"
      : coherenceScore >= 45 ? "themed_eclectic" : "deliberate_omnivore";

    let minAvgSim = Infinity;
    let outlierIdx = -1;
    for (let i = 0; i < vectors.length; i++) {
      if (outlierN[i] === 0) continue;
      const avg = outlierSim[i] / outlierN[i];
      if (avg < minAvgSim) { minAvgSim = avg; outlierIdx = i; }
    }
    const outlierRecord = outlierIdx >= 0
      ? { artist: vectors[outlierIdx].artist, album: vectors[outlierIdx].album }
      : null;

    return { coherenceScore, coherenceType, outlierRecord };
  })();

  // ── M09 — Curation Identity ────────────────────────────────────────────────
  const m09 = ((): CurationIdentity => {
    if (curationLists.length === 0) {
      return { curationRate: 0, totalLists: 0, editorialCourage: 0, curationStyle: "non_curator", noData: true };
    }
    const curationRate = totalRecords > 0
      ? Math.round((curatedRecordIds.size / totalRecords) * 100)
      : 0;
    const topOwnedGenre = modal(enriched.map(r => r.genre).filter((g): g is string => !!g));
    const curatedGenres = enriched
      .filter(r => curatedRecordIds.has(r.id))
      .map(r => r.genre)
      .filter((g): g is string => !!g);
    const outsideCentre = curatedGenres.filter(g => g !== topOwnedGenre).length;
    const editorialCourage = curatedGenres.length > 0
      ? Math.round((outsideCentre / curatedGenres.length) * 100)
      : 0;
    let curationStyle: "non_curator" | "centre_curator" | "edge_curator" = "non_curator";
    if (curationRate > 0) {
      curationStyle = editorialCourage >= 40 ? "edge_curator" : "centre_curator";
    }
    return { curationRate, totalLists: curationLists.length, editorialCourage, curationStyle };
  })();

  // ── M10 — Discovery Pipeline ───────────────────────────────────────────────
  const m10 = ((): DiscoveryPipeline => {
    if (digitalImports.length === 0) {
      return { pipelineType: "vinyl_only", digitalToVinylPct: 0, uncommittedCount: 0, topUncommittedArtists: [], noData: true };
    }
    const ownedSet = new Set(enriched.map(r => r.artist.toLowerCase().trim()));
    const digitalArtists = [...new Set(digitalImports.map(d => d.artist.toLowerCase().trim()))];
    const inBoth = digitalArtists.filter(a => ownedSet.has(a));
    const digitalToVinylPct = digitalArtists.length > 0
      ? Math.round((inBoth.length / digitalArtists.length) * 100)
      : 0;
    const uncommittedArtists = digitalImports
      .filter(d => !ownedSet.has(d.artist.toLowerCase().trim()))
      .map(d => d.artist)
      .filter((v, i, a) => a.indexOf(v) === i);
    let pipelineType = "parallel";
    if (digitalToVinylPct > 30) pipelineType = "deliberate";
    else if (uncommittedArtists.length / Math.max(digitalArtists.length, 1) > 0.7) pipelineType = "scout";
    return {
      pipelineType,
      digitalToVinylPct,
      uncommittedCount: uncommittedArtists.length,
      topUncommittedArtists: uncommittedArtists.slice(0, 3),
    };
  })();

  // ── M11 — Cultural Geography ───────────────────────────────────────────────
  const m11 = ((): CulturalGeography => {
    const WEIGHTS: Record<string, number> = {
      Japan: 2.0, Germany: 1.8, Jamaica: 1.8, Brazil: 1.7, Nigeria: 1.9,
      France: 1.5, Norway: 1.6, Sweden: 1.6, Denmark: 1.6, Finland: 1.6,
      UK: 0.8, US: 0.6, USA: 0.6, Australia: 1.0,
    };
    const countryMap = new Map<string, { count: number; weight: number }>();
    for (const r of enriched) {
      if (!r.country) continue;
      const weight = WEIGHTS[r.country] ?? 1.2;
      const entry = countryMap.get(r.country) ?? { count: 0, weight };
      entry.count++;
      countryMap.set(r.country, entry);
    }
    const totalWithCountry = [...countryMap.values()].reduce((s, v) => s + v.count, 0);
    const weightedSum = [...countryMap.values()].reduce((s, v) => s + v.weight * v.count, 0);
    const counterCanonicalScore = totalWithCountry > 0
      ? Math.min(100, Math.round((weightedSum / totalWithCountry) * 50))
      : 50;
    const geographyType = counterCanonicalScore > 65 ? "counter_canonical"
      : counterCanonicalScore >= 40 ? "mixed" : "mainstream";
    const sorted = [...countryMap.entries()].sort((a, b) => b[1].count - a[1].count);
    const topCountries = sorted.slice(0, 10).map(([country, { count, weight }]) => ({ country, count, weight }));
    const mostDistinctiveCountry = sorted
      .filter(([c, { count }]) => count > 2 && (WEIGHTS[c] ?? 1.2) > (WEIGHTS[sorted[0]?.[0]] ?? 1.2))
      .sort((a, b) => (WEIGHTS[b[0]] ?? 1.2) - (WEIGHTS[a[0]] ?? 1.2))[0]?.[0] ?? null;
    return { geographyType, counterCanonicalScore, mostDistinctiveCountry, topCountries };
  })();

  // ── M12 — Wantlist Patience ────────────────────────────────────────────────
  const m12 = ((): WantlistPatience => {
    const aspirationRatio = totalRecords > 0
      ? Math.round((wantlistCount / totalRecords) * 100) / 100
      : 0;
    const patienceType = aspirationRatio > 0.5 ? "active_seeker"
      : aspirationRatio >= 0.2 ? "selective" : "content";
    return { patienceType, aspirationRatio, wantlistCount };
  })();

  // ── M13 — Era Nostalgia ────────────────────────────────────────────────────
  const m13 = ((): EraNostalgia => {
    const years = enriched.map(r => r.year).filter((y): y is number => y != null && y > 0);
    if (years.length === 0) {
      return { eraType: "bridge", historicWeight: 0, contemporaryWeight: 0, modalDecade: "Unknown" };
    }
    const historicWeight = Math.round((years.filter(y => y < 1980).length / years.length) * 100);
    const contemporaryWeight = Math.round((years.filter(y => y >= 2000).length / years.length) * 100);
    const eraType = historicWeight > 60 ? "historian" : contemporaryWeight > 50 ? "contemporary" : "bridge";
    const decadeCounts = new Map<string, number>();
    for (const y of years) {
      const d = y < 1960 ? "Pre-1960s" : `${Math.floor(y / 10) * 10}s`;
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
    }
    const modalDecade = [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
    return { eraType, historicWeight, contemporaryWeight, modalDecade };
  })();

  const metrics: TasteMetrics = { m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13 };
  const archetypes = computeArchetypeScores(metrics);

  return { metrics, archetypes, generatedAt: new Date().toISOString(), recordCount: totalRecords };
}

// ── Archetype scoring ──────────────────────────────────────────────────────────

function computeArchetypeScores(metrics: TasteMetrics): ArchetypeScores {
  const scores: Record<string, number> = {};

  scores.archaeologist = weightedScore([
    [metrics.m12.aspirationRatio < 0.3 ? 80 : 30, 0.25],
    [metrics.m06.conditionScore * 100, 0.20],
    [metrics.m04.score, 0.20],
    [metrics.m08.coherenceScore, 0.15],
    [Math.max(0, 100 - metrics.m03.stdDev * 20), 0.20],
  ]);

  scores.cartographer = weightedScore([
    [metrics.m11.counterCanonicalScore, 0.35],
    [metrics.m01.type === "expander" ? 80 : 20, 0.20],
    [metrics.m02.convergenceScore < 50 ? 80 : 20, 0.20],
    [Math.min(metrics.m07.driftScore * 0.8, 80), 0.15],
    [metrics.m09.editorialCourage, 0.10],
  ]);

  scores.archivist = weightedScore([
    [Math.min(metrics.m05.dominantLabelPct * 200, 100), 0.25],
    [metrics.m04.score, 0.25],
    [100 - metrics.m07.driftScore, 0.20],
    [metrics.m08.coherenceScore, 0.15],
    [metrics.m13.historicWeight, 0.15],
  ]);

  scores.emotional = weightedScore([
    [metrics.m07.driftScore, 0.30],
    [Math.min(metrics.m03.stdDev * 25, 100), 0.30],
    [100 - metrics.m08.coherenceScore, 0.25],
    [metrics.m12.aspirationRatio > 0.5 ? 70 : 30, 0.15],
  ]);

  scores.sensualist = weightedScore([
    [metrics.m06.conditionScore * 100, 0.30],
    [metrics.m08.coherenceScore, 0.25],
    [100 - metrics.m11.counterCanonicalScore * 0.3, 0.20],
    [100 - metrics.m01.score * 0.5, 0.15],
    [metrics.m13.historicWeight, 0.10],
  ]);

  scores.scout = weightedScore([
    [metrics.m02.diverged ? 80 : 20, 0.25],
    [metrics.m01.type === "expander" ? 80 : 20, 0.25],
    [metrics.m10.pipelineType === "scout" ? 80 : metrics.m10.pipelineType === "deliberate" ? 50 : 20, 0.25],
    [metrics.m12.aspirationRatio > 0.4 ? 70 : 30, 0.15],
    [metrics.m07.driftScore, 0.10],
  ]);

  scores.custodian = weightedScore([
    [metrics.m08.coherenceScore, 0.30],
    [100 - metrics.m07.driftScore, 0.25],
    [metrics.m05.ecosystemType === "solar_system" || metrics.m05.ecosystemType === "monastic" ? 80 : 30, 0.20],
    [Math.min(metrics.m09.curationRate * 2, 100), 0.15],
    [100 - metrics.m01.score * 0.5, 0.10],
  ]);

  scores.biographer = weightedScore([
    [metrics.m04.score, 0.35],
    [metrics.m10.digitalToVinylPct, 0.25],
    [metrics.m02.convergenceScore, 0.20],
    [100 - metrics.m01.score * 0.5, 0.10],
    [Math.min(metrics.m09.curationRate * 1.5, 100), 0.10],
  ]);

  for (const k of Object.keys(scores)) {
    scores[k] = Math.min(100, Math.max(0, Math.round(scores[k])));
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  return {
    scores,
    primary:       sorted[0][0],
    primaryScore:  sorted[0][1],
    secondary:     sorted[1][1] >= 40 ? sorted[1][0] : null,
    secondaryScore: sorted[1][1],
    tertiary:      sorted[2][1] >= 30 ? sorted[2][0] : null,
  };
}
