import type { SupabaseClient } from '@supabase/supabase-js'
import { getNamedPairing } from './archetypeConfig'
import { getDesirabilityTier } from '@/lib/desirability'
import { STAR_SIGN_ARCHETYPE_NUDGE, STAR_SIGN_NUDGE_AMOUNT } from './starSignNudges'
import type { StarSign } from '@/lib/starSigns'

export interface SignalResult {
  score: number
  label: string
  subtext?: string
  unavailable?: boolean
  [key: string]: unknown
}

export interface ComputedSignals {
  labelLoyalty: SignalResult & { top3Pct: number }
  conditionStandard: SignalResult
  formatFidelity: SignalResult
  sonicCoherence: SignalResult
  geographicRange: SignalResult
  pressingOriginDiversity: SignalResult & { topCountry: string | null; uniqueCountries: number }
  trophyRatio: SignalResult
  historicalDepth: SignalResult & { modalDecade: number | null }
  acquisitionRhythm: SignalResult & { rhythmType: string; stdDev: number }
  styleRange: SignalResult & { uniqueStyles: number }
  transgressiveIndex: SignalResult
  aspirationRatio: SignalResult & { ratio: number }
  curatorialReach: SignalResult
  digitalDivergence: SignalResult & { digitalOnlyArtists: string[] }
  emotionalRange: SignalResult & { uniqueFeelings: number; taggedCount: number }
  canonObscurity: SignalResult
  artistConcentration: SignalResult
  listeningIntensity: SignalResult
}

export interface ArchetypeResult {
  scores: Record<string, number>
  primary: string
  primaryScore: number
  secondary: string | null
  secondaryScore: number
  shadow: string
  shadowScore: number
  namedPairing: string | null
  signals: ComputedSignals
  recordCount: number
  generatedAt: string
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export async function computeArchetypes(
  userId: string,
  supabase: SupabaseClient
): Promise<ArchetypeResult> {
  // ── A: user_records with joined record data (paginated past Supabase 1000-row default) ─
  const PAGE_SIZE = 1000
  let userRecordsRaw: unknown[] = []
  let page = 0
  while (true) {
    const { data: batch } = await supabase
      .from('user_records')
      .select(`
        media_condition,
        price_median,
        price_low,
        play_count,
        created_at,
        date_added,
        feeling,
        records (
          artist, album, year, genre, styles, label, country, format,
          community_have, community_want, community_num_for_sale, edition_size
        )
      `)
      .eq('user_id', userId)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!batch || batch.length === 0) break
    userRecordsRaw = userRecordsRaw.concat(batch)
    if (batch.length < PAGE_SIZE) break
    page++
  }

  type RecordJoin = {
    artist: string | null
    album: string | null
    year: number | null
    genre: string | null
    styles: string[] | null
    label: string | null
    country: string | null
    format: string | null
    community_have:          number | null
    community_want:          number | null
    community_num_for_sale:  number | null
    edition_size:            number | null
  }

  type UserRecordRow = {
    media_condition: string | null
    price_median:    number | null
    price_low:       number | null
    play_count:      number | null
    created_at:      string | null
    date_added:      string | null
    feeling:         string | null
    records:         RecordJoin | RecordJoin[] | null
  }

  const userRecords: UserRecordRow[] = (userRecordsRaw ?? []) as UserRecordRow[]
  const totalRecords = userRecords.length

  // Flatten nested record (supabase returns object or array depending on join cardinality)
  function getRecord(row: UserRecordRow): RecordJoin | null {
    if (!row.records) return null
    return Array.isArray(row.records) ? (row.records[0] ?? null) : row.records
  }

  // ── B: Wantlist count ────────────────────────────────────────────────────────
  // Use count:exact to avoid the PostgREST 1000-row default cap.
  let wantlistCount = 0
  const { count: wantlistCountRaw } = await supabase
    .from('list_items')
    .select('id, lists!inner(user_id, slug)', { count: 'exact', head: true })
    .eq('lists.user_id', userId)
    .eq('lists.slug', 'wantlist')
  wantlistCount = wantlistCountRaw ?? 0

  // ── C: Digital imports ───────────────────────────────────────────────────────
  const { data: digitalImportsRaw } = await supabase
    .from('digital_imports')
    .select('artist, album')
    .eq('user_id', userId)
  const digitalImports = digitalImportsRaw ?? []

