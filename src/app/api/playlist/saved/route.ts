import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Lists saved by the AI playlist generator's "Save as list" flow — list_type
// "personal", excluding the wantlist (which also carries list_type
// "personal" for historical reasons — see src/app/api/lists/mine/route.ts).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: lists } = await db
    .from("lists")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .eq("list_type", "personal")
    .not("slug", "in", '("wantlist","want-to-buy")')
    .order("created_at", { ascending: false });

  const listRows = (lists ?? []) as Array<{ id: string; title: string; created_at: string }>;
  if (listRows.length === 0) return NextResponse.json({ playlists: [] });

  const listIds = listRows.map((l) => l.id);
  const { data: items } = await db
    .from("list_items").select("list_id, spotify_tracks").in("list_id", listIds);
  const countByList    = new Map<string, number>();
  const durationByList = new Map<string, number>();
  for (const r of (items ?? []) as Array<{ list_id: string; spotify_tracks: Array<{ duration_ms: number }> | null }>) {
    countByList.set(r.list_id, (countByList.get(r.list_id) ?? 0) + 1);
    const ms = r.spotify_tracks?.[0]?.duration_ms ?? 0;
    durationByList.set(r.list_id, (durationByList.get(r.list_id) ?? 0) + ms);
  }

  const playlists = listRows.map((l) => ({
    id: l.id, title: l.title, createdAt: l.created_at,
    trackCount: countByList.get(l.id) ?? 0, durationMs: durationByList.get(l.id) ?? 0,
  }));

  return NextResponse.json({ playlists });
}
