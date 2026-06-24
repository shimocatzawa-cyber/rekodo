import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId } = (await request.json()) as { recordId?: string };
  if (!recordId) return NextResponse.json({ error: "Missing recordId" }, { status: 400 });

  const now = new Date().toISOString();

  // increment_play_count bumps play_count and sets last_played_at = now() in one statement
  const { error } = await (supabase as any).rpc("increment_play_count", {
    p_user_id: user.id,
    p_record_id: recordId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivityEvent(supabase, user.id, "play", recordId);

  return NextResponse.json({ last_played_at: now });
}
