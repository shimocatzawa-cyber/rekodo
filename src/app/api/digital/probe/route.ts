// Temporary diagnostic endpoint — admin only, returns raw Subsonic API response
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/subsonic-crypto";
import { createHash, randomBytes } from "crypto";

const BASE = "https://bandcamp.com/api/subsonic";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleCheck } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleCheck?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profile } = await serviceRole()
    .from("profiles")
    .select("bandcamp_subsonic_username, bandcamp_subsonic_token")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bandcamp_subsonic_username || !profile?.bandcamp_subsonic_token) {
    return NextResponse.json({ error: "No credentials stored" });
  }

  let password: string;
  try {
    password = decryptToken(profile.bandcamp_subsonic_token);
  } catch (e) {
    return NextResponse.json({ error: "Decrypt failed", detail: String(e) });
  }

  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  const params = new URLSearchParams({
    u: profile.bandcamp_subsonic_username,
    t: token, s: salt, c: "rekodo", v: "1.16.1", f: "json",
    type: "alphabeticalByName", size: "5", offset: "0",
  });

  const url = `${BASE}/getAlbumList2?${params}`;
  let raw: unknown;
  let httpStatus: number;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    httpStatus = res.status;
    raw = await res.json();
  } catch (e) {
    return NextResponse.json({ error: "Fetch failed", detail: String(e) });
  }

  return NextResponse.json({ httpStatus, username: profile.bandcamp_subsonic_username, raw });
}
