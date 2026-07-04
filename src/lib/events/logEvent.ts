"use client";

import { createClient } from "@/lib/supabase/client";

export async function logUserEvent(
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("user_events").insert({
      user_id:    user.id,
      event_type: eventType,
      metadata,
    });
  } catch {
    // Logging failures must never surface to the caller.
  }
}
