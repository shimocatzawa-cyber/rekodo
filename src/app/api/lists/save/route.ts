import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let listId: string | undefined;
  try {
    const body = await request.json();
    listId = typeof body?.listId === "string" ? body.listId : undefined;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!listId) return Response.json({ error: "listId required" }, { status: 400 });

  // Check if already saved
  const { data: existing, error: selectError } = await supabase
    .from("saved_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("list_id", listId)
    .maybeSingle();

  if (selectError) {
    return Response.json({ error: selectError.message }, { status: 500 });
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("saved_lists").delete().eq("id", existing.id);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
    return Response.json({ saved: false });
  }

  const { error: insertError } = await supabase
    .from("saved_lists").insert({ user_id: user.id, list_id: listId });
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  return Response.json({ saved: true });
}