  // ── C2: Dig history count — engagement proxy when Spotify play_count is absent ─
  const { count: digCountRaw } = await supabase
    .from('dig_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const digHistoryCount = digCountRaw ?? 0

  // ── D: Lists and list_items ──────────────────────────────────────────────────
  const { data: listsRaw } = await supabase
    .from('lists')
    .select('id, title')
    .eq('user_id', userId)
  const lists = listsRaw ?? []

  const listIds = lists.map((l: { id: string }) => l.id)
  let listItems: Array<{ list_id: string; record_id: string | null; records: { genre: string | null; year: number | null; country: string | null } | null }> = []
  if (listIds.length > 0) {
    const { data: listItemsRaw } = await supabase
      .from('list_items')
      .select('list_id, record_id, records(genre, year, country)')
      .in('list_id', listIds)
      .eq('item_type', 'record')
    listItems = (listItemsRaw ?? []) as unknown as typeof listItems
  }

  // ── SIGNAL COMPUTATIONS ─────────────────────────────────────────────────────

  // 1. labelLoyalty
  const labelCounts = new Map<string, number>()
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.label) labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1)
  }
  const labelsSorted = [...labelCounts.values()].sort((a, b) => b - a)
  const top3Sum = labelsSorted.slice(0, 3).reduce((a, b) => a + b, 0)
  const top3Pct = totalRecords > 0 ? (top3Sum / totalRecords) * 100 : 0
  const labelLoyalty: ComputedSignals['labelLoyalty'] = {
    score: clamp(top3Pct),
    top3Pct,
    label: top3Pct > 70 ? 'Devoted' : top3Pct >= 50 ? 'Loyal' : top3Pct >= 30 ? 'Selective' : 'Eclectic',
    subtext: `Top 3 labels = ${Math.round(top3Pct)}% of collection`,
  }

  // 2. conditionStandard
  const NM_MINT_GRADES = new Set([
    'M', 'Mint (M)', 'NM', 'Near Mint (NM or M-)', 'Near Mint (NM)',
  ])
  let nmMintCount = 0
  let conditionTotal = 0
  for (const row of userRecords) {
    if (row.media_condition) {
      conditionTotal++
      if (NM_MINT_GRADES.has(row.media_condition)) nmMintCount++
    }
  }
  const nmPct = conditionTotal > 0 ? (nmMintCount / conditionTotal) * 100 : 0
  const conditionStandard: ComputedSignals['conditionStandard'] = {
    score: clamp(nmPct),
    label: nmPct > 60 ? 'Fastidious' : nmPct >= 30 ? 'Quality-conscious' : 'Content-first',
    subtext: conditionTotal > 0
      ? `${nmMintCount} of ${conditionTotal} records NM or better`
      : 'No condition data',
    unavailable: conditionTotal === 0,
  }

  // 3. formatFidelity
  let lpCount = 0
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.format) {
      const f = r.format.toLowerCase()
      if (f.includes('lp') || f.includes('album') || f.includes('12"')) lpCount++
    }
  }
  const lpPct = totalRecords > 0 ? (lpCount / totalRecords) * 100 : 0
  const formatFidelity: ComputedSignals['formatFidelity'] = {
    score: clamp(lpPct),
    label: lpPct > 90 ? 'LP Purist' : lpPct >= 70 ? 'Album-focused' : 'Format-agnostic',
    subtext: `${Math.round(lpPct)}% LP / Album`,
  }

  // 4. sonicCoherence
  // Build genre, decade, country indexes for sampled records
  const genres = new Set<string>()
  const countries = new Set<string>()
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.genre) genres.add(r.genre)
    if (r?.country) countries.add(r.country)
  }
  const genreList = [...genres].sort()
  const countryList = [...countries].sort()

  const sampleSize = Math.min(totalRecords, 150)
  const sampled = totalRecords > 150
    ? userRecords.sort(() => Math.random() - 0.5).slice(0, sampleSize)
    : userRecords

  type Vec = [number, number, number]
  const vectors: Vec[] = []
  for (const row of sampled) {
    const r = getRecord(row)
    if (!r) continue
    const gi = r.genre ? genreList.indexOf(r.genre) / Math.max(genreList.length - 1, 1) : 0.5
    const decade = r.year ? Math.floor(r.year / 10) - 195 : 5
    const di = Math.max(0, Math.min(decade, 10)) / 10
    const ci = r.country ? countryList.indexOf(r.country) / Math.max(countryList.length - 1, 1) : 0.5
    vectors.push([gi, di, ci])
  }

  let avgDist = 0
  if (vectors.length > 1) {
    let totalDist = 0
    let pairs = 0
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        totalDist += Math.abs(vectors[i][0] - vectors[j][0])
          + Math.abs(vectors[i][1] - vectors[j][1])
          + Math.abs(vectors[i][2] - vectors[j][2])
        pairs++
        if (pairs > 5000) break
      }
      if (pairs > 5000) break
    }
    avgDist = pairs > 0 ? totalDist / pairs : 0
  }
  const coherenceScore = clamp(100 - (avgDist / 3) * 100)
  const sonicCoherence: ComputedSignals['sonicCoherence'] = {
    score: coherenceScore,
    label: coherenceScore > 70 ? 'Curated World' : coherenceScore >= 45 ? 'Themed' : 'Eclectic',
    subtext: 'Based on genre, era, and country spread',
  }

  // 5. geographicRange
  const COUNTRY_WEIGHTS: Record<string, number> = {
    Japan: 2.0, Germany: 1.8, Jamaica: 1.8, Brazil: 1.7, Nigeria: 1.9,
    France: 1.5, Norway: 1.6, Sweden: 1.6, Denmark: 1.6, Finland: 1.6,
    UK: 0.8, USA: 0.6, US: 0.6, Australia: 1.0,
  }
  let geoWeightedSum = 0
  const countryCounts = new Map<string, number>()
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.country) {
      countryCounts.set(r.country, (countryCounts.get(r.country) ?? 0) + 1)
    }
  }
  for (const [country, count] of countryCounts) {
    const weight = COUNTRY_WEIGHTS[country] ?? 1.2
    geoWeightedSum += weight * count
  }
  const geoScore = clamp(totalRecords > 0 ? (geoWeightedSum / totalRecords) * 50 : 0)
  const geographicRange: ComputedSignals['geographicRange'] = {
    score: geoScore,
    label: geoScore > 65 ? 'Counter-canonical' : geoScore >= 40 ? 'Mixed' : 'Mainstream',
    subtext: `${countryCounts.size} pressing countries`,
  }

  // 6. pressingOriginDiversity
  const uniqueCountries = countryCounts.size
  const diversityScore1 = Math.min(uniqueCountries * 5, 100)
  const angloCount = (countryCounts.get('UK') ?? 0) + (countryCounts.get('USA') ?? 0) + (countryCounts.get('US') ?? 0) + (countryCounts.get('Australia') ?? 0)
  const nonAngloScore = totalRecords > 0 ? ((totalRecords - angloCount) / totalRecords) * 100 : 0
  const pressingScore = clamp((diversityScore1 + nonAngloScore) / 2)
  const topCountryEntry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const pressingOriginDiversity: ComputedSignals['pressingOriginDiversity'] = {
    score: pressingScore,
    label: `${uniqueCountries} countries`,
    topCountry: topCountryEntry?.[0] ?? null,
    uniqueCountries,
    subtext: topCountryEntry ? `Top: ${topCountryEntry[0]} (${topCountryEntry[1]})` : 'No pressing data',
  }

  // 7. trophyRatio — scored via full desirability tier system
  // Tier points: rare=5, cult=3, in-demand=2, widely-loved=1, null=0
  // Max possible per record is 5, so score = (sum / (records * 5)) * 100
  const TIER_POINTS: Record<string, number> = {
    'rare': 5, 'cult': 3, 'in-demand': 2, 'widely-loved': 1,
  }
  let trophyPoints = 0
  let trophyTotal = 0
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.community_have != null && r?.community_want != null) {
      const tier = getDesirabilityTier(
        r.community_have, r.community_want,
        row.price_low ?? null, r.community_num_for_sale ?? null,
        r.edition_size ?? null,
      )
      trophyPoints += tier ? (TIER_POINTS[tier] ?? 0) : 0
      trophyTotal += 5
    }
  }
  const hasDesirabilityData = trophyTotal > 0
  const trophyScore = hasDesirabilityData ? clamp((trophyPoints / trophyTotal) * 100) : 0
  const trophyRatio: ComputedSignals['trophyRatio'] = {
    score: trophyScore,
    label: !hasDesirabilityData ? 'No data' : trophyScore > 40 ? 'Obsessive Hunter' : trophyScore >= 20 ? 'Rarity-aware' : 'Music-first',
    subtext: hasDesirabilityData ? 'Based on community desirability tiers' : 'Sync collection to unlock',
    unavailable: !hasDesirabilityData,
  }

  // 8. historicalDepth
  const recordsWithYear = userRecords.filter(row => {
    const r = getRecord(row)
    return r?.year && r.year > 1900
  })
  const historicCount = recordsWithYear.filter(row => {
    const r = getRecord(row)
    return r?.year && r.year < 1975
  }).length
  const historicPct = recordsWithYear.length > 0 ? (historicCount / recordsWithYear.length) * 100 : 0

  const decadeCounts = new Map<number, number>()
  for (const row of recordsWithYear) {
    const r = getRecord(row)
    if (r?.year) {
      const decade = Math.floor(r.year / 10) * 10
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1)
    }
  }
  const modalDecadeEntry = [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const modalDecade = modalDecadeEntry?.[0] ?? null

  const DECADE_SCORES: Record<number, number> = {
    1920: 100, 1930: 100, 1940: 100, 1950: 100, 1960: 100,
    1970: 80, 1980: 60, 1990: 40, 2000: 20, 2010: 5, 2020: 5,
  }
  const depthScore = modalDecade != null
    ? (DECADE_SCORES[modalDecade] ?? (modalDecade < 1950 ? 100 : 5))
    : 0
  const historicalDepth: ComputedSignals['historicalDepth'] = {
    score: clamp(depthScore),
    label: depthScore > 70 ? 'Historian' : depthScore >= 40 ? 'Bridge' : 'Contemporary',
    modalDecade,
    subtext: modalDecade ? `Modal decade: ${modalDecade}s` : 'No year data',
  }

  // 9. acquisitionRhythm — uses only real date_added values (Discogs collection-add
  // date per record). Excludes created_at fallback entirely: created_at is rekōdo's
  // row-insert timestamp and causes every bulk-synced record to land in the same
  // week, producing a false "Binge" spike. Groups by year (not week) and uses the
  // coefficient of variation to measure how evenly spread the buying is over time.
  const datedRecords = userRecords
    .filter(row => row.date_added)
    .map(row => new Date(row.date_added!))

  let rhythmResult: ComputedSignals['acquisitionRhythm']
  if (datedRecords.length < 10) {
    rhythmResult = {
      score: 0,
      label: 'Insufficient data',
      rhythmType: 'insufficient_data',
      stdDev: 0,
      subtext: 'Not enough dated records',
      unavailable: true,
    }
  } else {
    const yearCounts = new Map<number, number>()
    for (const d of datedRecords) {
      const yr = d.getFullYear()
      yearCounts.set(yr, (yearCounts.get(yr) ?? 0) + 1)
    }
    const activeYears = yearCounts.size
    const yearValues = [...yearCounts.values()]
    const mean = yearValues.reduce((a, b) => a + b, 0) / yearValues.length
    const sd = stdDev(yearValues)
    // Coefficient of variation: low = even spread, high = bursty
    const cv = mean > 0 ? sd / mean : 0
    const rhythmType = activeYears >= 4 && cv < 0.8
      ? 'Ritualist'
      : activeYears >= 2 && cv < 1.5
        ? 'Measured'
        : 'Binge'
    rhythmResult = {
      score: clamp(cv * 50),
      label: rhythmType,
      rhythmType,
      stdDev: sd,
      subtext: `${activeYears} active year${activeYears !== 1 ? 's' : ''} · ${rhythmType.toLowerCase()}`,
    }
  }
  const acquisitionRhythm = rhythmResult

  // 10. styleRange
  const allStyles = new Set<string>()
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.styles) {
      for (const s of r.styles) if (s) allStyles.add(s)
    }
  }
  const uniqueStyles = allStyles.size
  const hasStyleData = uniqueStyles > 0
  const styleRange: ComputedSignals['styleRange'] = {
    score: hasStyleData ? clamp(Math.sqrt(uniqueStyles) * 6) : 0,
    label: !hasStyleData ? 'No style data' : uniqueStyles > 100 ? 'Omnivore' : uniqueStyles >= 30 ? 'Broad' : 'Focused',
    uniqueStyles,
    subtext: hasStyleData ? `${uniqueStyles} unique style tags` : 'No style data available',
    unavailable: !hasStyleData,
  }

  // 11. transgressiveIndex
  const NOISE = ['Noise', 'Power Electronics', 'Harsh Noise Wall', 'Japanoise', 'Death Industrial', 'Brutal Noise']
  const EXPERIMENTAL = ['Musique Concrète', 'Electroacoustic', 'Acousmatic', 'Lowercase', 'Drone', 'Sound Art', 'Experimental']
  const PSYCHEDELIC_FRINGE = ['Acid Rock', 'Proto-Punk', 'Cosmic', 'Psych']
  const FREE_JAZZ = ['Free Jazz', 'Free Improvisation', 'Avant-garde Jazz', 'No Wave']
  const FRINGE_FOLK = ['Anti-Folk', 'Freak Folk', 'New Weird America', 'Free Folk']
  const ELECTRONIC_MARGINS = ['Harsh EBM', 'Dark Ambient', 'Martial Industrial', 'Neofolk', 'Power Noise']
  const ALL_CLUSTERS = [NOISE, EXPERIMENTAL, PSYCHEDELIC_FRINGE, FREE_JAZZ, FRINGE_FOLK, ELECTRONIC_MARGINS]
  const ALL_TRANSGRESSIVE = ALL_CLUSTERS.flat()

  let transgressiveCount = 0
  let clustersHit = 0
  if (hasStyleData) {
    for (const row of userRecords) {
      const r = getRecord(row)
      if (r?.styles) {
        const styleSet = new Set(r.styles)
        if (ALL_TRANSGRESSIVE.some(t => styleSet.has(t))) transgressiveCount++
      }
    }
    for (const cluster of ALL_CLUSTERS) {
      if ([...allStyles].some(s => cluster.includes(s))) clustersHit++
    }
  }

  const transgressivePct = totalRecords > 0 && hasStyleData ? (transgressiveCount / totalRecords) * 100 : 0
  const transgressiveScore = hasStyleData
    ? clamp((transgressivePct * 0.6) + ((clustersHit / 6) * 100 * 0.4))
    : 0
  const transgressiveIndex: ComputedSignals['transgressiveIndex'] = {
    score: transgressiveScore,
    label: !hasStyleData ? 'No style data' : transgressiveScore > 50 ? 'Anti-canonical' : transgressiveScore >= 25 ? 'Adventurous' : 'Conventional',
    subtext: hasStyleData ? `${transgressiveCount} experimental records` : 'No style data available',
    unavailable: !hasStyleData,
  }

  // 12. aspirationRatio
  const aspirationRatioVal = totalRecords > 0 ? wantlistCount / totalRecords : 0
  const aspirationScore = clamp(aspirationRatioVal * 100)
  const aspirationRatio: ComputedSignals['aspirationRatio'] = {
    score: aspirationScore,
    label: wantlistCount === 0 ? 'Not measured' : aspirationRatioVal > 0.5 ? 'Active Seeker' : aspirationRatioVal >= 0.2 ? 'Selective' : 'Content',
    ratio: aspirationRatioVal,
    subtext: `${wantlistCount} on wantlist vs ${totalRecords} owned`,
    unavailable: wantlistCount === 0,
  }

  // 13. curatorialReach
  let curatorialReach: ComputedSignals['curatorialReach']
  if (lists.length === 0) {
    curatorialReach = {
      score: 0,
      label: 'No lists yet',
      subtext: 'Create lists to unlock',
      unavailable: true,
    }
  } else {
    const genreDist = new Map<string, number>()
    for (const row of userRecords) {
      const r = getRecord(row)
      if (r?.genre) genreDist.set(r.genre, (genreDist.get(r.genre) ?? 0) + 1)
    }
    const listGenreDist = new Map<string, number>()
    for (const item of listItems) {
      const r = item.records
      if (r?.genre) listGenreDist.set(r.genre, (listGenreDist.get(r.genre) ?? 0) + 1)
    }

    const topCollectionGenre = [...genreDist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const topListGenre = [...listGenreDist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const editorial = topCollectionGenre !== topListGenre
      ? Math.min(70 + lists.length * 5, 100)
      : Math.min(30 + lists.length * 3, 60)
    const listsPerRecord = totalRecords > 0 ? lists.length / (totalRecords / 50) : 0
    const cScore = clamp((editorial * 0.7) + (Math.min(listsPerRecord * 20, 30)))

    curatorialReach = {
      score: cScore,
      label: cScore > 60 ? 'Edge Curator' : cScore >= 30 ? 'Centre Curator' : 'Non-curator',
      subtext: `${lists.length} list${lists.length === 1 ? '' : 's'} created`,
    }
  }

  // 14. digitalDivergence
  let digitalDivergence: ComputedSignals['digitalDivergence']
  if (digitalImports.length === 0) {
    digitalDivergence = {
      score: 0,
      label: 'No Bandcamp data',
      digitalOnlyArtists: [],
      subtext: 'Import Bandcamp to unlock',
      unavailable: true,
    }
  } else {
    const vinylArtists = new Set(
      userRecords.map(row => getRecord(row)?.artist).filter(Boolean) as string[]
    )
    const digitalArtists = new Set(
      digitalImports.map((d: { artist: string }) => d.artist).filter(Boolean)
    )
    const overlap = [...digitalArtists].filter(a => vinylArtists.has(a))
    const convergence = digitalArtists.size > 0 ? (overlap.length / digitalArtists.size) * 100 : 0
    const divergence = 100 - convergence

    const digitalOnlyArtists = [...digitalArtists]
      .filter(a => !vinylArtists.has(a))
      .slice(0, 3)

    digitalDivergence = {
      score: clamp(divergence),
      label: divergence > 60 ? 'Two Worlds' : divergence >= 30 ? 'Overlapping' : 'Aligned',
      digitalOnlyArtists,
      subtext: digitalOnlyArtists.length > 0
        ? `Digital only: ${digitalOnlyArtists.join(', ')}`
        : `${Math.round(convergence)}% overlap with vinyl`,
    }
  }

  // 15. emotionalRange — breadth of user-applied feeling tags (collection's "Feeling" attribute).
  // Entirely optional per record, so most collections will have zero tagged — unavailable
  // (score 0) in that case, same pattern as trophyRatio/styleRange above.
  const feelingCounts = new Map<string, number>()
  for (const row of userRecords) {
    if (row.feeling) feelingCounts.set(row.feeling, (feelingCounts.get(row.feeling) ?? 0) + 1)
  }
  const taggedCount = [...feelingCounts.values()].reduce((a, b) => a + b, 0)
  const uniqueFeelings = feelingCounts.size
  const hasFeelingData = taggedCount > 0
  const emotionalRange: ComputedSignals['emotionalRange'] = {
    score: hasFeelingData ? clamp(uniqueFeelings * 8) : 0,
    label: !hasFeelingData ? 'No feeling data' : uniqueFeelings > 7 ? 'Full Spectrum' : uniqueFeelings >= 4 ? 'Varied' : 'Focused',
    uniqueFeelings,
    taggedCount,
    subtext: hasFeelingData ? `${taggedCount} records tagged across ${uniqueFeelings} feelings` : 'Tag records with a feeling to unlock',
    unavailable: !hasFeelingData,
  }

  // 16. canonObscurity — average community_have/want ratio across collection,
  // inverted so that obscure (low ownership) = high score.
  // Mirrors Insights' Canon ↔ Obscure Taste Profile dimension.
  const haveWantRatios: number[] = []
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.community_have != null && r?.community_want != null && r.community_want > 0) {
      haveWantRatios.push(r.community_have / r.community_want)
    }
  }
  const hasCanonData = haveWantRatios.length > 0
  const avgHaveWant = hasCanonData
    ? haveWantRatios.reduce((a, b) => a + b, 0) / haveWantRatios.length
    : 0
  const canonScore = hasCanonData ? clamp(100 - (Math.min(avgHaveWant, 15) / 15) * 100) : 0
  const canonObscurity: ComputedSignals['canonObscurity'] = {
    score: canonScore,
    label: !hasCanonData ? 'No data' : canonScore > 66 ? 'Obscurist' : canonScore >= 33 ? 'Mixed' : 'Canonical',
    subtext: hasCanonData ? 'Based on community ownership data' : 'Sync collection to unlock',
    unavailable: !hasCanonData,
  }

  // 17. artistConcentration — % of owned artists with 3+ records (Broad ↔ Completist).
  // Mirrors Insights' Completist axis.
  const artistCountMap = new Map<string, number>()
  for (const row of userRecords) {
    const r = getRecord(row)
    if (r?.artist) artistCountMap.set(r.artist, (artistCountMap.get(r.artist) ?? 0) + 1)
  }
  const totalArtists = artistCountMap.size
  const completistArtists = [...artistCountMap.values()].filter(c => c >= 3).length
  const completistPct = totalArtists > 0 ? (completistArtists / totalArtists) * 100 : 0
  const artistConcentration: ComputedSignals['artistConcentration'] = {
    score: clamp(completistPct),
    label: completistPct > 30 ? 'Completist' : completistPct >= 10 ? 'Selective depth' : 'Wide-ranging',
    subtext: `${completistArtists} of ${totalArtists} artists with 3+ records`,
  }

  // 18. listeningIntensity — Spotify play_count is primary when available; falls back
  // to dig_history count as an engagement proxy (someone actively digging is actively
  // listening) since most users haven't connected Spotify yet.
  let totalPlays = 0
  let playedCount = 0
  for (const row of userRecords) {
    const plays = row.play_count ?? 0
    if (plays > 0) { playedCount++; totalPlays += plays }
  }
  const hasSpotifyData = totalPlays > 0
  const playedRatio = totalRecords > 0 ? (playedCount / totalRecords) * 100 : 0
  const avgPlaysPerRecord = totalRecords > 0 ? totalPlays / totalRecords : 0
  const spotifyScore = clamp(playedRatio * 0.5 + Math.min(avgPlaysPerRecord * 5, 50))
  // Dig history proxy: 40 digs ≈ max engagement; sqrt curve so early digs count more.
  const digProxyScore = clamp(Math.sqrt(digHistoryCount) * 14)
  const hasListeningData = hasSpotifyData || digHistoryCount > 0
  const intensityScore = hasSpotifyData ? spotifyScore : digProxyScore
  const listeningIntensity: ComputedSignals['listeningIntensity'] = {
    score: hasListeningData ? intensityScore : 0,
    label: !hasListeningData
      ? 'No listening data'
      : intensityScore > 60 ? 'Deep listener' : intensityScore >= 30 ? 'Regular listener' : 'Collector-first',
    subtext: hasSpotifyData
      ? `${totalPlays} total plays across ${playedCount} records`
      : digHistoryCount > 0
        ? `${digHistoryCount} dig session${digHistoryCount !== 1 ? 's' : ''} (engagement proxy)`
        : 'Connect Spotify or use Dig to unlock',
    unavailable: !hasListeningData,
  }

  // ── ASSEMBLE SIGNALS ────────────────────────────────────────────────────────
  const signals: ComputedSignals = {
    labelLoyalty,
    conditionStandard,
    formatFidelity,
    sonicCoherence,
    geographicRange,
    pressingOriginDiversity,
    trophyRatio,
    historicalDepth,
    acquisitionRhythm,
    styleRange,
    transgressiveIndex,
    aspirationRatio,
    curatorialReach,
    digitalDivergence,
    emotionalRange,
    canonObscurity,
    artistConcentration,
    listeningIntensity,
  }

  // ── ARCHETYPE SCORING ────────────────────────────────────────────────────────
  const s = signals
  // Unavailable signals return score=0, but 0 isn't neutral — inverted terms like
  // (100 - listeningIntensity) would award max points to users with no Spotify data.
  // Use 50 (midpoint) for any signal marked unavailable so missing data is genuinely neutral.
  function sig(signal: SignalResult): number {
    return signal.unavailable ? 50 : signal.score
  }
  const scores: Record<string, number> = {
    keeper: clamp(
      sig(s.labelLoyalty) * 0.25 +
      sig(s.conditionStandard) * 0.10 +
      sig(s.sonicCoherence) * 0.10 +
      sig(s.historicalDepth) * 0.10 +
      sig(s.formatFidelity) * 0.15 +
      (100 - sig(s.acquisitionRhythm)) * 0.10 +
      sig(s.artistConcentration) * 0.20
    ),
    seeker: clamp(
      sig(s.aspirationRatio) * 0.10 +
      sig(s.geographicRange) * 0.20 +
      (s.digitalDivergence.unavailable ? 0 : s.digitalDivergence.score) * 0.15 +
      sig(s.styleRange) * 0.20 +
      (100 - sig(s.labelLoyalty)) * 0.10 +
      sig(s.pressingOriginDiversity) * 0.05 +
      (100 - sig(s.artistConcentration)) * 0.10 +
      sig(s.canonObscurity) * 0.10
    ),
    scholar: clamp(
      sig(s.styleRange) * 0.15 +
      sig(s.historicalDepth) * 0.20 +
      sig(s.sonicCoherence) * 0.10 +
      sig(s.geographicRange) * 0.15 +
      sig(s.conditionStandard) * 0.05 +
      sig(s.pressingOriginDiversity) * 0.15 +
      (100 - sig(s.canonObscurity)) * 0.10 +
      sig(s.artistConcentration) * 0.10
    ),
    ritualist: clamp(
      sig(s.conditionStandard) * 0.20 +
      (100 - sig(s.acquisitionRhythm)) * 0.15 +
      sig(s.sonicCoherence) * 0.30 +
      (100 - sig(s.aspirationRatio)) * 0.15 +
      sig(s.listeningIntensity) * 0.20
    ),
    hunter: clamp(
      sig(s.conditionStandard) * 0.30 +
      sig(s.aspirationRatio) * 0.25 +
      sig(s.pressingOriginDiversity) * 0.20 +
      sig(s.trophyRatio) * 0.10 +
      sig(s.acquisitionRhythm) * 0.10 +
      (100 - sig(s.listeningIntensity)) * 0.05
    ),
    lover: clamp(
      sig(s.acquisitionRhythm) * 0.20 +
      sig(s.artistConcentration) * 0.15 +
      sig(s.aspirationRatio) * 0.10 +
      (100 - sig(s.labelLoyalty)) * 0.15 +
      sig(s.styleRange) * 0.10 +
      sig(s.emotionalRange) * 0.15 +
      sig(s.listeningIntensity) * 0.15
    ),
    alchemist: clamp(
      sig(s.curatorialReach) * 0.15 +
      sig(s.styleRange) * 0.20 +
      sig(s.digitalDivergence) * 0.15 +
      sig(s.geographicRange) * 0.15 +
      (100 - sig(s.sonicCoherence)) * 0.15 +
      sig(s.transgressiveIndex) * 0.10 +
      sig(s.canonObscurity) * 0.10
    ),
    pilgrim: clamp(
      sig(s.pressingOriginDiversity) * 0.35 +
      sig(s.geographicRange) * 0.25 +
      sig(s.canonObscurity) * 0.15 +
      sig(s.historicalDepth) * 0.15 +
      (100 - sig(s.labelLoyalty)) * 0.10
    ),
    ruler: clamp(
      sig(s.labelLoyalty) * 0.30 +
      (100 - sig(s.styleRange)) * 0.25 +
      sig(s.conditionStandard) * 0.10 +
      sig(s.historicalDepth) * 0.10 +
      sig(s.sonicCoherence) * 0.10 +
      sig(s.artistConcentration) * 0.15
    ),
    outlaw: clamp(
      sig(s.transgressiveIndex) * 0.35 +
      sig(s.canonObscurity) * 0.25 +
      (100 - sig(s.labelLoyalty)) * 0.15 +
      sig(s.styleRange) * 0.15 +
      sig(s.geographicRange) * 0.10
    ),
    caregiver: clamp(
      sig(s.curatorialReach) * 0.15 +
      sig(s.styleRange) * 0.20 +
      sig(s.digitalDivergence) * 0.15 +
      sig(s.listeningIntensity) * 0.20 +
      sig(s.geographicRange) * 0.10 +
      (100 - sig(s.sonicCoherence)) * 0.10 +
      sig(s.artistConcentration) * 0.10
    ),
  }

  // Star sign is a self-reported, low-weight prior — nudges two thematically-aligned
  // archetypes, not a substitute for collection signals.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('star_sign')
    .eq('id', userId)
    .maybeSingle()
  const starSign = profileRow?.star_sign as StarSign | null | undefined
  const nudgeTargets = starSign ? STAR_SIGN_ARCHETYPE_NUDGE[starSign] : null
  if (nudgeTargets) {
    for (const id of nudgeTargets) {
      if (id in scores) scores[id] = clamp(scores[id] + STAR_SIGN_NUDGE_AMOUNT)
    }
  }

  const sortedEntries = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const primary = sortedEntries[0][0]
  const primaryScore = sortedEntries[0][1]
  const secondaryEntry = sortedEntries[1]
  const secondary = secondaryEntry[1] >= 40 ? secondaryEntry[0] : null
  const secondaryScore = secondaryEntry[1]
  // Shadow = the least-developed archetype (lowest score), excluding primary and secondary.
  // This aligns with Jung: the shadow is what you most suppress, not a fixed thematic opposite.
  const shadow = sortedEntries
    .filter(([id]) => id !== primary && id !== (secondary ?? ""))
    .at(-1)?.[0] ?? "keeper"
  const shadowScore = scores[shadow] ?? 0

  return {
    scores,
    primary,
    primaryScore,
    secondary,
    secondaryScore,
    shadow,
    shadowScore,
    namedPairing: secondary ? getNamedPairing(primary, secondary) : null,
    signals,
    recordCount: totalRecords,
    generatedAt: new Date().toISOString(),
  }
}
