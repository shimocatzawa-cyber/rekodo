import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return p?.role === "admin" ? user : null;
}

// GET — returns all published posts (authenticated users) or all posts (admin)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = p?.role === "admin";

  const params = new URL(request.url).searchParams;
  const all = params.get("all") === "1" && isAdmin;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("turntable_posts")
    .select("id, published_at, artist, album, cover_url, body, status")
    .order("published_at", { ascending: false });

  if (!all) q = q.eq("status", "published");

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

// POST — admin only: create a new post
export async function POST(request: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as {
    artist?: string; album?: string; cover_url?: string;
    body?: string; published_at?: string; status?: string;
  };

  const artist       = (body.artist       ?? "").trim();
  const album        = (body.album        ?? "").trim();
  const cover_url    = (body.cover_url    ?? "").trim() || null;
  const postBody     = (body.body         ?? "").trim();
  const published_at = (body.published_at ?? new Date().toISOString().slice(0, 10));
  const status       = body.status === "published" ? "published" : "draft";

  if (!artist || !album) return NextResponse.json({ error: "Artist and album are required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getAdminDb() as any)
    .from("turntable_posts")
    .insert({ artist, album, cover_url, body: postBody, published_at, status })
    .select("id, published_at, artist, album, cover_url, body, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// PATCH — admin only: update an existing post
export async function PATCH(request: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as {
    id?: string; artist?: string; album?: string; cover_url?: string;
    body?: string; published_at?: string; status?: string;
  };

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.artist       !== undefined) update.artist       = body.artist.trim();
  if (body.album        !== undefined) update.album        = body.album.trim();
  if (body.cover_url    !== undefined) update.cover_url    = body.cover_url.trim() || null;
  if (body.body         !== undefined) update.body         = body.body.trim();
  if (body.published_at !== undefined) update.published_at = body.published_at;
  if (body.status       !== undefined) update.status       = body.status === "published" ? "published" : "draft";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getAdminDb() as any)
    .from("turntable_posts")
    .update(update)
    .eq("id", id)
    .select("id, published_at, artist, album, cover_url, body, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// DELETE — admin only
export async function DELETE(request: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getAdminDb() as any).from("turntable_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
