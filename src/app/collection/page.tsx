import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CollectionClient from "@/components/collection/CollectionClient";
import { getDesirabilityTier } from "@/lib/desirability";

export const metadata: Metadata = {
  title: "Collection",
  description: "Your vinyl collection.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export type CollectionRecord = {
  id: string;
  discogs_id: string | null;
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  label: string | null;
  format: string | null;
  country: string | null;
  value: number | null;
  price_low:              number | null;
  price_low_usd:          number | null;
  price_median:           number | null;
  price_currency:         string | null;
  media_condition:        string | null;
  sleeve_condition:       string | null;
  community_have:         number | null;
  community_want:         number | null;
  community_num_for_sale: number | null;
  last_played_at:         string | null;
  open_to_offers:         boolean | null;
  is_essential:           boolean | null;
  feeling:                string | null;
};

export type CollectionInsights = {
  topFormat:    { name: string; count: number } | null;
  topGenres:    { genre: string; pct: number }[];
  topArtist:    { name: string; count: number } | null;
  topLabel:     { name: string; count: number } | null;
  yearRange:    { oldest: number; newest: number } | null;
  mostPopularYear: number | null;
  countryCount: number;
  topDecade:    string | null;
  rarestRecord: { artist: string; album: string; price: number; currency: string } | null;
  holyGrailCount: number;
};

