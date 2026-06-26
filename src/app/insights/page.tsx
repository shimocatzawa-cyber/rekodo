import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import InsightsClient, { type InsightsProps } from "@/components/insights/InsightsClient";
import { getDesirabilityTier, type DesirabilityTier } from "@/lib/desirability";
import { selectDailyPick, dailyPickBlurb } from "@/lib/dailyPick";
import { seededRandom, dayKey } from "@/lib/dailyRotation";

export const metadata: Metadata = {
  title: "Insights",
  description: "Your music taste mapped across genres, decades, labels, and pressing origins.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("username, display_name, avatar_url, country_code, collection_value_low, collection_value_med, collection_value_high, collection_value_currency, is_supporter, role")
    .eq("id", user.id)
    .maybeSingle() as {
      data: {
        username?: string | null;
        display_name?: string | null;
        avatar_url?: string | null;
        country_code?: string | null;
        collection_value_low?: number | null;
        collection_value_med?: number | null;
        collection_value_high?: number | null;
        collection_value_currency?: string | null;
        is_supporter?: boolean | null;
        role?: string | null;
      } | null;
      error: unknown;
    };

  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const rawUsername  = profile?.username ?? null;
  const username     = (rawUsername && rawUsername !== autoGen)
    ? rawUsername
    : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;

  const isSupporter = !!(profile?.is_supporter || profile?.role === "admin");

  // ── Currency ───────────────────────────────────────────────────────────────
  const COUNTRY_CURRENCY: Record<string, string> = {
    AU: "AUD", US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD", JP: "JPY",
    DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
    AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SE: "SEK",
    NO: "NOK", DK: "DKK", CH: "CHF", BR: "BRL", MX: "MXN", IN: "INR",
    CN: "CNY", KR: "KRW", SG: "SGD", HK: "HKD", ZA: "ZAR",
  };
  const countryCode  = profile?.country_code?.toUpperCase() ?? null;
  const userCurrency = countryCode ? (COUNTRY_CURRENCY[countryCode] ?? "USD") : "USD";

  let usdToUser = 1.0;
  if (userCurrency !== "USD") {
    try {
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
      if (rateRes.ok) {
        const rateData = await rateRes.json() as { rates?: Record<string, number> };
        usdToUser = rateData.rates?.[userCurrency] ?? 1.0;
      }
    } catch { /* fall back to 1.0 */ }
  }

  const convertPrice = (price: number | null, fromCurrency: string | null): number | null => {
    if (price == null || price <= 0) return null;
    const from = (fromCurrency ?? "USD").toUpperCase();
    if (from === userCurrency) return price;
    if (from === "USD") return price * usdToUser;
    return price;
  };

  // ── Fetch user_records (paginated) ─────────────────────────────────────────
  type LinkRow = {
    record_id:        string;
    price_low:        number | null;
    price_median:     number | null;
    price_high:       number | null;
    price_currency:   string | null;
    media_condition:  string | null;
    sleeve_condition: string | null;
    date_added:       string | null;
    last_played_at:   string | null;
    play_count:       number;
    is_essential:     boolean;
    feeling:          string | null;
  };
  const allLinks: LinkRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("user_records")
      .select("record_id, price_low, price_median, price_high, price_currency, media_condition, sleeve_condition, date_added, last_played_at, play_count, is_essential, feeling")
      .eq("user_id", user.id)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allLinks.push(...(data as unknown as LinkRow[]));
    if (data.length < PAGE) break;
  }

  const recordIds = allLinks.map((l) => l.record_id);

  // ── Fetch records (batched) ────────────────────────────────────────────────
  type RecordRow = {
    id: string; artist: string; album: string;
    year: number | null;
    genre: string | null; styles: string[] | null;
    label: string | null; country: string | null; format: string | null;
    vinyl_colour: string | null;
    producers: string[] | null;
    cover_url: string | null;
    community_have: number | null; community_want: number | null;
    community_num_for_sale: number | null;
    edition_size: number | null;
  };
  const recordsMap = new Map<string, RecordRow>();
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("records")
      .select("id, artist, album, year, genre, styles, label, country, format, vinyl_colour, producers, cover_url, community_have, community_want, community_num_for_sale, edition_size")
      .in("id", recordIds.slice(i, i + BATCH));
    if (!error) for (const r of data ?? []) recordsMap.set(r.id, r as RecordRow);
  }

  // ── Daily pick ──────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const userTimezone = cookieStore.get("tz")?.value
    ? decodeURIComponent(cookieStore.get("tz")!.value)
    : undefined;
  const pickNow = new Date();
  const pickResult = selectDailyPick(allLinks, user.id, pickNow, userTimezone);
  const dailyPick: InsightsProps["dailyPick"] = (() => {
    if (!pickResult) return null;
    const rec = recordsMap.get(pickResult.record_id);
    if (!rec) return null;
    const link = allLinks.find((l) => l.record_id === pickResult.record_id);
    return {
      artist:    rec.artist,
      album:     rec.album,
      coverUrl:  rec.cover_url ?? null,
      feeling:   pickResult.feeling,
      blurb:     dailyPickBlurb(pickResult.feeling, pickResult.daysSinceLastPlayed),
      label:     rec.label ?? null,
      country:   rec.country ?? null,
      year:      rec.year ?? null,
      genre:     rec.genre ?? null,
      style:     rec.styles?.length ? rec.styles.join(", ") : null,
      format:    rec.format ?? null,
      producers: rec.producers?.length ? rec.producers.join(", ") : null,
      playCount: link?.play_count ?? 0,
    };
  })();

  // ── On this day (rotates daily through this month's anniversaries) ─────────
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const onThisDayPool = allLinks
    .map((l) => {
      if (!l.date_added) return null;
      const added = new Date(l.date_added);
      if (isNaN(added.getTime())) return null;
      if (added.getMonth() !== pickNow.getMonth()) return null;
      const yearsAgo = pickNow.getFullYear() - added.getFullYear();
      if (yearsAgo <= 0) return null;
      const rec = recordsMap.get(l.record_id);
      if (!rec) return null;
      return {
        artist: rec.artist, album: rec.album, coverUrl: rec.cover_url ?? null, yearsAgo,
        dateAddedLabel: `${SHORT_MONTHS[added.getMonth()]} ${added.getDate()}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const onThisDay: InsightsProps["onThisDay"] = onThisDayPool.length > 0
    ? onThisDayPool[Math.floor(seededRandom(`onThisDay:${user.id}:${dayKey(pickNow, userTimezone)}`) * onThisDayPool.length)]
    : null;

  // ── Collection value totals ────────────────────────────────────────────────
  // Prefer official Discogs values (stored in profiles after each sync).
  // Fall back to aggregating from user_records if profile values are not yet set.
  const cvCurrency = profile?.collection_value_currency ?? "USD";
  const profileLow  = profile?.collection_value_low  ?? null;
  const profileMed  = profile?.collection_value_med  ?? null;
  const profileHigh = profile?.collection_value_high ?? null;
  const hasProfileValues = profileLow != null && profileLow > 0;

  let totalLow: number, totalMed: number, totalHigh: number;

  if (hasProfileValues) {
    totalLow  = convertPrice(profileLow,  cvCurrency) ?? 0;
    totalMed  = convertPrice(profileMed,  cvCurrency) ?? 0;
    totalHigh = convertPrice(profileHigh, cvCurrency) ?? 0;
  } else {
    // Fallback: aggregate from user_records stored prices
    let aggLow = 0, aggMed = 0;
    for (const link of allLinks) {
      const low = convertPrice(link.price_low,    link.price_currency);
      const med = convertPrice(link.price_median, link.price_currency);
      if (low != null) aggLow += low;
      if (med != null) aggMed += med;
    }
    totalLow  = aggLow;
    totalMed  = aggMed;
    totalHigh = 0;
  }

  // ── Top 5 records by price_median ─────────────────────────────────────────
  const topRecordsByValue: InsightsProps["topRecordsByValue"] = allLinks
    .filter((l) => (l.price_median ?? l.price_low ?? 0) > 0)
    .map((l) => {
      const rec = recordsMap.get(l.record_id);
      if (!rec) return null;
      // Use price_low as fallback when median is absent (single listing = no median on Discogs)
      const effectivePrice = l.price_median ?? l.price_low;
      return {
        artist:       rec.artist,
        album:        rec.album,
        coverUrl:     rec.cover_url ?? null,
        price_median: convertPrice(effectivePrice,  l.price_currency) ?? 0,
        price_low:    convertPrice(l.price_low,     l.price_currency) ?? 0,
        price_high:   convertPrice(l.price_high,    l.price_currency) ?? 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.price_median - a.price_median)
    .slice(0, 5);

  // ── Condition breakdowns ───────────────────────────────────────────────────
  const GRADE_ORDER = [
    "Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)", "Very Good (VG)",
    "Good Plus (G+)", "Good (G)", "Fair (F)", "Poor (P)",
  ];
  function buildConditionBreakdown(counts: Map<string, number>): InsightsProps["mediaConditionBreakdown"] {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const result: { grade: string; count: number; pct: number }[] = [];
    for (const grade of GRADE_ORDER) {
      const count = counts.get(grade) ?? 0;
      if (count > 0) result.push({ grade, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 });
    }
    for (const [grade, count] of counts) {
      if (!GRADE_ORDER.includes(grade)) {
        result.push({ grade, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 });
      }
    }
    return result;
  }
  const mediaCounts  = new Map<string, number>();
  const sleeveCounts = new Map<string, number>();
  for (const link of allLinks) {
    const mc = link.media_condition?.trim()  || "Not graded";
    const sc = link.sleeve_condition?.trim() || "Not graded";
    mediaCounts.set(mc,  (mediaCounts.get(mc)  ?? 0) + 1);
    sleeveCounts.set(sc, (sleeveCounts.get(sc) ?? 0) + 1);
  }
  const mediaConditionBreakdown  = buildConditionBreakdown(mediaCounts);
  const sleeveConditionBreakdown = buildConditionBreakdown(sleeveCounts);

  // ── Collection lifespan (date added) ────────────────────────────────────────
  // Bucket by calendar month when the collection spans a few years (so the
  // monthly bar count stays readable); fall back to yearly buckets once the
  // span gets too wide for monthly bars to be legible.
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const addedDates = allLinks
    .map((l) => l.date_added)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()));

  const addedYears     = addedDates.map((d) => d.getFullYear());
  const lifespanByYear = addedYears.length > 0
    ? Math.max(...addedYears) - Math.min(...addedYears) + 1 > 3
    : false;

  const lifespanCounts = new Map<string, number>();
  for (const d of addedDates) {
    const key = lifespanByYear
      ? String(d.getFullYear())
      : `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    lifespanCounts.set(key, (lifespanCounts.get(key) ?? 0) + 1);
  }
  const collectionLifespan = [...lifespanCounts.entries()]
    .map(([period, count]) => ({
      period,
      count,
      sortKey: lifespanByYear
        ? Number(period)
        : (() => {
            const [mon, yr] = period.split(" ");
            return Number(yr) * 12 + MONTH_NAMES.indexOf(mon);
          })(),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ period, count }) => ({ period, Added: count }));

  // ── Collection by month (rolling last 12 months) ────────────────────────────
  const now = new Date();
  const rolling12MonthCounts = new Map<string, number>();
  for (const d of addedDates) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    rolling12MonthCounts.set(key, (rolling12MonthCounts.get(key) ?? 0) + 1);
  }
  const collectionByMonth: { period: string; Added: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    collectionByMonth.push({
      period: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      Added:  rolling12MonthCounts.get(key) ?? 0,
    });
  }

  // ── Genre analysis ─────────────────────────────────────────────────────────
  const genreCounts = new Map<string, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec   = recordsMap.get(link.record_id);
    const genre = rec?.genre ?? "Unknown";
    const val   = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr  = genreCounts.get(genre) ?? { count: 0, valueSum: 0 };
    genreCounts.set(genre, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const totalRecords  = allLinks.length;
  const genreBreakdown: InsightsProps["genreBreakdown"] = [...genreCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([genre, { count, valueSum }]) => ({
      genre,
      count,
      valueSum,
      pct: totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0,
    }));

  // ── Essentials wall (user-tagged "Essential" records only) ────────────────
  const essentialLinks = allLinks
    .filter((l) => l.is_essential)
    .sort((a, b) => new Date(b.date_added ?? 0).getTime() - new Date(a.date_added ?? 0).getTime());

  const essentialGenreCounts = new Map<string, number>();
  for (const l of essentialLinks) {
    const genre = recordsMap.get(l.record_id)?.genre ?? "Unknown";
    essentialGenreCounts.set(genre, (essentialGenreCounts.get(genre) ?? 0) + 1);
  }
  const essentialsTotal = essentialLinks.length;
  let essentialsPrimaryGenre: string | null = null;
  let essentialsPrimaryGenrePct = 0;
  if (essentialGenreCounts.size > 0) {
    const [topGenre, topCount] = [...essentialGenreCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    essentialsPrimaryGenre = topGenre;
    essentialsPrimaryGenrePct = Math.round((topCount / essentialsTotal) * 100);
  }
  const essentialsCovers: InsightsProps["essentials"]["covers"] = essentialLinks
    .map((l) => {
      const rec = recordsMap.get(l.record_id);
      if (!rec) return null;
      return { artist: rec.artist, album: rec.album, coverUrl: rec.cover_url ?? null };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const essentials: InsightsProps["essentials"] = {
    total:           essentialsTotal,
    primaryGenre:    essentialsPrimaryGenre,
    primaryGenrePct: essentialsPrimaryGenrePct,
    covers:          essentialsCovers,
  };

  // ── Feeling breakdown (user-tagged "how does this make you feel") ─────────
  const feelingCounts = new Map<string, number>();
  for (const l of allLinks) {
    if (l.feeling) feelingCounts.set(l.feeling, (feelingCounts.get(l.feeling) ?? 0) + 1);
  }
  const feelingsTaggedTotal = [...feelingCounts.values()].reduce((a, b) => a + b, 0);
  const feelingBreakdown: InsightsProps["feelingBreakdown"] = [...feelingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([feeling, count]) => ({
      feeling,
      count,
      pct: feelingsTaggedTotal > 0 ? Math.round((count / feelingsTaggedTotal) * 100) : 0,
    }));

  // ── Style analysis ─────────────────────────────────────────────────────────
  const styleCounts = new Map<string, number>();
  let hasStyles = false;
  for (const link of allLinks) {
    const rec = recordsMap.get(link.record_id);
    if (rec?.styles?.length) {
      hasStyles = true;
      for (const style of rec.styles) {
        const s = style?.trim();
        if (s) styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1);
      }
    }
  }
  const totalStyleEntries = [...styleCounts.values()].reduce((a, b) => a + b, 0);
  const styleBreakdown: InsightsProps["styleBreakdown"] = [...styleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([style, count]) => ({
      style,
      count,
      pct: totalStyleEntries > 0 ? Math.round((count / totalStyleEntries) * 100) : 0,
    }));

  // ── Geographic DNA ─────────────────────────────────────────────────────────
  const countryCounts = new Map<string, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec     = recordsMap.get(link.record_id);
    const country = rec?.country?.trim() || null;
    if (!country) continue; // skip records without country data
    const val  = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr = countryCounts.get(country) ?? { count: 0, valueSum: 0 };
    countryCounts.set(country, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const countryTotal = [...countryCounts.values()].reduce((a, b) => a + b.count, 0);
  const countryBreakdown: InsightsProps["countryBreakdown"] = [...countryCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([country, { count, valueSum }]) => ({
      country, count, valueSum,
      pct: countryTotal > 0 ? Math.round((count / countryTotal) * 100) : 0,
    }));

  // ── Desirability breakdown ────────────────────────────────────────────────
  const TIER_ORDER: DesirabilityTier[] = ["rare", "cult", "widely-loved", "in-demand"];
  const desirabilityGroups = new Map<DesirabilityTier, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec  = recordsMap.get(link.record_id);
    if (!rec) continue;
    const tier = getDesirabilityTier(
      rec.community_have,
      rec.community_want,
      link.price_low ?? null,   // raw USD — desirability thresholds are USD-denominated
      rec.community_num_for_sale,
      rec.edition_size,
    );
    if (!tier) continue;
    const val  = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr = desirabilityGroups.get(tier) ?? { count: 0, valueSum: 0 };
    desirabilityGroups.set(tier, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const desirabilityBreakdown: InsightsProps["desirabilityBreakdown"] = TIER_ORDER
    .filter((t) => desirabilityGroups.has(t))
    .map((t) => {
      const { count, valueSum } = desirabilityGroups.get(t)!;
      return { tier: t, count, valueSum };
    });

  // ── Top Artists ───────────────────────────────────────────────────────────
  const artistCounts = new Map<string, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec    = recordsMap.get(link.record_id);
    const artist = rec?.artist?.trim();
    if (!artist || artist === "Unknown" || artist === "Various") continue;
    const val  = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr = artistCounts.get(artist) ?? { count: 0, valueSum: 0 };
    artistCounts.set(artist, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const topArtists: InsightsProps["topArtists"] = [...artistCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([artist, { count, valueSum }]) => ({ artist, count, valueSum }));

  // ── Label Obsession ────────────────────────────────────────────────────────
  const labelCounts = new Map<string, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec   = recordsMap.get(link.record_id);
    const label = rec?.label?.trim();
    if (!label) continue;
    const val  = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr = labelCounts.get(label) ?? { count: 0, valueSum: 0 };
    labelCounts.set(label, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const topLabels: InsightsProps["topLabels"] = [...labelCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([label, { count, valueSum }]) => ({ label, count, valueSum }));

  // ── Top Producers ─────────────────────────────────────────────────────────
  const producerCounts = new Map<string, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec = recordsMap.get(link.record_id);
    if (!rec?.producers?.length) continue;
    const val = convertPrice(link.price_median, link.price_currency) ?? 0;
    for (const producer of rec.producers) {
      const p = producer?.trim();
      if (!p) continue;
      const curr = producerCounts.get(p) ?? { count: 0, valueSum: 0 };
      producerCounts.set(p, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
    }
  }
  const topProducers: InsightsProps["topProducers"] = [...producerCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([producer, { count, valueSum }]) => ({ producer, count, valueSum }));

  // ── Format breakdown ──────────────────────────────────────────────────────
  const formatData = new Map<string, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const fmt = recordsMap.get(link.record_id)?.format;
    if (!fmt) continue;
    const val  = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr = formatData.get(fmt) ?? { count: 0, valueSum: 0 };
    formatData.set(fmt, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const formatBreakdown = [...formatData.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([format, { count, valueSum }]) => ({ format, count, valueSum }));

  const topFormat = formatBreakdown.length > 0
    ? { name: formatBreakdown[0].format, count: formatBreakdown[0].count }
    : null;

  // ── Vinyl colour breakdown ────────────────────────────────────────────────
  // The vinyl_colour field is sourced from Discogs' free-text format notes, so
  // it mixes true colours ("Red", "Clear, 180g, Gatefold") with non-colour
  // pressing/mastering attributes ("Remastered", "180g", "White Label") and is
  // frequently empty. Resolve each value down to a single canonical colour
  // name (picking whichever colour word appears earliest in the string), and
  // treat "Label" mentions (White Label, Brown Label, ...) — a paper-label
  // convention, not a vinyl colour — as no colour found. Discogs only notes a
  // colour when it deviates from the default, so anything that resolves to no
  // colour (empty field, or a non-colour attribute like "Gatefold") is black.
  const COLOUR_CANON: [RegExp, string][] = [
    [/\bblack\b/i, "Black"], [/\bwhite\b/i, "White"], [/\bred\b/i, "Red"],
    [/\bblue\b/i, "Blue"], [/\bgreen\b/i, "Green"], [/\byellow\b/i, "Yellow"],
    [/\borange\b/i, "Orange"], [/\bpurple\b/i, "Purple"], [/\bpink\b/i, "Pink"],
    [/\bsilver\b/i, "Silver"], [/\bgold\b/i, "Gold"], [/\bgrey\b/i, "Grey"],
    [/\bgray\b/i, "Grey"], [/\bbrown\b/i, "Brown"], [/\bmaroon\b/i, "Maroon"],
    [/\bturquoise\b/i, "Turquoise"], [/\bteal\b/i, "Teal"], [/\bbone\b/i, "Bone"],
    [/\bcream\b/i, "Cream"], [/\btan\b/i, "Tan"], [/\bmagenta\b/i, "Magenta"],
    [/\bviolet\b/i, "Violet"], [/\bclear\b/i, "Clear"],
    [/\bpicture disc\b/i, "Picture Disc"], [/\bmarbled?\b/i, "Marbled"],
    [/\bsplatter\b/i, "Splatter"], [/\betched\b/i, "Etched"],
    [/\bcolou?red\b/i, "Multi-Colour"],
  ];
  const resolveColour = (value: string): string | null => {
    if (/\blabel\b/i.test(value)) return null;
    let best: { index: number; name: string } | null = null;
    for (const [re, name] of COLOUR_CANON) {
      const match = re.exec(value);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, name };
      }
    }
    return best?.name ?? null;
  };

  const colourCounts = new Map<string, number>();
  for (const link of allLinks) {
    const value  = recordsMap.get(link.record_id)?.vinyl_colour?.trim();
    const colour = (value ? resolveColour(value) : null) ?? "Black";
    colourCounts.set(colour, (colourCounts.get(colour) ?? 0) + 1);
  }

  const colourTotal = [...colourCounts.values()].reduce((a, b) => a + b, 0);
  const vinylColourBreakdown = [...colourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([colour, count]) => ({
      colour,
      count,
      pct: colourTotal > 0 ? Math.round((count / colourTotal) * 100) : 0,
    }));

  const allYears = [...recordsMap.values()]
    .map((r) => r.year)
    .filter((y): y is number => y != null && y > 0);
  const yearRange = allYears.length > 0
    ? { oldest: allYears.reduce((m, y) => (y < m ? y : m), allYears[0]), newest: allYears.reduce((m, y) => (y > m ? y : m), allYears[0]) }
    : null;
  const mostPopularYear = (() => {
    if (allYears.length === 0) return null;
    const yCounts = new Map<number, number>();
    for (const y of allYears) yCounts.set(y, (yCounts.get(y) ?? 0) + 1);
    return [...yCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  })();

  // ── Spectrum Dimensions (Taste Profile) ────────────────────────────────────

  // 1. Ambient ↔ Abrasive — % of style (or, lacking style data, genre) entries
  // that read as punk/metal/noise. Position is the pct itself (high → right).
  const ABRASIVE_RE = /punk|metal|noise/i;
  let abrasivePosition: number | null = null;
  if (hasStyles && totalStyleEntries > 0) {
    let abrasiveCount = 0;
    for (const [style, count] of styleCounts) if (ABRASIVE_RE.test(style)) abrasiveCount += count;
    abrasivePosition = Math.round((abrasiveCount / totalStyleEntries) * 100);
  } else if (totalRecords > 0) {
    let abrasiveCount = 0;
    for (const [genre, { count }] of genreCounts) if (ABRASIVE_RE.test(genre)) abrasiveCount += count;
    abrasivePosition = Math.round((abrasiveCount / totalRecords) * 100);
  }

  // 2. Canon ↔ Obscure — average Discogs have/want ratio, normalised so a high
  // ratio (commonly owned, canon) sits left and a low ratio (obscure) sits right.
  const rarityRatios: number[] = [];
  for (const link of allLinks) {
    const rec = recordsMap.get(link.record_id);
    if (rec?.community_have != null && rec.community_want != null && rec.community_want > 0) {
      rarityRatios.push(rec.community_have / rec.community_want);
    }
  }
  let rarityPosition: number | null = null;
  if (rarityRatios.length > 0) {
    const avgRatio   = rarityRatios.reduce((a, b) => a + b, 0) / rarityRatios.length;
    const normalised = Math.min(avgRatio, 8) / 8 * 100;
    rarityPosition = Math.round(100 - normalised);
  }

  // 3. Nostalgic ↔ Contemporary — % of collection pressed pre-1980. High
  // pre-1980 share sits left (nostalgic), so the position inverts the pct.
  const recordYears = allLinks
    .map((l) => recordsMap.get(l.record_id)?.year)
    .filter((y): y is number => y != null && y > 0);
  let nostalgicPosition: number | null = null;
  if (recordYears.length > 0) {
    const pre1980Pct = (recordYears.filter((y) => y < 1980).length / recordYears.length) * 100;
    nostalgicPosition = Math.round(100 - pre1980Pct);
  }

  // 4. Broad ↔ Completist — % of distinct artists with 3+ records owned.
  let completistPosition: number | null = null;
  if (artistCounts.size > 0) {
    const completistArtists = [...artistCounts.values()].filter((v) => v.count >= 3).length;
    completistPosition = Math.round((completistArtists / artistCounts.size) * 100);
  }

  // 5. Western ↔ Non-western — % of collection pressed in a non-Western country.
  const NON_WESTERN_COUNTRIES = ["Japan", "JP", "Korea", "Brazil", "Nigeria", "South Africa", "India", "Argentina", "Colombia"];
  let nonWesternPosition: number | null = null;
  if (countryTotal > 0) {
    let nonWesternCount = 0;
    for (const [country, { count }] of countryCounts) {
      if (NON_WESTERN_COUNTRIES.some((nw) => country.toLowerCase().includes(nw.toLowerCase()))) {
        nonWesternCount += count;
      }
    }
    nonWesternPosition = Math.round((nonWesternCount / countryTotal) * 100);
  }

  // 6. Accumulator ↔ Curator — public, non-wantlist lists per 10% of collection.
  const { count: curationListCountRaw } = await supabase
    .from("lists")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("slug", "wantlist");
  const curationListCount = curationListCountRaw ?? 0;
  const curatorPosition = totalRecords > 0
    ? Math.min(100, Math.round(((curationListCount * 10) / totalRecords) * 100))
    : null;

  // 7. Vinyl pure ↔ Format agnostic — vinyl share of (vinyl + digital imports).
  const VINYL_FORMATS = new Set(["LP", "VINYL", "7\"", "10\"", "12\"", "EP"]);
  let vinylCount = 0;
  for (const link of allLinks) {
    const fmt = recordsMap.get(link.record_id)?.format?.toUpperCase().trim();
    if (!fmt || VINYL_FORMATS.has(fmt)) vinylCount++;
  }
  const { count: digitalImportsCountRaw } = await supabase
    .from("digital_imports")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_duplicate", false);
  const digitalImportsCount = digitalImportsCountRaw ?? 0;
  const formatAgnosticPosition = (vinylCount + digitalImportsCount) > 0
    ? Math.round(100 - (vinylCount / (vinylCount + digitalImportsCount)) * 100)
    : null;

  const spectrum: InsightsProps["spectrum"] = {
    abrasivePosition,
    rarityPosition,
    nostalgicPosition,
    completistPosition,
    nonWesternPosition,
    curatorPosition,
    formatAgnosticPosition,
  };

  // ── Listening History (play_count + last_played_at) ──────────────────────
  const playedLinks = allLinks
    .filter((l) => l.play_count > 0 || l.last_played_at != null)
    .sort((a, b) => b.play_count - a.play_count || new Date(b.last_played_at!).getTime() - new Date(a.last_played_at!).getTime());

  const topPlayedRecords: InsightsProps["topPlayedRecords"] = playedLinks
    .slice(0, 5)
    .map((pl) => {
      const rec = recordsMap.get(pl.record_id);
      if (!rec) return null;
      return {
        artist:       rec.artist,
        album:        rec.album,
        coverUrl:     rec.cover_url ?? null,
        lastPlayedAt: pl.last_played_at ?? "",
        playCount:    pl.play_count,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const playedStyleCounts = new Map<string, number>();
  for (const pl of playedLinks) {
    const rec = recordsMap.get(pl.record_id);
    if (!rec) continue;
    if (rec.styles?.length) {
      for (const style of rec.styles) {
        const s = style?.trim();
        if (s) playedStyleCounts.set(s, (playedStyleCounts.get(s) ?? 0) + 1);
      }
    } else if (rec.genre) {
      playedStyleCounts.set(rec.genre, (playedStyleCounts.get(rec.genre) ?? 0) + 1);
    }
  }
  const playedStyleTotal = [...playedStyleCounts.values()].reduce((a, b) => a + b, 0);
  const playedStyleBreakdown: InsightsProps["playedStyleBreakdown"] = [...playedStyleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([style, count]) => ({
      style,
      count,
      pct: playedStyleTotal > 0 ? Math.round((count / playedStyleTotal) * 100) : 0,
    }));

  // ── Usage stats ────────────────────────────────────────────────────────────
  const { data: digRows } = await (supabase as any)
    .from("dig_daily_count")
    .select("mode, count")
    .eq("user_id", user.id) as { data: { mode: string; count: number }[] | null };
  const digByMode = { discover: 0, explore: 0, style: 0 };
  for (const row of digRows ?? []) {
    const m = row.mode ?? "discover";
    if (m === "discover" || m === "explore" || m === "style") {
      digByMode[m as keyof typeof digByMode] += row.count;
    }
  }

  const { count: deepDiveCountRaw } = await (supabase as any)
    .from("deep_dive_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id) as { count: number | null };
  const deepDiveCount = deepDiveCountRaw ?? 0;

  const { data: userListsRaw } = await supabase
    .from("lists")
    .select("id, slug")
    .eq("user_id", user.id);
  const userLists = (userListsRaw ?? []) as { id: string; slug: string | null }[];
  const listsTotal = userLists.filter((l) => l.slug !== "wantlist" && l.slug !== "want-to-buy").length;

  let listLikes = 0;
  if (userLists.length > 0) {
    const { count: likesCount } = await (supabase as any)
      .from("list_likes")
      .select("*", { count: "exact", head: true })
      .in("list_id", userLists.map((l) => l.id)) as { count: number | null };
    listLikes = likesCount ?? 0;
  }

  const usageStats: InsightsProps["usageStats"] = {
    digDiscover: digByMode.discover,
    digExplore:  digByMode.explore,
    digStyle:    digByMode.style,
    deepDiveCount,
    listsTotal,
    listLikes,
  };

  return (
    <InsightsClient
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      currency={userCurrency}
      totalLow={totalLow}
      totalMed={totalMed}
      totalHigh={totalHigh}
      totalRecords={allLinks.length}
      topRecordsByValue={topRecordsByValue}
      mediaConditionBreakdown={mediaConditionBreakdown}
      sleeveConditionBreakdown={sleeveConditionBreakdown}
      genreBreakdown={genreBreakdown}
      styleBreakdown={styleBreakdown}
      hasStyles={hasStyles}
      countryBreakdown={countryBreakdown}
      topLabels={topLabels}
      topProducers={topProducers}
      formatBreakdown={formatBreakdown}
      desirabilityBreakdown={desirabilityBreakdown}
      topArtists={topArtists}
      topFormat={topFormat}
      yearRange={yearRange}
      mostPopularYear={mostPopularYear}
      vinylColourBreakdown={vinylColourBreakdown}
      essentials={essentials}
      feelingBreakdown={feelingBreakdown}
      collectionLifespan={collectionLifespan}
      collectionByMonth={collectionByMonth}
      spectrum={spectrum}
      topPlayedRecords={topPlayedRecords}
      playedStyleBreakdown={playedStyleBreakdown}
      dailyPick={dailyPick}
      onThisDay={onThisDay}
      isSupporter={isSupporter}
      usageStats={usageStats}
    />
  );
}
