import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/subsonic-crypto";
import { createHash, randomBytes } from "crypto";

export const maxDuration = 60;

const BASE = "https://bandcamp.com/api/subsonic";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function buildAuth(username: string, password: string): Record<string, string> {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  return { u: username, t: token, s: salt, c: "rekodo", v: "1.16.1", f: "json" };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Role check via session client (role column is granted to authenticated)
  const { data: roleCheck } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (roleCheck?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  // Credentials via service role — bandcamp_subsonic_token is not granted to authenticated
  const { data: profile } = await serviceRole()
    .from("profiles")
    .select("bandcamp_subsonic_username, bandcamp_subsonic_token")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bandcamp_subsonic_username || !profile?.bandcamp_subsonic_token) {
    return new NextResponse("Not connected", { status: 400 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });

  let password: string;
  try {
    password = decryptToken(profile.bandcamp_subsonic_token);
  } catch {
    return new NextResponse("Credential decryption failed", { status: 500 });
  }

  const params = new URLSearchParams({
    ...buildAuth(profile.bandcamp_subsonic_username, password),
    id,
    format: "mp3",
    maxBitRate: "320",
  });

  const upstream = await fetch(`${BASE}/stream?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Stream unavailable", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    },
  });
}
