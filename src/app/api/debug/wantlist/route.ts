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

  return Response.json({ user_id: user.id, wantlists: result });
}
