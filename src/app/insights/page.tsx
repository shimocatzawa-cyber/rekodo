import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InsightsClient, { type InsightsProps } from "@/components/insights/InsightsClient";
import { getDesirabilityTier, type DesirabilityTier } from "@/lib/desirability";

export const metadata: Metadata = {
  title: "Taste Profile",
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, country_code, collection_value_low, collection_value_med, collection_value_high, collection_value_currency")
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
  };
  const allLinks: LinkRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("user_records")
      .select("record_id, price_low, price_median, price_high, price_currency, media_condition, sleeve_condition")
      .eq("user_id", user.id)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allLinks.push(...(data as LinkRow[]));
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
  };
  const recordsMap = new Map<string, RecordRow>();
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("records")
      .select("id, artist, album, year, genre, styles, label, country, format, vinyl_colour, producers, cover_url, community_have, community_want, community_num_for_sale")
      .in("id", recordIds.slice(i, i + BATCH));
    if (!error) for (const r of data ?? []) recordsMap.set(r.id, r as RecordRow);
  }

  // ── Fetch collection_value_snapshots ───────────────────────────────────────
  const { data: snapshotsRaw } = await supabase
    .from("collection_value_snapshots")
    .select("snapshot_at, value_med, currency")
    .eq("user_id", user.id)
    .order("snapshot_at", { ascending: true });

  const snapshots: InsightsProps["snapshots"] = (snapshotsRaw ?? []).map((s) => {
    const raw = s.value_med ?? 0;
    const converted = raw > 0 ? (convertPrice(raw, s.currency) ?? raw) : 0;
    return {
      date: new Date(s.snapshot_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" }),
      "Total Value": Math.round(converted),
    };
  });

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
    .filter((l) => (l.price_median ?? 0) > 0)
    .map((l) => {
      const rec = recordsMap.get(l.record_id);
      if (!rec) return null;
      return {
        artist:       rec.artist,
        album:        rec.album,
        coverUrl:     rec.cover_url ?? null,
        price_median: convertPrice(l.price_median, l.price_currency) ?? 0,
        price_low:    convertPrice(l.price_low,    l.price_currency) ?? 0,
        price_high:   convertPrice(l.price_high,   l.price_currency) ?? 0,
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
  const TIER_ORDER: DesirabilityTier[] = ["holy-grail", "rare", "cult", "widely-loved", "in-demand"];
  const desirabilityGroups = new Map<DesirabilityTier, { count: number; valueSum: number }>();
  for (const link of allLinks) {
    const rec  = recordsMap.get(link.record_id);
    if (!rec) continue;
    const tier = getDesirabilityTier(
      rec.community_have,
      rec.community_want,
      link.price_low ?? null,   // raw USD — desirability thresholds are USD-denominated
      rec.community_num_for_sale,
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
  const colourCounts = new Map<string, number>();
  for (const link of allLinks) {
    const colour = recordsMap.get(link.record_id)?.vinyl_colour?.trim();
    if (colour) colourCounts.set(colour, (colourCounts.get(colour) ?? 0) + 1);
  }
  const colourTotal = [...colourCounts.values()].reduce((a, b) => a + b, 0);
  const vinylColourBreakdown = [...colourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
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
      snapshots={snapshots}
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
    />
  );
}
