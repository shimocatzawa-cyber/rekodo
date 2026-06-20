"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Persist marketplace price data ───────────────────────────────────────────

export interface PricePayload {
  last_sold:  number | null;
  lowest:     number | null;
  median:     number | null;
  highest:    number | null;
  currency:   string;
}

export async function persistRecordPrice(recordId: string, price: PricePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Silently ignores errors — if the price_* columns haven't been added via
  // migration yet, the update fails harmlessly; the UI still shows fetched data.
  await supabase
    .from("user_records")
    .update({
      price_last_sold:  price.last_sold,
      price_low:        price.lowest,
      price_median:     price.median,
      price_high:       price.highest,
      price_currency:   price.currency,
      price_fetched_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("record_id", recordId);
}
