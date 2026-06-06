import type { NextRequest } from "next/server";

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
  };

  const lowest   = data.lowest_price?.value ?? null;
  const currency = data.lowest_price?.currency ?? "USD";
  const numForSale = data.num_for_sale ?? 0;

  return Response.json(
    {
      last_sold:      null,
      last_sold_date: null,
      lowest,
      median:       null,
      highest:      null,
      currency,
      num_for_sale: numForSale,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
