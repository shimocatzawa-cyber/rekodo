import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title, slug, list_type, is_public, created_at")
    .eq("user_id", user.id)
    .order("created_at");

  const wantlists = (lists ?? []).filter(
    l => l.slug === "wantlist" || l.slug === "want-to-buy"
  );

  const result = await Promise.all(
    wantlists.map(async l => {
      const { data: items, error } = await supabase
        .from("list_items")
        .select("id, position, item_type, song_artist, song_album, song_title, source, discogs_release_id, record_id, created_at")
        .eq("list_id", l.id)
        .order("position");
      return { list: l, items: items ?? [], error: error?.message ?? null };
    })
  );

  // Probe: try inserting a test row with source:"dig" to see the exact error
  const wantlistId = wantlists[0]?.list?.id ?? null;
  let insertProbe: { error: string | null; code: string | null } = { error: null, code: null };
  if (wantlistId) {
    const { error: probeErr } = await supabase.from("list_items").insert({
      list_id: wantlistId,
      position: 9999,
      item_type: "song",
      song_title: "__debug_probe__",
      song_artist: "__debug_probe__",
      song_album: "__debug_probe__",
      source: "dig",
    });
    if (probeErr) {
      insertProbe = { error: probeErr.message, code: probeErr.code ?? null };
    } else {
      // Clean up the test row immediately
      await supabase.from("list_items").delete()
        .eq("list_id", wantlistId).eq("position", 9999).eq("song_title", "__debug_probe__");
      insertProbe = { error: null, code: "SUCCESS" };
    }
  }

  return Response.json({ user_id: user.id, wantlists: result, insertProbe });
}
