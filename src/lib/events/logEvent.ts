"use client";

import { createClient } from "@/lib/supabase/client";

export async function logUserEvent(
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("user_events").insert({
      user_id:    session.user.id,
      event_type: eventType,
      metadata,
    });

    if (error) return;

    // Fire card evaluation after a successful event insert — non-blocking,
    // errors swallowed so a failed evaluation never breaks the calling feature.
    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/evaluate-user-cards`;
    fetch(edgeUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: session.user.id }),
    }).catch(() => {});
  } catch {
    // Logging failures must never surface to the caller.
  }
}