type SearchParams = Promise<{
  start_sync?: string;
  oauth_denied?: string;
  oauth_error?: string;
}>;

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, last_synced_at, avatar_url, country_code, collection_value_low, collection_value_med, collection_value_high, collection_value_currency")
    .eq("id", user.id)
    .maybeSingle() as { data: {
      username?: string | null; display_name?: string | null; last_synced_at?: string | null;
      avatar_url?: string | null; country_code?: string | null;
      collection_value_low?: number | null; collection_value_med?: number | null;
      collection_value_high?: number | null; collection_value_currency?: string | null;
    } | null; error: unknown };

  const { data: lastSyncJob } = await supabase
    .from("sync_queue")
    .select("total_records, new_added, completed_at")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const rawUsername  = profile?.username ?? null;
  const username     = (rawUsername && rawUsername !== autoGen)
    ? rawUsername
    : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const lastSyncedAt = profile?.last_synced_at ?? null;
  const avatarUrl    = profile?.avatar_url ?? null;
  const discogsValue = {
    low:      profile?.collection_value_low      ?? null,
    med:      profile?.collection_value_med      ?? null,
    high:     profile?.collection_value_high     ?? null,
    currency: profile?.collection_value_currency ?? "USD",
  };

  // Country code → ISO 4217 currency
  const COUNTRY_CURRENCY: Record<string, string> = {
    AU: "AUD", US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD", JP: "JPY",
    DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
    AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SE: "SEK",
    NO: "NOK", DK: "DKK", CH: "CHF", BR: "BRL", MX: "MXN", IN: "INR",
    CN: "CNY", KR: "KRW", SG: "SGD", HK: "HKD", ZA: "ZAR",
  };
  const countryCode    = profile?.country_code?.toUpperCase() ?? null;
  const userCurrency   = countryCode ? (COUNTRY_CURRENCY[countryCode] ?? discogsValue.currency) : discogsValue.currency;

  // Fetch exchange rate USD → userCurrency (cached 1h)
  let usdToUser = 1.0;
  if (userCurrency !== "USD") {
    try {
      const rateRes = await fetch(`https://open.er-api.com/v6/latest/USD`, { next: { revalidate: 3600 } });
      if (rateRes.ok) {
        const rateData = await rateRes.json() as { rates?: Record<string, number> };
        usdToUser = rateData.rates?.[userCurrency] ?? 1.0;
      }
    } catch { /* fall back to 1.0 */ }
  }

  // Fetch all user_records — paginated past Supabase's 1000-row cap.
  type LinkRow = {
    record_id:        string;
    created_at:       string;
    value:            number | null;
    price_low:        number | null;
    price_median:     number | null;
    price_currency:   string | null;
    media_condition:  string | null;
    sleeve_condition: string | null;
    last_played_at:   string | null;
    open_to_offers:   boolean | null;
    is_essential:     boolean | null;
    feeling:          string | null;
  };
  console.log('[collection/page] fetching for user:', user.id);
  const allLinks: LinkRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("user_records")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("record_id, created_at, value, price_low, price_median, price_currency, media_condition, sleeve_condition, last_played_at, open_to_offers, is_essential, feeling" as any)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[collection/page] user_records error:', JSON.stringify(error));
      break;
    }
    console.log(`[collection/page] user_records page from=${from}: ${data?.length ?? 0} rows`);
    if (!data || data.length === 0) break;
    allLinks.push(...(data as unknown as LinkRow[]));
    if (data.length < PAGE) break;
  }
  console.log('[collection/page] total allLinks:', allLinks.length);

  const recordIds          = allLinks.map((l) => l.record_id);
  const valueMap           = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.value ?? null]));
  const mediaConditionMap  = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.media_condition  ?? null]));
  const sleeveConditionMap = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.sleeve_condition ?? null]));

  // Convert stored prices to user's currency
  const convertPrice = (price: number | null, fromCurrency: string | null): number | null => {
    if (price == null || price <= 0) return null;
    const from = (fromCurrency ?? "USD").toUpperCase();
    if (from === userCurrency) return price;
    if (from === "USD") return price * usdToUser;
    return price; // non-USD foreign currencies: leave as-is for now
  };

  const priceMedianMap   = new Map<string, number | null>(allLinks.map((l) => [
    l.record_id, convertPrice(l.price_median ?? l.price_low, l.price_currency),
  ]));
  const priceCurrencyMap = new Map<string, string | null>(allLinks.map((l) => [l.record_id, userCurrency]));

  const estimatedValue = allLinks.reduce((sum, l) => {
    const v = convertPrice(l.price_median ?? l.price_low, l.price_currency) ?? 0;
    return v > 0 ? sum + v : sum;
  }, 0);
  const pricedCount = allLinks.filter(l => (l.price_median ?? l.price_low ?? 0) > 0).length;

  const dominantCurrency = userCurrency;

  const BATCH = 400;
  const priceLowMap = new Map<string, number | null>(allLinks.map((l) => [
    l.record_id, convertPrice(l.price_low, l.price_currency),
  ]));
  // Raw USD price — used for desirability thresholds which are denominated in USD
  const priceLowUsdMap = new Map<string, number | null>(allLinks.map((l) => [
    l.record_id, l.price_low ?? null,
  ]));

  const lastPlayedMap    = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.last_played_at ?? null]));
  const openToOffersMap  = new Map<string, boolean | null>(allLinks.map((l) => [l.record_id, l.open_to_offers ?? null]));
  const isEssentialMap   = new Map<string, boolean | null>(allLinks.map((l) => [l.record_id, l.is_essential ?? null]));
  const feelingMap       = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.feeling ?? null]));

  const recordsMap = new Map<string, Omit<CollectionRecord, "value" | "price_low" | "price_median" | "price_currency" | "media_condition" | "sleeve_condition" | "last_played_at" | "open_to_offers" | "is_essential" | "feeling">>();
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("records")
      .select("id, discogs_id, artist, album, year, genre, cover_url, label, format, country, community_have, community_want, community_num_for_sale")
      .in("id", recordIds.slice(i, i + BATCH));
    if (error) console.error('[collection/page] records batch error:', JSON.stringify(error));
    else console.log(`[collection/page] records batch i=${i}: ${data?.length ?? 0} rows`);
    for (const r of data ?? []) recordsMap.set(r.id, r as Omit<CollectionRecord, "value" | "price_low" | "price_median" | "price_currency" | "media_condition" | "sleeve_condition" | "last_played_at" | "open_to_offers" | "is_essential" | "feeling">);
  }

  const collection: CollectionRecord[] = recordIds
    .map((id) => {
      const r = recordsMap.get(id);
      if (!r) return undefined;
      return {
        ...r,
        value:                  valueMap.get(id)           ?? null,
        price_low:              priceLowMap.get(id)        ?? null,
        price_low_usd:          priceLowUsdMap.get(id)     ?? null,
        price_median:           priceMedianMap.get(id)     ?? null,
        price_currency:         priceCurrencyMap.get(id)   ?? null,
        media_condition:        mediaConditionMap.get(id)  ?? null,
        sleeve_condition:       sleeveConditionMap.get(id) ?? null,
        community_have:         r.community_have         ?? null,
        community_want:         r.community_want         ?? null,
        community_num_for_sale: r.community_num_for_sale ?? null,
        last_played_at:         lastPlayedMap.get(id)    ?? null,
        open_to_offers:         openToOffersMap.get(id)  ?? null,
        is_essential:           isEssentialMap.get(id)   ?? null,
        feeling:                feelingMap.get(id)       ?? null,
      };
    })
    .filter((r): r is CollectionRecord => r !== undefined);

  // ── Compute collection insights ───────────────────────────────────────────
  const insights: CollectionInsights = (() => {
    // Genre distribution (top 3, % of records with a genre tag)
    const genreCounts = new Map<string, number>();
    for (const r of collection) if (r.genre) genreCounts.set(r.genre, (genreCounts.get(r.genre) ?? 0) + 1);
    const withGenre = [...genreCounts.values()].reduce((a, b) => a + b, 0);
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([genre, count]) => ({
        genre,
        pct: withGenre > 0 ? Math.round((count / withGenre) * 100) : 0,
      }));

    // Peak decade
    const decadeCounts = new Map<string, number>();
    for (const r of collection) {
      if (!r.year) continue;
      const d = r.year < 1960 ? "Pre-1960" : `${Math.floor(r.year / 10) * 10}s`;
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
    }
    const topDecade = decadeCounts.size > 0
      ? [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // Countries
    const countryCount = new Set(collection.map(r => r.country).filter(Boolean)).size;

    // Most represented label
    const labelCounts = new Map<string, number>();
    for (const r of collection) if (r.label) labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
    const topLabelEntry = labelCounts.size > 0
      ? [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]
      : null;
    const topLabel = topLabelEntry ? { name: topLabelEntry[0], count: topLabelEntry[1] } : null;

    // Most common format
    const formatCounts = new Map<string, number>();
    for (const r of collection) if (r.format) formatCounts.set(r.format, (formatCounts.get(r.format) ?? 0) + 1);
    const topFormatEntry = formatCounts.size > 0
      ? [...formatCounts.entries()].sort((a, b) => b[1] - a[1])[0]
      : null;
    const topFormat = topFormatEntry ? { name: topFormatEntry[0], count: topFormatEntry[1] } : null;

    // Most collected artist — vinyl-format records only (LP, 12", 7", 10", EP, Vinyl)
    const vinylFormats = new Set(['LP', '12"', '7"', '10"', 'EP', 'Mini-Album', 'Vinyl']);
    const isVinylFormat = (fmt: string | null) =>
      !!fmt && (vinylFormats.has(fmt) || fmt.toLowerCase().includes('vinyl'));
    const artistCounts = new Map<string, number>();
    for (const r of collection) {
      if (r.artist && r.artist !== "Unknown" && r.artist !== "Various" && isVinylFormat(r.format))
        artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
    }
    const topArtistEntry = artistCounts.size > 0
      ? [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]
      : null;
    const topArtist = topArtistEntry && topArtistEntry[1] > 1
      ? { name: topArtistEntry[0], count: topArtistEntry[1] }
      : null;

    // Year range + average
    const years = collection.map(r => r.year).filter((y): y is number => y != null && y > 0);
    const yearRange = years.length > 0
      ? { oldest: Math.min(...years), newest: Math.max(...years) }
      : null;
    const mostPopularYear = (() => {
      if (years.length === 0) return null;
      const counts = new Map<number, number>();
      for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      console.log('[insights] mostPopularYear top-5:', sorted.slice(0, 5).map(([y, n]) => `${y}×${n}`).join(', '));
      return sorted[0][0];
    })();

    // Rarest record (highest market price_low)
    let rarestRecord = null;
    let maxPrice = 0;
    for (const link of allLinks) {
      const price = link.price_low ?? 0;
      if (price > maxPrice) {
        const rec = recordsMap.get(link.record_id);
        if (rec) {
          maxPrice = price;
          rarestRecord = { artist: rec.artist, album: rec.album, price, currency: userCurrency };
        }
      }
    }

    const holyGrailCount = collection.filter(r =>
      getDesirabilityTier(r.community_have, r.community_want, r.price_low_usd, r.community_num_for_sale) === "holy-grail"
    ).length;

    return { topFormat, topGenres, topArtist, topLabel, yearRange, mostPopularYear, countryCount, topDecade, rarestRecord, holyGrailCount };
  })();

  return (
    <CollectionClient
      initialCollection={collection}
      username={username}
      displayLabel={displayLabel}
      estimatedValue={estimatedValue}
      valueCurrency={dominantCurrency}
      pricedCount={pricedCount}
      discogsValue={discogsValue}
      insights={insights}
      lastSyncedAt={lastSyncedAt}
      lastSyncJob={lastSyncJob}
      avatarUrl={avatarUrl}
      startSync={params.start_sync === "1"}
      oauthDenied={params.oauth_denied === "1"}
      oauthError={params.oauth_error === "1"}
    />
  );
}
