import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/subsonic-crypto";
import { createHash, randomBytes } from "crypto";

export const maxDuration = 60;

const BASE = "https://bandcamp.com/api/subsonic";

type SubsonicAlbum = {
  id: string;
  name: string;
  artist: string;
  year?: number;
  genre?: string;
  duration?: number;
  songCount?: number;
};

function buildAuth(username: string, password: string): Record<string, string> {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(password + salt).digest("hex");
  return { u: username, t: token, s: salt, c: "rekodo", v: "1.16.1", f: "json" };
}

async function fetchSubsonic<T>(
  method: string,
  username: string,
  password: string,
  extra: Record<string, string> = {}
): Promise<T | null> {
  const params = new URLSearchParams({ ...buildAuth(username, password), ...extra });
  const res = await fetch(`${BASE}/${method}?${params}`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json() as { "subsonic-response"?: Record<string, unknown> & { status?: string } };
  const resp = json["subsonic-response"];
  if (!resp || resp.status !== "ok") return null;
  // e.g. "getAlbumList2" → key "albumList2"
  const key = method.charAt(0).toLowerCase() + method.slice(1);
  return (resp[key] as T) ?? null;
}

export async function POST(_request: NextRequest) {
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
    return NextResponse.json({ error: "Bandcamp Subsonic credentials not configured" }, { status: 400 });
  }

  let password: string;
  try {
    password = decryptToken(profile.bandcamp_subsonic_token);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt credentials — re-enter them in Digital settings" }, { status: 500 });
  }

  const username = profile.bandcamp_subsonic_username;

  // Fetch all albums across pages
  const allAlbums: SubsonicAlbum[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const list = await fetchSubsonic<{ album?: SubsonicAlbum[] }>(
      "getAlbumList2",
      username,
      password,
      { type: "alphabeticalByName", size: String(pageSize), offset: String(offset) }
    );
    const page = list?.album ?? [];
    allAlbums.push(...page);
    if (page.length < pageSize) break;
  }

  if (allAlbums.length === 0) {
    return NextResponse.json({ synced: 0, message: "No albums returned from Bandcamp Subsonic — check credentials" });
  }

  // Clear previous Subsonic-sourced rows for this user, then bulk insert fresh data
  await supabase
    .from("digital_imports")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "bandcamp-subsonic");

  const rows = allAlbums.map((a) => ({
    user_id: user.id,
    source: "bandcamp-subsonic",
    artist: a.artist,
    album: a.name,
    subsonic_id: a.id,
    release_date: a.year ? String(a.year) : null,
    label: null,
    tags: a.genre ? [a.genre] : [],
    is_duplicate: false,
  }));

  // Insert in batches of 200 to stay well under PostgREST limits
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from("digital_imports").insert(rows.slice(i, i + BATCH));
    if (!error) inserted += Math.min(BATCH, rows.length - i);
  }

  // Update last-sync timestamp
  await supabase
    .from("profiles")
    .update({ bandcamp_subsonic_synced_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ synced: inserted });
}
