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

async function probe(url: string): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

function qs(u: string, password: string, c: string, v: string, authType: "md5" | "plain" = "md5") {
  if (authType === "plain") {
    const hexPass = Buffer.from(password).toString("hex");
    return new URLSearchParams({ u, p: `enc:${hexPass}`, c, v, f: "json" }).toString();
  }
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  return new URLSearchParams({ u, t: token, s: salt, c, v, f: "json" }).toString();
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

  // Try Bandcamp's listed supported client names with multiple versions + auth types
  const clients = ["Feishin", "feishin", "Submariner", "submariner", "Amperfy", "amperfy", "DSub", "Symfonium"];
  const versions = ["1.16.1", "1.15.0", "1.14.0", "1.13.0", "1.12.0"];
  const results: Record<string, unknown> = {};

  for (const c of clients) {
    for (const v of versions) {
      const key = `${c} v${v} md5`;
      results[key] = await probe(`${BASE}/ping?${qs(u, password, c, v, "md5")}`);
      // Stop testing this client if we find a non-error response
      const r = results[key] as { body: { error?: boolean } };
      if (!r.body?.error) break;
    }
    // Also try plain auth with first version
    results[`${c} v1.16.1 plain`] = await probe(`${BASE}/ping?${qs(u, password, c, "1.16.1", "plain")}`);
  }

  // Also try raw password as p= (not hex-encoded) with Feishin
  const rawP = new URLSearchParams({ u, p: password, c: "Feishin", v: "1.16.1", f: "json" });
  results["Feishin v1.16.1 p=raw"] = await probe(`${BASE}/ping?${rawP}`);

  return NextResponse.json({ u, passwordLength: password.length, results });
}
