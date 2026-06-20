import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST — authenticated. Counts how many of the user's owned records / wantlist
// items still need Spotify matching, then fires the matching worker
// (fire-and-forget) if there's anything to do. Safe to call on every
// Playlist-tab visit — idempotent, no-op once everything's matched.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: ownedLinks } = await db
    .from("user_records").select("record_id").eq("user_id", user.id);
  const ownedRecordIds: string[] = [...new Set<string>((ownedLinks ?? []).map((r: { record_id: string }) => r.record_id))];

  const { data: wantlist } = await db
    .from("lists").select("id").eq("user_id", user.id).eq("slug", "wantlist").maybeSingle();

  let wantlistRecordIds: string[] = [];
  let wantlistSongPendingCount = 0;
  if (wantlist?.id) {
    const { data: recordItems } = await db
      .from("list_items").select("record_id")
      .eq("list_id", wantlist.id).eq("item_type", "record").not("record_id", "is", null);
    wantlistRecordIds = (recordItems ?? []).map((r: { record_id: string }) => r.record_id);

    const { count } = await db
      .from("list_items").select("id", { count: "exact", head: true })
      .eq("list_id", wantlist.id).eq("item_type", "song").is("spotify_matched_at", null);
    wantlistSongPendingCount = count ?? 0;
  }

  const allRecordIds = [...new Set([...ownedRecordIds, ...wantlistRecordIds])];

  let unmatchedRecordCount = 0;
  if (allRecordIds.length > 0) {
    const { count } = await db
      .from("records").select("id", { count: "exact", head: true })
      .in("id", allRecordIds).is("spotify_matched_at", null);
    unmatchedRecordCount = count ?? 0;
  }

  const totalToMatch = unmatchedRecordCount + wantlistSongPendingCount;

  if (totalToMatch > 0) {
    const { data: { session } } = await supabase.auth.getSession();
    const matchUrl = new URL("/api/playlist/match-spotify-worker", request.url).toString();
    // after() keeps the serverless function alive until this fetch actually
    // completes — a bare unawaited fetch() gets killed mid-flight as soon as
    // the response below is sent, which is why the matcher was stalling.
    after(() =>
      fetch(matchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rekodo-internal": "true",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {})
    );
  }

  return NextResponse.json({
    queued: totalToMatch,
    message: totalToMatch > 0
      ? `${totalToMatch} releases queued for Spotify matching.`
      : "All releases already matched.",
  });
}
