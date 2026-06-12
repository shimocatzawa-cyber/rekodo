import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId } = (await request.json()) as { recordId?: string };
  if (!recordId) return NextResponse.json({ error: "Missing recordId" }, { status: 400 });

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("user_records")
    .update({ last_played_at: now })
    .eq("user_id", user.id)
    .eq("record_id", recordId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ last_played_at: now });
}
