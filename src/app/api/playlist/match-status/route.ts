import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: ownedLinks } = await db.from("user_records").select("record_id").eq("user_id", user.id);
  const ownedRecordIds: string[] = [...new Set<string>((ownedLinks ?? []).map((r: { record_id: string }) => r.record_id))];

  const { data: wantlist } = await db
    .from("lists").select("id").eq("user_id", user.id).eq("slug", "wantlist").maybeSingle();

  let wantlistRecordIds: string[] = [];
  let wantlistSongTotal = 0, wantlistSongMatched = 0, wantlistSongAttempted = 0;
  if (wantlist?.id) {
    const { data: recordItems } = await db
      .from("list_items").select("record_id").eq("list_id", wantlist.id).eq("item_type", "record").not("record_id", "is", null);
    wantlistRecordIds = (recordItems ?? []).map((r: { record_id: string }) => r.record_id);

    const { count: total } = await db
      .from("list_items").select("id", { count: "exact", head: true }).eq("list_id", wantlist.id).eq("item_type", "song");
    const { count: matchedCount } = await db
      .from("list_items").select("id", { count: "exact", head: true }).eq("list_id", wantlist.id).eq("item_type", "song").eq("spotify_matched", true);
    const { count: attemptedCount } = await db
      .from("list_items").select("id", { count: "exact", head: true }).eq("list_id", wantlist.id).eq("item_type", "song").not("spotify_matched_at", "is", null);
    wantlistSongTotal = total ?? 0;
    wantlistSongMatched = matchedCount ?? 0;
    wantlistSongAttempted = attemptedCount ?? 0;
  }

  const allRecordIds = [...new Set([...ownedRecordIds, ...wantlistRecordIds])];
  let recordTotal = 0, recordMatched = 0, recordAttempted = 0;
  if (allRecordIds.length > 0) {
    const { count: total } = await db.from("records").select("id", { count: "exact", head: true }).in("id", allRecordIds);
    const { count: matchedCount } = await db.from("records").select("id", { count: "exact", head: true }).in("id", allRecordIds).eq("spotify_matched", true);
    const { count: attemptedCount } = await db.from("records").select("id", { count: "exact", head: true }).in("id", allRecordIds).not("spotify_matched_at", "is", null);
    recordTotal = total ?? 0;
    recordMatched = matchedCount ?? 0;
    recordAttempted = attemptedCount ?? 0;
  }

  const total     = recordTotal + wantlistSongTotal;
  const matched   = recordMatched + wantlistSongMatched;
  const attempted = recordAttempted + wantlistSongAttempted;
  // pending = not yet attempted (still queued/in-flight in the worker).
  // Records the worker tried and found no Spotify match for stay "attempted"
  // forever (terminal state) so the progress bar still reaches 100% rather
  // than spinning on permanently-unmatched releases.
  const pending = total - attempted;
  const percentComplete = total > 0 ? Math.round((attempted / total) * 100) : 0;

  return NextResponse.json({ total, matched, pending, percentComplete });
}
