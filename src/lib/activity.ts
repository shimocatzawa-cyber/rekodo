import type { SupabaseClient } from "@supabase/supabase-js";

// Skips logging if this batch of newly-linked records is the user's first-ever
// collection population (Discogs OAuth import, CSV import, or a legacy first
// sync) — the "Collectors I Follow" feed should only show activity *after*
// that initial import, not flood followers with someone's whole back catalog.
export async function logCollectionAddActivity(
  supabase: SupabaseClient,
  userId: string,
  newRecordIds: string[]
): Promise<void> {
  if (newRecordIds.length === 0) return;

  const { count } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) <= newRecordIds.length) return; // this batch was the user's first-ever collection

  const { error } = await supabase.from("activity_events").insert(
    newRecordIds.map((recordId) => ({
      user_id: userId,
      event_type: "collection_add" as const,
      record_id: recordId,
    }))
  );
  if (error) console.error("activity_events insert error:", error.message);
}

export async function logActivityEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: "play" | "wantlist_add",
  recordId: string
): Promise<void> {
  const { error } = await supabase
    .from("activity_events")
    .insert({ user_id: userId, event_type: eventType, record_id: recordId });
  if (error) console.error("activity_events insert error:", error.message);
}
