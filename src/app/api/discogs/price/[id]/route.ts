import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!key || !secret) {
    return Response.json({ error: "Discogs not configured" }, { status: 500 });
  }

  const url = `https://api.discogs.com/marketplace/stats/${encodeURIComponent(id)}?key=${key}&secret=${secret}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "rekodo/1.0",
      "Authorization": `Discogs key=${key}, secret=${secret}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return Response.json({ error: "Price not available" }, { status: res.status });
  }

  const data = await res.json();

  // Discogs marketplace/stats shape:
  //   lowest_price:  { value: number, currency: string }
  //   median_price:  { value: number, currency: string }
  //   highest_price: { value: number, currency: string }
  //   last_sale:     { date: string, price: { value: number, currency: string } }
  //   num_for_sale:  number

  function val(obj: unknown): number | null {
    if (obj == null || typeof obj !== "object") return null;
    const v = (obj as Record<string, unknown>).value;
    return typeof v === "number" && v > 0 ? v : null;
  }

  function cur(obj: unknown): string | null {
    if (obj == null || typeof obj !== "object") return null;
    const c = (obj as Record<string, unknown>).currency;
    return typeof c === "string" ? c : null;
  }

  // last_sale nests the price one level deeper: last_sale.price.{value,currency}
  const lastSale      = data.last_sale ?? null;
  const lastSalePrice = lastSale?.price ?? null;

  const currency =
    cur(data.lowest_price)  ??
    cur(data.median_price)  ??
    cur(data.highest_price) ??
    cur(lastSalePrice)      ??
    "USD";

  return Response.json(
    {
      last_sold:      val(lastSalePrice),
      last_sold_date: lastSale?.date    ?? null,
      lowest:         val(data.lowest_price),
      median:         val(data.median_price),
      highest:        val(data.highest_price),
      currency,
      num_for_sale:   data.num_for_sale ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
