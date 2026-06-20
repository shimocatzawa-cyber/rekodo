import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Write-back endpoint for the Collection page's "Now Playing" Spotify lookup.
// That lookup still runs client-side (live search via the user's own token),
// but once it resolves, the result is cached here on `records` so future
// opens of the same record (by anyone) skip the live search entirely — the
// same spotify_album_id/spotify_matched columns the playlist matcher reads.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    recordId?: string; albumId?: string | null; matched?: boolean;
  };
  const { recordId, albumId, matched } = body;
  if (!recordId || typeof matched !== "boolean") {
    return NextResponse.json({ error: "recordId and matched required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Only allow writing match data for records this user actually owns —
  // `records` is shared catalog data, so this guards against an arbitrary
  // authenticated client poisoning the cache for records it has no relation to.
  const { data: owned } = await db
    .from("user_records").select("id").eq("user_id", user.id).eq("record_id", recordId).maybeSingle();
  if (!owned) return NextResponse.json({ error: "Not found in your collection" }, { status: 404 });

  // Don't overwrite an existing match (e.g. one the background matcher already
  // found with its tracklist) with a no-match result from this lighter path.
  const { data: existing } = await db
    .from("records").select("spotify_matched").eq("id", recordId).maybeSingle();
  if (existing?.spotify_matched && !matched) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { error } = await db
    .from("records")
    .update({
      spotify_album_id: matched ? (albumId ?? null) : null,
      spotify_matched: matched,
      spotify_matched_at: new Date().toISOString(),
    })
    .eq("id", recordId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
