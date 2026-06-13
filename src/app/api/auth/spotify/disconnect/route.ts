import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("profiles").update({
    spotify_access_token:  null,
    spotify_refresh_token: null,
    spotify_token_expiry:  null,
    spotify_connected:     false,
    spotify_display_name:  null,
    spotify_product:       null,
  }).eq("id", user.id);

  return NextResponse.json({ success: true });
}
