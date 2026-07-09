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
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image too large" }, { status: 400 });

  const sb = getServiceClient();
  if (!sb) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const storagePath = `${user.id}/${Date.now()}.png`;
  const bytes = await file.arrayBuffer();

  // Ensure the bucket exists (creates it on first use)
  const BUCKET = "shelf_posts";
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = (buckets ?? []).some((b: { name: string }) => b.name === BUCKET);
  if (!exists) {
    const { error: createErr } = await sb.storage.createBucket(BUCKET, { public: true });
    if (createErr) {
      console.error("[shelf/share] bucket create failed:", createErr);
      return NextResponse.json({ error: `Could not create storage bucket: ${createErr.message}` }, { status: 500 });
    }
  }

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: "image/png" });

  if (upErr) {
    console.error("[shelf/share] storage upload failed:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data, error: dbErr } = await sb
    .from("shelf_posts")
    .insert({ user_id: user.id, image_url: publicUrl, storage_path: storagePath })
    .select("id")
    .single();

  if (dbErr) {
    console.error("[shelf/share] db insert failed:", dbErr);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, imageUrl: publicUrl });
}
