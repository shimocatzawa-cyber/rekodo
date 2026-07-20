import { type NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

const SLOT_COL: Record<string, string> = {
  photo1: "photo_1_url",
  photo2: "photo_2_url",
  poster: "poster_url",
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gigId } = await params;

  const { data: gig } = await (auth as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("gigs").select("id").eq("id", gigId).eq("user_id", user.id).maybeSingle();
  if (!gig) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const slot = (formData.get("slot") as string | null) ?? "photo1";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!SLOT_COL[slot]) return NextResponse.json({ error: "Invalid slot" }, { status: 400 });

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "JPEG, PNG or WebP only" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Max 10 MB" }, { status: 400 });

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ error: "Server config error" }, { status: 500 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${user.id}/${gigId}/${slot}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: upErr } = await sb.storage
    .from("gig-photos")
    .upload(storagePath, bytes, { upsert: true, contentType: file.type });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: { publicUrl } } = sb.storage.from("gig-photos").getPublicUrl(storagePath);
  const url = `${publicUrl}?v=${Date.now()}`;

  await (sb as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("gigs")
    .update({ [SLOT_COL[slot]]: url, updated_at: new Date().toISOString() })
    .eq("id", gigId);

  return NextResponse.json({ url });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gigId } = await params;
  const slot = new URL(request.url).searchParams.get("slot") ?? "photo1";
  if (!SLOT_COL[slot]) return NextResponse.json({ error: "Invalid slot" }, { status: 400 });

  const { data: gig } = await (auth as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("gigs").select("id").eq("id", gigId).eq("user_id", user.id).maybeSingle();
  if (!gig) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ error: "Server config error" }, { status: 500 });

  for (const ext of ["jpg", "png", "webp"]) {
    await sb.storage.from("gig-photos").remove([`${user.id}/${gigId}/${slot}.${ext}`]);
  }

  await (sb as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("gigs")
    .update({ [SLOT_COL[slot]]: null, updated_at: new Date().toISOString() })
    .eq("id", gigId);

  return NextResponse.json({ ok: true });
}
