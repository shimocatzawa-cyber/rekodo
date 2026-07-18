// Temporary diagnostic endpoint — admin only
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/subsonic-crypto";
import { createHash, randomBytes } from "crypto";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function probe(url: string, method = "GET"): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

function md5Params(u: string, password: string, v = "1.14.0", extra: Record<string, string> = {}) {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  return new URLSearchParams({ u, t: token, s: salt, c: "rekodo", v, f: "json", ...extra }).toString();
}

function plainParams(u: string, password: string, v = "1.14.0", extra: Record<string, string> = {}) {
  const hexPass = Buffer.from(password).toString("hex");
  return new URLSearchParams({ u, p: `enc:${hexPass}`, c: "rekodo", v, f: "json", ...extra }).toString();
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
  try { password = decryptToken(profile.bandcamp_subsonic_token); }
  catch (e) { return NextResponse.json({ error: "Decrypt failed", detail: String(e) }); }

  const u = profile.bandcamp_subsonic_username;

  // Try different URL structures Bandcamp might use
  const BASE = "https://bandcamp.com/api/subsonic";
  const results: Record<string, unknown> = {};

  // Standard: /method?...
  results["GET /ping md5"] = await probe(`${BASE}/ping?${md5Params(u, password)}`);
  results["GET /ping plain"] = await probe(`${BASE}/ping?${plainParams(u, password)}`);

  // With .view suffix (standard Subsonic REST)
  results["GET /ping.view md5"] = await probe(`${BASE}/ping.view?${md5Params(u, password)}`);

  // With /rest/ prefix
  results["GET /rest/ping md5"] = await probe(`${BASE}/rest/ping?${md5Params(u, password)}`);
  results["GET /rest/ping.view md5"] = await probe(`${BASE}/rest/ping.view?${md5Params(u, password)}`);

  // Username in path
  results[`GET /${u}/ping md5`] = await probe(`${BASE}/${u}/ping?${md5Params(u, password)}`);

  // POST variants
  results["POST /ping md5"] = await probe(`${BASE}/ping?${md5Params(u, password)}`, "POST");

  // Try swap: stored username used as password, password used as username
  results["GET /ping md5 SWAPPED"] = await probe(`${BASE}/ping?${md5Params(password, u)}`);
  results["GET /ping plain SWAPPED"] = await probe(`${BASE}/ping?${plainParams(password, u)}`);

  // Also probe top-level URL to see what's there
  results["GET / (base)"] = await probe(BASE);

  return NextResponse.json({ storedUsername: u, passwordLength: password.length, results });
}
