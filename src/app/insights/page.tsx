import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InsightsClient, { type InsightsProps } from "@/components/insights/InsightsClient";

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
    genre: string | null; styles: string[] | null;
    label: string | null; country: string | null; format: string | null;
  };
  const recordsMap = new Map<string, RecordRow>();
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("records")
      .select("id, artist, album, genre, styles, label, country, format")
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

  // ── Collection value totals (from Discogs collection value API via profiles) ─
  const cvCurrency = profile?.collection_value_currency ?? "USD";
  const totalLow  = convertPrice(profile?.collection_value_low  ?? null, cvCurrency) ?? 0;
  const totalMed  = convertPrice(profile?.collection_value_med  ?? null, cvCurrency) ?? 0;
  const totalHigh = convertPrice(profile?.collection_value_high ?? null, cvCurrency) ?? 0;

  // ── Top 5 records by price_median ─────────────────────────────────────────
  const topRecordsByValue: InsightsProps["topRecordsByValue"] = allLinks
    .filter((l) => (l.price_median ?? 0) > 0)
    .map((l) => {
      const rec = recordsMap.get(l.record_id);
      if (!rec) return null;
      return {
        artist:       rec.artist,
        album:        rec.album,
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
    const country = rec?.country?.trim() || "Unknown";
    const val     = convertPrice(link.price_median, link.price_currency) ?? 0;
    const curr    = countryCounts.get(country) ?? { count: 0, valueSum: 0 };
    countryCounts.set(country, { count: curr.count + 1, valueSum: curr.valueSum + (val > 0 ? val : 0) });
  }
  const countryBreakdown: InsightsProps["countryBreakdown"] = [...countryCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([country, { count, valueSum }]) => ({ country, count, valueSum }));

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
    .slice(0, 5)
    .map(([label, { count, valueSum }]) => ({ label, count, valueSum }));

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
    />
  );
}
