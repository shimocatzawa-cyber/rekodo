import { type NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function verifyAdmin() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return p?.role === "admin" ? user : null;
}

export async function POST(request: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string | null) ?? "artwork";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG and WebP are supported." }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });
  }

  const sb = getServiceClient();
  if (!sb) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const ext       = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const folder    = type === "vinyl" ? "vinyl" : "artwork";
  const path      = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bytes     = await file.arrayBuffer();

  const { error: upErr } = await sb.storage
    .from("turntable-photos")
    .upload(path, bytes, { upsert: false, contentType: file.type });

  if (upErr) {
    console.error("[turntable-photo] upload error:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = sb.storage
    .from("turntable-photos")
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
