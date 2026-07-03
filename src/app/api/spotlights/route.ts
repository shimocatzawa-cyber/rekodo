import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (type !== "artist" && type !== "label") {
    return NextResponse.json({ error: "type must be artist or label" }, { status: 400 });
  }

  const [currentRes, archiveRes] = await Promise.all([
    (supabase as any)
      .from("spotlights")
      .select("*")
      .eq("type", type)
      .eq("status", "active")
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (supabase as any)
      .from("spotlights")
      .select("id, name, month, type")
      .eq("type", type)
      .eq("status", "archived")
      .order("month", { ascending: false }),
  ]);

  return NextResponse.json({
    current: currentRes.data ?? null,
    archive: archiveRes.data ?? [],
  });
}
