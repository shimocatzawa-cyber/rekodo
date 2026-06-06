import type { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!key || !secret) {
    return Response.json({ error: "Discogs not configured" }, { status: 500 });
  }

  const requestedCurrency = req.nextUrl.searchParams.get("currency") || null;

  const url = `https://api.discogs.com/marketplace/stats/${encodeURIComponent(id)}` +
    `?key=${key}&secret=${secret}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "rekodo/1.0" },
    cache: "no-store",
  });

  if (!res.ok) {
    return Response.json({ error: "Price not available" }, { status: res.status });
  }

  const data = await res.json() as {
    lowest_price?: { value?: number; currency?: string } | null;
    num_for_sale?: number;
    blocked_from_sale?: boolean;
    last_sale?: { price?: { value?: number; currency?: string }; date?: string } | null;
  };

  let lowest      = data.lowest_price?.value ?? null;
  let currency    = data.lowest_price?.currency ?? "USD";
  const numForSale  = data.num_for_sale ?? 0;
  let lastSold    = data.last_sale?.price?.value ?? null;
  const lastSoldDate = data.last_sale?.date ?? null;

  // Convert to user's profile currency if different
  if (requestedCurrency && requestedCurrency !== currency && (lowest != null || lastSold != null)) {
    try {
      const rateRes = await fetch(
        `https://api.frankfurter.app/latest?from=${currency}&to=${requestedCurrency}`,
        { next: { revalidate: 3600 } } as RequestInit
      );
      if (rateRes.ok) {
        const rateData = await rateRes.json() as { rates?: Record<string, number> };
        const rate = rateData.rates?.[requestedCurrency];
        if (rate) {
          lowest   = lowest   != null ? Math.round(lowest   * rate * 100) / 100 : null;
          lastSold = lastSold != null ? Math.round(lastSold * rate * 100) / 100 : null;
          currency = requestedCurrency;
        }
      }
    } catch { /* keep original values on rate fetch failure */ }
  }

  return Response.json(
    {
      last_sold:      lastSold,
      last_sold_date: lastSoldDate,
      lowest,
      median:       null,
      highest:      null,
      currency,
      num_for_sale: numForSale,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
