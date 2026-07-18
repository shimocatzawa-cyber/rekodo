// Temporary diagnostic endpoint — admin only
import { NextResponse } from "next/server";
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

async function probe(url: string): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    return { status: res.status, body: await res.json() };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

export async function GET() {
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

  const u = profile.bandcamp_subsonic_username;
  const versions = ["1.16.1", "1.15.0", "1.14.0", "1.13.0", "1.12.0", "1.11.0", "1.10.2", "1.9.0", "1.8.0"];

  // Test MD5 token auth across all versions
  const md5Results: Record<string, unknown> = {};
  for (const v of versions) {
    const salt = randomBytes(8).toString("hex");
    const token = createHash("md5").update(password + salt).digest("hex");
    const p = new URLSearchParams({ u, t: token, s: salt, c: "rekodo", v, f: "json" });
    md5Results[v] = await probe(`${BASE}/ping?${p}`);
  }

  // Test plain-text hex-encoded auth (p=enc:...) with a few versions
  const plainResults: Record<string, unknown> = {};
  const hexPass = Buffer.from(password).toString("hex");
  for (const v of ["1.16.1", "1.14.0", "1.12.0", "1.8.0"]) {
    const p = new URLSearchParams({ u, p: `enc:${hexPass}`, c: "rekodo", v, f: "json" });
    plainResults[v] = await probe(`${BASE}/ping?${p}`);
  }

  // Also test without version param entirely
  const noVersion = await probe(`${BASE}/ping?${new URLSearchParams({ u, p: `enc:${hexPass}`, c: "rekodo", f: "json" })}`);
  const noVersionMd5 = (() => { const salt = randomBytes(8).toString("hex"); const token = createHash("md5").update(password + salt).digest("hex"); return probe(`${BASE}/ping?${new URLSearchParams({ u, t: token, s: salt, c: "rekodo", f: "json" })}`); })();

  return NextResponse.json({
    username: u,
    passwordLength: password.length,
    md5Results,
    plainResults,
    noVersion: await noVersion,
    noVersionMd5: await noVersionMd5,
  });
}
