import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    id?: string;
    title: string;
    cassette_type: string;
    side_a: unknown[];
    side_b: unknown[];
    stamps: unknown[];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  if (body.id) {
    // Update existing — verify ownership via RLS
    const { error } = await db
      .from("mixtapes")
      .update({
        title:         body.title,
        cassette_type: body.cassette_type,
        side_a:        body.side_a,
        side_b:        body.side_b,
        stamps:        body.stamps ?? [],
        updated_at:    new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: body.id });
  }

  // Create new
  const { data, error } = await db
    .from("mixtapes")
    .insert({
      user_id:       user.id,
      title:         body.title,
      cassette_type: body.cassette_type,
      side_a:        body.side_a,
      side_b:        body.side_b,
      stamps:        body.stamps ?? [],
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
