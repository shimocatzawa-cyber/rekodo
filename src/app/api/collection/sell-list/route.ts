import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Country code -> ISO 4217 currency (mirrors src/app/collection/page.tsx)
const COUNTRY_CURRENCY: Record<string, string> = {
  AU: "AUD", US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD", JP: "JPY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SE: "SEK",
  NO: "NOK", DK: "DKK", CH: "CHF", BR: "BRL", MX: "MXN", IN: "INR",
  CN: "CNY", KR: "KRW", SG: "SGD", HK: "HKD", ZA: "ZAR",
};

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("country_code, collection_value_currency")
    .eq("id", userId)
    .maybeSingle() as { data: { country_code?: string | null; collection_value_currency?: string | null } | null };

  const countryCode  = profile?.country_code?.toUpperCase() ?? null;
  const userCurrency = countryCode
    ? (COUNTRY_CURRENCY[countryCode] ?? profile?.collection_value_currency ?? "USD")
    : (profile?.collection_value_currency ?? "USD");

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

  const convertPrice = (price: number | null, fromCurrency: string | null): number | null => {
    if (price == null || price <= 0) return null;
    const from = (fromCurrency ?? "USD").toUpperCase();
    if (from === userCurrency) return price;
    if (from === "USD") return price * usdToUser;
    return price; // non-USD foreign currencies: leave as-is for now
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: links, error } = await (supabase as any)
    .from("user_records")
    .select("record_id, media_condition, sleeve_condition, value, price_median, price_currency")
    .eq("user_id", userId)
    .eq("open_to_offers", true)
    .order("open_to_offers_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!links?.length) return NextResponse.json({ items: [] });

  const recordIds = links.map((l: { record_id: string }) => l.record_id);
  const { data: records } = await supabase
    .from("records")
    .select("id, artist, album, year, cover_url, format, label")
    .in("id", recordIds);

  const recordById = new Map((records ?? []).map((r) => [r.id, r]));

  const items = links
    .map((l: { record_id: string; media_condition: string | null; sleeve_condition: string | null; value: number | null; price_median: number | null; price_currency: string | null }) => {
      const r = recordById.get(l.record_id);
      if (!r) return null;
      return {
        id:               r.id,
        artist:           r.artist,
        album:            r.album,
        year:             r.year ?? null,
        cover_url:        r.cover_url ?? null,
        format:           r.format ?? null,
        label:            r.label ?? null,
        media_condition:  l.media_condition ?? null,
        sleeve_condition: l.sleeve_condition ?? null,
        value:            convertPrice(l.value, l.price_currency),
        price_median:     convertPrice(l.price_median, l.price_currency),
        price_currency:   userCurrency,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
