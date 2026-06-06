import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CollectionClient from "@/components/collection/CollectionClient";

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
  price_median:   number | null;
  price_currency: string | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase.from("profiles") as any)
    .select("username, display_name, last_synced_at, avatar_url, collection_value_low, collection_value_med, collection_value_high, collection_value_currency")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as {
    username?: string | null; display_name?: string | null; last_synced_at?: string | null;
    avatar_url?: string | null; collection_value_low?: number | null; collection_value_med?: number | null;
    collection_value_high?: number | null; collection_value_currency?: string | null;
  } | null;
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

  // Fetch all user_records — paginated past Supabase's 1000-row cap.
  type LinkRow = {
    record_id:      string;
    created_at:     string;
    value:          number | null;
    price_low:      number | null;
    price_median:   number | null;
    price_currency: string | null;
  };
  console.log('[collection/page] fetching for user:', user.id);
  const allLinks: LinkRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("user_records")
      .select("record_id, created_at, value, price_low, price_median, price_currency")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[collection/page] user_records error:', JSON.stringify(error));
      break;
    }
    console.log(`[collection/page] user_records page from=${from}: ${data?.length ?? 0} rows`);
    if (!data || data.length === 0) break;
    allLinks.push(...(data as LinkRow[]));
    if (data.length < PAGE) break;
  }
  console.log('[collection/page] total allLinks:', allLinks.length);

  const recordIds        = allLinks.map((l) => l.record_id);
  const valueMap         = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.value ?? null]));
  const priceMedianMap   = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.price_median ?? l.price_low ?? null]));
  const priceCurrencyMap = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.price_currency ?? null]));

  const estimatedValue = allLinks.reduce((sum, l) => {
    const v = l.price_median ?? l.price_low ?? 0;
    return v > 0 ? sum + v : sum;
  }, 0);
  const pricedCount = allLinks.filter(l => (l.price_median ?? l.price_low ?? 0) > 0).length;

  // Dominant currency across priced records
  const currencyFreq = new Map<string, number>();
  for (const l of allLinks) {
    if ((l.price_median ?? l.price_low ?? 0) > 0 && l.price_currency) {
      currencyFreq.set(l.price_currency, (currencyFreq.get(l.price_currency) ?? 0) + 1);
    }
  }
  const dominantCurrency = [...currencyFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  const BATCH = 400;
  const recordsMap = new Map<string, Omit<CollectionRecord, "value" | "price_median" | "price_currency">>();
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("records")
      .select("id, discogs_id, artist, album, year, genre, cover_url, label, format, country")
      .in("id", recordIds.slice(i, i + BATCH));
    if (error) console.error('[collection/page] records batch error:', JSON.stringify(error));
    else console.log(`[collection/page] records batch i=${i}: ${data?.length ?? 0} rows`);
    for (const r of data ?? []) recordsMap.set(r.id, r as Omit<CollectionRecord, "value" | "price_median" | "price_currency">);
  }

  const collection: CollectionRecord[] = recordIds
    .map((id) => {
      const r = recordsMap.get(id);
      if (!r) return undefined;
      return {
        ...r,
        value:          valueMap.get(id)         ?? null,
        price_median:   priceMedianMap.get(id)   ?? null,
        price_currency: priceCurrencyMap.get(id) ?? null,
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
          rarestRecord = { artist: rec.artist, album: rec.album, price, currency: link.price_currency ?? "USD" };
        }
      }
    }

    return { topFormat, topGenres, topArtist, topLabel, yearRange, mostPopularYear, countryCount, topDecade, rarestRecord };
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
      avatarUrl={avatarUrl}
      startSync={params.start_sync === "1"}
      oauthDenied={params.oauth_denied === "1"}
      oauthError={params.oauth_error === "1"}
    />
  );
}
