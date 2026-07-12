import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidFeeling } from "@/lib/feelings";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { recordId?: unknown; is_essential?: unknown; feeling?: unknown; memory_text?: unknown; tags?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recordId, is_essential, feeling, memory_text, tags } = body;
  if (typeof recordId !== "string" || !recordId) {
    return NextResponse.json({ error: "Missing recordId" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (is_essential !== undefined) {
    if (typeof is_essential !== "boolean") {
      return NextResponse.json({ error: "is_essential must be boolean" }, { status: 400 });
    }
    update.is_essential = is_essential;
  }

  if (feeling !== undefined) {
    if (feeling !== null && (typeof feeling !== "string" || !isValidFeeling(feeling))) {
      return NextResponse.json({ error: "Invalid feeling value" }, { status: 400 });
    }
    update.feeling = feeling;
    update.feeling_tagged_at = feeling ? new Date().toISOString() : null;
  }

  if (memory_text !== undefined) {
    if (memory_text !== null && typeof memory_text !== "string") {
      return NextResponse.json({ error: "memory_text must be a string or null" }, { status: 400 });
    }
    if (typeof memory_text === "string" && memory_text.length > 5000) {
      return NextResponse.json({ error: "memory_text is too long" }, { status: 400 });
    }
    update.memory_text = memory_text;
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some(t => typeof t !== "string" || t.length > 50)) {
      return NextResponse.json({ error: "tags must be an array of strings (max 50 chars each)" }, { status: 400 });
    }
    if (tags.length > 20) {
      return NextResponse.json({ error: "Maximum 20 tags per record" }, { status: 400 });
    }
    update.tags = tags;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

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
    .update(update)
    .eq("user_id", user.id)
    .eq("record_id", recordId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, ...update });
}
