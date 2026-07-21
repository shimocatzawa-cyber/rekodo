import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const STUCK_JOB_MS = 20 * 60 * 1000; // 20 minutes without a progress update = stuck

export async function enqueueSync(supabase: SupabaseClient, userId: string): Promise<string> {
  // Check for an active job — but treat ones that haven't progressed in
  // 20+ minutes as stuck (Edge Function timed out without writing "failed").
  const { data: existing } = await supabase
    .from("sync_queue")
    .select("id, updated_at")
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (existing) {
    const age = Date.now() - new Date(existing.updated_at).getTime();
    if (age < STUCK_JOB_MS) return existing.id;

    // Stale — mark failed so a fresh job can be created below.
    await supabase
      .from("sync_queue")
      .update({ status: "failed", error_message: "Sync stalled — automatically restarted", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

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
