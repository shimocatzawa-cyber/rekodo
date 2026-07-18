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

async function probe(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 800); }
    return { status: res.status, body };
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
  try { password = decryptToken(profile.bandcamp_subsonic_token); }
  catch (e) { return NextResponse.json({ error: "Decrypt failed", detail: String(e) }); }

  const u = profile.bandcamp_subsonic_username;
  const BASE = "https://bandcamp.com/api/subsonic";

  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  const baseQs = new URLSearchParams({ u, t: token, s: salt, c: "Feishin", v: "1.16.1", f: "json" }).toString();
  const basicAuth = "Basic " + Buffer.from(`${u}:${password}`).toString("base64");
  const hexPass = Buffer.from(password).toString("hex");
  const plainQs = new URLSearchParams({ u, p: `enc:${hexPass}`, c: "Feishin", v: "1.16.1", f: "json" }).toString();

  const results: Record<string, unknown> = {};

  // User-Agent variations (Feishin, Amperfy, Submariner desktop/mobile UAs)
  const userAgents: Record<string, string> = {
    "Feishin desktop": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Feishin/10.6.2 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    "Amperfy iOS": "Amperfy/3.3.0 (iPhone; iOS 17.0; Scale/3.00)",
    "Submariner macOS": "Submariner/1.0 CFNetwork/1490.0.4 Darwin/23.2.0",
    "curl": "curl/8.1.2",
    "no UA": "",
  };

  for (const [label, ua] of Object.entries(userAgents)) {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (ua) h["User-Agent"] = ua;
    results[`UA:${label} md5`] = await probe(`${BASE}/ping?${baseQs}`, h);
  }

  // HTTP Basic Auth header (no query param auth)
  const basicQs = new URLSearchParams({ c: "Feishin", v: "1.16.1", f: "json" }).toString();
  results["Basic Auth header"] = await probe(`${BASE}/ping?${basicQs}`, { "Authorization": basicAuth });
  results["Basic Auth + Feishin UA"] = await probe(`${BASE}/ping?${basicQs}`, {
    "Authorization": basicAuth,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Feishin/10.6.2 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
  });

  // Bearer token
  results["Bearer token"] = await probe(`${BASE}/ping?${basicQs}`, { "Authorization": `Bearer ${password}` });

  // Password IS the token (pass directly as t= without salt)
  const directTokenQs = new URLSearchParams({ u, t: password, s: "", c: "Feishin", v: "1.16.1", f: "json" }).toString();
  results["password as t= directly"] = await probe(`${BASE}/ping?${directTokenQs}`);

  // Try XML format instead of JSON
  const xmlQs = new URLSearchParams({ u, t: token, s: salt, c: "Feishin", v: "1.16.1", f: "xml" }).toString();
  results["xml format"] = await probe(`${BASE}/ping?${xmlQs}`);

  // Try plain password directly (not hex-encoded)
  const rawPassQs = new URLSearchParams({ u, p: password, c: "Feishin", v: "1.16.1", f: "json" }).toString();
  results["p=rawPassword"] = await probe(`${BASE}/ping?${rawPassQs}`);

  return NextResponse.json({ u, passwordLength: password.length, results });
}
