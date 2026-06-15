import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { recordId } = await request.json().catch(() => ({})) as { recordId?: string };
  if (!recordId) return Response.json({ error: "recordId required" }, { status: 400 });

  // Find or create the user's wantlist
  let { data: wantlist } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", "wantlist")
    .maybeSingle();

  if (!wantlist) {
    const { data: created } = await supabase
      .from("lists")
      .insert({ user_id: user.id, title: "Wantlist", slug: "wantlist", is_public: true, list_type: "personal" })
      .select("id")
      .maybeSingle();
    wantlist = created;
  }

  if (!wantlist) return Response.json({ error: "Could not find or create wantlist" }, { status: 500 });

  // Idempotent — already in wantlist is fine
  const { data: existing } = await supabase
    .from("list_items")
    .select("id")
    .eq("list_id", wantlist.id)
    .eq("record_id", recordId)
    .maybeSingle();

  if (existing) return Response.json({ added: false, alreadyInWantlist: true });

  const { data: lastItem } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", wantlist.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("list_items")
    .insert({ list_id: wantlist.id, record_id: recordId, position: (lastItem?.position ?? 0) + 1 });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ added: true });
}
