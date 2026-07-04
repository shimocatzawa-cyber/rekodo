import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { ownerId } = await req.json() as { ownerId?: string };
  if (!ownerId) return Response.json({ error: "ownerId required" }, { status: 400 });
  if (ownerId === user.id) return Response.json({ error: "Cannot like your own essentials wall" }, { status: 400 });

  const { data: existing } = await supabase
    .from("essentials_wall_likes")
    .select("id")
    .eq("essentials_owner_id", ownerId)
    .eq("liker_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("essentials_wall_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("essentials_wall_likes").insert({ essentials_owner_id: ownerId, liker_id: user.id });
  }

  const { count } = await supabase
    .from("essentials_wall_likes")
    .select("id", { count: "exact", head: true })
    .eq("essentials_owner_id", ownerId);

  return Response.json({ liked: !existing, count: count ?? 0 });
}
