"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RecordPayload {
  discogs_id: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  label?: string | null;
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined
) {
  const emailPrefix = (email ?? "").split("@")[0] || "user";
  // ignoreDuplicates keeps existing username intact if profile already exists
  await supabase.from("profiles").upsert(
    { id: userId, username: `${emailPrefix}_${userId.slice(0, 6)}` },
    { onConflict: "id", ignoreDuplicates: true }
  );
}

export async function addToCollection(payload: RecordPayload) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { error: "Not authenticated" };
  }

  await ensureProfile(supabase, user.id, user.email);

  // Select-then-insert avoids needing an UPDATE policy on records.
  // Records are shared/canonical rows — we never need to update them on add.
  let recordId: string;
  const { data: existing } = await supabase
    .from("records")
    .select("id")
    .eq("discogs_id", payload.discogs_id)
    .maybeSingle();

  if (existing) {
    recordId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("records")
      .insert({
        discogs_id: payload.discogs_id,
        artist: payload.artist,
        album: payload.album,
        year: payload.year,
        genre: payload.genre,
        cover_url: payload.cover_url,
        label: payload.label ?? null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      // Race: another concurrent insert won — re-fetch
      const { data: raceWinner } = await supabase
        .from("records")
        .select("id")
        .eq("discogs_id", payload.discogs_id)
        .maybeSingle();
      if (!raceWinner) {
        return { error: `Record error: ${insertErr?.message ?? "unknown"}` };
      }
      recordId = raceWinner.id;
    } else {
      recordId = inserted.id;
    }
  }

  // Link to collection — only insert if not already present
  const { data: existingLink } = await supabase
    .from("user_records")
    .select("id")
    .eq("user_id", user.id)
    .eq("record_id", recordId)
    .maybeSingle();

  if (!existingLink) {
    const { error: linkErr } = await supabase
      .from("user_records")
      .insert({ user_id: user.id, record_id: recordId });
    if (linkErr) {
      return { error: `Link error: ${linkErr.message}` };
    }
  }

  revalidatePath("/collection");
  return { success: true };
}

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
