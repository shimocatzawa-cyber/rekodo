import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function enqueueSync(supabase: SupabaseClient, userId: string): Promise<string> {
  // Return existing job ID if one is already pending or processing.
  const { data: existing } = await supabase
    .from("sync_queue")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("sync_queue")
    .insert({ user_id: userId, status: "pending" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function getSyncJob(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_queue")
    .select(
      "status, phase, total_records, current_page, total_pages, progress_done, new_added, records_updated, error_message, completed_at"
    )
    .eq("id", jobId)
    .single();
  return data;
}
