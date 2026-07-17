import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { encryptToken } from "@/lib/subsonic-crypto";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { username?: string; password?: string };
  const username = body.username?.trim();
  const password = body.password?.trim();
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(password);
  } catch (err) {
    console.error("[digital/credentials] encryption failed:", (err as Error).message);
    return NextResponse.json({ error: "Encryption key not configured on server" }, { status: 500 });
  }

  const { error } = await serviceRole()
    .from("profiles")
    .update({ bandcamp_subsonic_username: username, bandcamp_subsonic_token: encrypted })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await serviceRole()
    .from("profiles")
    .update({ bandcamp_subsonic_username: null, bandcamp_subsonic_token: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
