import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_ACTIONS = ["download", "copy"] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const cardType: unknown = body?.cardType;
  const action: unknown   = body?.action;

  if (typeof cardType !== "string" || !cardType.trim()) {
    return NextResponse.json({ error: "Invalid cardType" }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true });

  const slug = cardType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const path = `/share-card/${slug}/${action}`;

  const { error } = await supabase
    .from("page_views")
    .insert({ user_id: user.id, section: "Share Card", path });

  if (error) console.error("[track-share-card] insert failed:", error.message);

  return NextResponse.json({ ok: true });
}
