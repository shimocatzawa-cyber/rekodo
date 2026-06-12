import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { recordId?: unknown; open_to_offers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recordId, open_to_offers } = body;
  if (typeof recordId !== "string" || !recordId) {
    return NextResponse.json({ error: "Missing recordId" }, { status: 400 });
  }
  if (typeof open_to_offers !== "boolean") {
    return NextResponse.json({ error: "open_to_offers must be boolean" }, { status: 400 });
  }

  // Verify the row belongs to the authenticated user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("user_records")
    .select("id")
    .eq("user_id", user.id)
    .eq("record_id", recordId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("user_records")
    .update({
      open_to_offers,
      open_to_offers_at: open_to_offers ? new Date().toISOString() : null,
    })
    .eq("user_id", user.id)
    .eq("record_id", recordId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, open_to_offers });
}
