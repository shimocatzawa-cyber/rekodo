import { type NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";

const SUPPORTED_CURRENCIES = new Set([
  "USD", "GBP", "EUR", "CAD", "AUD", "JPY", "CHF", "MXN",
  "BRL", "NZD", "SEK", "ZAR", "SGD", "NOK", "DKK", "PLN",
]);

export async function POST(request: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as { releaseIds?: number[]; currency?: string };
  const currency = SUPPORTED_CURRENCIES.has(body.currency ?? "") ? body.currency! : "USD";
  const releaseIds = Array.isArray(body.releaseIds) ? body.releaseIds.slice(0, 30) : [];

  if (releaseIds.length === 0) return NextResponse.json({ prices: {} });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
  if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

  const prices: Record<number, { lowestPrice: number | null; currency: string; numForSale: number }> = {};

  await Promise.all(
    releaseIds.map(async (releaseId) => {
      try {
        const res = await fetch(
          `https://api.discogs.com/marketplace/stats/${releaseId}?curr_abbr=${currency}`,
          { headers, signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return;
        const json = await res.json() as {
          lowest_price?: { value: number; currency: string } | null;
          num_for_sale?: number;
          blocked_from_sale?: boolean;
        };
        if (!json.blocked_from_sale) {
          prices[releaseId] = {
            lowestPrice: json.lowest_price?.value ?? null,
            currency:    json.lowest_price?.currency ?? currency,
            numForSale:  json.num_for_sale ?? 0,
          };
        }
      } catch { /* skip — price is optional */ }
    })
  );

  return NextResponse.json({ prices });
}
