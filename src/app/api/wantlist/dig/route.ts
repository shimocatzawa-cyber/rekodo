import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let artist: string, album: string, year: number | null;
  try {
    const body = await req.json();
    artist = String(body.artist ?? "").trim();
    album  = String(body.album  ?? "").trim();
    year   = body.year != null ? Number(body.year) : null;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!artist || !album) {
    return Response.json({ error: "artist and album are required" }, { status: 400 });
  }

  // ── 1. Find wantlist ────────────────────────────────────────────────────────
  const { data: lists, error: listErr } = await supabase
    .from("lists")
    .select("id, slug, title")
    .eq("user_id", user.id)
    .in("slug", ["wantlist", "want-to-buy"]);

  if (listErr) {
    return Response.json({ error: `Wantlist lookup failed: ${listErr.message}` }, { status: 500 });
  }

  let wantlistId: string;

  if (!lists?.length) {
    const { data: created, error: createErr } = await supabase
      .from("lists")
      .insert({ user_id: user.id, title: "Wantlist", slug: "wantlist", is_public: false, list_type: "personal" })
      .select("id")
      .single();

    if (createErr || !created) {
      return Response.json({ error: `Could not create wantlist: ${createErr?.message ?? "unknown"}` }, { status: 500 });
    }
    wantlistId = created.id;
  } else {
    wantlistId = lists[0].id;
  }

  // ── 2. Get next position ────────────────────────────────────────────────────
  const { data: posRow, error: posErr } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", wantlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (posErr) {
    return Response.json({ error: `Position lookup failed: ${posErr.message}`, wantlistId }, { status: 500 });
  }

  const nextPos = (posRow?.position ?? 0) + 1;

  // ── 3. Insert ───────────────────────────────────────────────────────────────
  const { error: insertErr } = await supabase
    .from("list_items")
    .insert({
      list_id:     wantlistId,
      position:    nextPos,
      item_type:   "song",
      song_title:  album,
      song_artist: artist,
      song_album:  album,
      song_year:   year,
      source:      "dig",
    });

  if (insertErr) {
    return Response.json({
      error:      insertErr.message,
      code:       (insertErr as { code?: string }).code ?? null,
      wantlistId,
      nextPos,
      artist,
      album,
    }, { status: 500 });
  }

  return Response.json({ success: true, wantlistId, position: nextPos });
}
