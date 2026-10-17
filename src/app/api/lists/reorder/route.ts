import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { ids: string[] };
  if (!Array.isArray(body.ids)) return NextResponse.json({ error: "ids required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  await Promise.all(
    body.ids.map((id, index) =>
      db.from("lists").update({ sort_order: index }).eq("id", id).eq("user_id", user.id)
    )
  );

  return NextResponse.json({ ok: true });
}
