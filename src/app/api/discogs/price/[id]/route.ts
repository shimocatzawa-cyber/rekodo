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

  // Fetch current listings sorted price asc — gives us low/median/high from real data.
  // The /marketplace/stats endpoint only returns lowest_price; this gives us all three.
  const url =
    `https://api.discogs.com/marketplace/listings` +
    `?release_id=${encodeURIComponent(id)}` +
    `&status=For+Sale` +
    `&sort=price&sort_order=asc` +
    `&per_page=100` +
    `&key=${key}&secret=${secret}`;

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

  type Listing = { price?: { value?: unknown; currency?: string } };
  const listings: Listing[] = data.listings ?? [];
  const numForSale: number  = data.pagination?.items ?? listings.length;

  // Extract valid numeric prices (already sorted asc by Discogs)
  const prices = listings
    .map(l => (typeof l.price?.value === "number" && l.price.value > 0 ? l.price.value : null))
    .filter((v): v is number => v !== null);

  const currency = listings.find(l => l.price?.currency)?.price?.currency ?? "USD";
  const lowest   = prices.length > 0 ? prices[0]                                    : null;
  const median   = prices.length > 0 ? prices[Math.floor(prices.length / 2)]        : null;
  const highest  = prices.length > 0 ? prices[prices.length - 1]                    : null;

  return Response.json(
    {
      last_sold:      null,  // not available from listings endpoint
      last_sold_date: null,
      lowest,
      median,
      highest,
      currency,
      num_for_sale:   numForSale,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
