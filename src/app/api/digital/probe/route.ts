// Temporary diagnostic endpoint — admin only
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

function buildParams(username: string, password: string, version: string, extra: Record<string, string> = {}) {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  return new URLSearchParams({ u: username, t: token, s: salt, c: "rekodo", v: version, f: "json", ...extra });
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

  const username = profile.bandcamp_subsonic_username;

  // Try ping with multiple versions to find what Bandcamp accepts
  const versions = ["1.16.1", "1.15.0", "1.14.0", "1.13.0", "1.12.0", "1.11.0", "1.10.2", "1.9.0", "1.8.0"];
  const pingResults: Record<string, unknown> = {};

  for (const v of versions) {
    try {
      const res = await fetch(`${BASE}/ping?${buildParams(username, password, v)}`, {
        signal: AbortSignal.timeout(8_000), cache: "no-store",
      });
      pingResults[v] = await res.json();
    } catch (e) {
      pingResults[v] = { fetchError: String(e) };
    }
  }

  // Also try getAlbumList2 with the first version that isn't a "bad version" error
  const workingVersion = versions.find(v => {
    const r = pingResults[v] as Record<string, unknown>;
    return r && !r.error && (r["subsonic-response"] as Record<string, unknown>)?.status === "ok";
  });

  let albumSample: unknown = null;
  if (workingVersion) {
    try {
      const res = await fetch(
        `${BASE}/getAlbumList2?${buildParams(username, password, workingVersion, { type: "alphabeticalByName", size: "3", offset: "0" })}`,
        { signal: AbortSignal.timeout(10_000), cache: "no-store" }
      );
      albumSample = await res.json();
    } catch (e) {
      albumSample = { fetchError: String(e) };
    }
  }

  return NextResponse.json({ username, pingResults, workingVersion, albumSample });
}
