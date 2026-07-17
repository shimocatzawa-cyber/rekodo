import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/subsonic-crypto";
import { createHash, randomBytes } from "crypto";

const BASE = "https://bandcamp.com/api/subsonic";

function buildAuth(username: string, password: string): Record<string, string> {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  return { u: username, t: token, s: salt, c: "rekodo", v: "1.16.1", f: "json" };
}

export type TrackItem = { id: string; n: number; title: string; dur: number };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, bandcamp_subsonic_username, bandcamp_subsonic_token")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile?.bandcamp_subsonic_username || !profile?.bandcamp_subsonic_token) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let password: string;
  try {
    password = decryptToken(profile.bandcamp_subsonic_token);
  } catch {
    return NextResponse.json({ error: "Credential decryption failed" }, { status: 500 });
  }

  const params = new URLSearchParams({
    ...buildAuth(profile.bandcamp_subsonic_username, password),
    id,
  });

  const res = await fetch(`${BASE}/getAlbum?${params}`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "Subsonic error" }, { status: 502 });

  const json = await res.json() as {
    "subsonic-response"?: {
      status?: string;
      album?: {
        song?: { id: string; track?: number; title: string; duration?: number }[];
      };
    };
  };
  const resp = json["subsonic-response"];
  if (resp?.status !== "ok" || !resp?.album) {
    return NextResponse.json({ error: "No album data" }, { status: 502 });
  }

  const tracks: TrackItem[] = (resp.album.song ?? []).map((s, i) => ({
    id: s.id,
    n: s.track ?? i + 1,
    title: s.title,
    dur: s.duration ?? 0,
  }));

  return NextResponse.json(
    { tracks },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
