import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = await createClient();

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
    .map((l: { record_id: string; media_condition: string | null; sleeve_condition: string | null; value: number | null; price_median: number | null; price_currency: string }) => {
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
        value:            l.value ?? null,
        price_median:     l.price_median ?? null,
        price_currency:   l.price_currency ?? "USD",
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
