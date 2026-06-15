import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { listId } = await request.json().catch(() => ({})) as { listId?: string };
  if (!listId) return Response.json({ error: "listId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("saved_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("list_id", listId)
    .maybeSingle();

  if (existing) {
    await supabase.from("saved_lists").delete().eq("id", existing.id);
    return Response.json({ saved: false });
  }

  await supabase.from("saved_lists").insert({ user_id: user.id, list_id: listId });
  return Response.json({ saved: true });
}
