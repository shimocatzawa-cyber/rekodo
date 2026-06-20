import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// One-off cleanup route — safe to delete once run.
//
// Early versions of match-spotify-worker (and the Collection page's live
// search) didn't check the Spotify search response status before reading it,
// so a 429/401 during a rate-limit episode looked identical to "Spotify has
// no match" and got written as a permanent spotify_matched: false with
// spotify_matched_at set. The worker only ever processes rows where
// spotify_matched_at IS NULL, so those rows would never be retried. This
// clears matched_at on every spotify_matched: false row (records and wantlist
// song items) so the now-fixed worker re-checks them.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any;

  const { data: records, error: recordsError } = await db
    .from("records")
    .update({ spotify_matched_at: null })
    .eq("spotify_matched", false)
    .select("id");

  const { data: songItems, error: songItemsError } = await db
    .from("list_items")
    .update({ spotify_matched_at: null })
    .eq("item_type", "song")
    .eq("spotify_matched", false)
    .select("id");

  if (recordsError || songItemsError) {
    return NextResponse.json({
      error: "Update failed",
      recordsError: recordsError?.message,
      songItemsError: songItemsError?.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recordsReset: records?.length ?? 0,
    songItemsReset: songItems?.length ?? 0,
  });
}
