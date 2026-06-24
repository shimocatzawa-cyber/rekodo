import { createClient } from "@/lib/supabase/server";
import { getOrComputeCompatibility } from "@/lib/compatibility";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type EventType = "play" | "wantlist_add" | "collection_add";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cursor = request.nextUrl.searchParams.get("cursor"); // ISO timestamp, exclusive

  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewer.id);

  const followingIds = (follows ?? []).map(f => f.following_id);
  if (followingIds.length === 0) {
    return Response.json({ items: [], nextCursor: null });
  }

  let query = supabase
    .from("activity_events")
    .select("id, user_id, event_type, record_id, created_at")
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) query = query.lt("created_at", cursor);

  const { data: events, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!events || events.length === 0) {
    return Response.json({ items: [], nextCursor: null });
  }

  const actorIds  = [...new Set(events.map(e => e.user_id))];
  const recordIds = [...new Set(events.map(e => e.record_id))];

  const [profilesRes, recordsRes, scores] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", actorIds),
    supabase.from("records").select("id, artist, album, cover_url").in("id", recordIds),
    Promise.all(actorIds.map(actorId => getOrComputeCompatibility(supabase, viewer.id, actorId))),
  ]);

  const profileById = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
  const recordById  = new Map((recordsRes.data ?? []).map(r => [r.id, r]));
  const scoreByActor = new Map(actorIds.map((id, i) => [id, scores[i]]));

  const items = events.map(e => {
    const actor  = profileById.get(e.user_id);
    const record = recordById.get(e.record_id);
    if (!actor || !record) return null;
    const match = scoreByActor.get(e.user_id);
    return {
      id: e.id,
      eventType: e.event_type as EventType,
      createdAt: e.created_at,
      actor: {
        id: actor.id,
        username: actor.username,
        displayName: actor.display_name,
        avatarUrl: actor.avatar_url,
      },
      record: {
        id: record.id,
        artist: record.artist,
        album: record.album,
        coverUrl: record.cover_url,
      },
      match: match ? { score: match.score, label: match.label } : null,
    };
  }).filter(Boolean);

  const nextCursor = events.length === PAGE_SIZE ? events[events.length - 1].created_at : null;

  return Response.json({ items, nextCursor });
}
