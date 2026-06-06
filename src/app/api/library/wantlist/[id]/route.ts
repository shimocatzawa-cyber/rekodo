import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH — update status of a wantlist item
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!status || !["saved", "in_progress", "done"].includes(status)) {
    return Response.json({ error: "Valid status required: saved | in_progress | done" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("library_wantlist")
    .update({
      status: status as "saved" | "in_progress" | "done",
      actioned_at: status !== "saved" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Item not found" }, { status: 404 });
  return Response.json({ item: data });
}

// DELETE — remove a wantlist item
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("library_wantlist")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
