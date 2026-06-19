import { type NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG and WebP are supported." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 400 });
  }

  const sb = getServiceClient();
  if (!sb) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const storagePath = `${user.id}/1.jpg`;
  const bytes = await file.arrayBuffer();

  const { error: upErr } = await sb.storage
    .from("collection-photos")
    .upload(storagePath, bytes, { upsert: true, contentType: file.type });

  if (upErr) {
    console.error("[collection-photo] storage upload failed:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = sb.storage
    .from("collection-photos")
    .getPublicUrl(storagePath);

  const { error: dbErr } = await sb
    .from("collection_photos")
    .upsert(
      { user_id: user.id, storage_path: storagePath, display_order: 1 },
      { onConflict: "user_id,display_order" }
    );

  if (dbErr) {
    console.error("[collection-photo] db upsert failed:", dbErr);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ publicUrl: `${publicUrl}?v=${Date.now()}` });
}

export async function DELETE() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  if (!sb) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const storagePath = `${user.id}/1.jpg`;

  await sb.storage.from("collection-photos").remove([storagePath]);
  await sb.from("collection_photos").delete().eq("user_id", user.id).eq("display_order", 1);

  return NextResponse.json({ ok: true });
}
