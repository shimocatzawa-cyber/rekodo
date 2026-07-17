import { type NextRequest, NextResponse } from "next/server";
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

export const maxDuration = 60;

const BASE = "https://bandcamp.com/api/subsonic";

type SubsonicAlbum = {
  id: string;
  name: string;
  artist: string;
  year?: number;
  genre?: string;
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
  // Subsonic response keys drop the "get" prefix: getAlbumList2 → albumList2
  const key = method.replace(/^get([A-Z])/, (_: string, c: string) => c.toLowerCase());
  return (resp[key] as T) ?? null;
}

function normalizeKey(artist: string, album: string): string {
  return `${artist.toLowerCase().replace(/\s+/g, " ").trim()}||${album.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin role via session client (no sensitive data)
  const { data: roleCheck } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (roleCheck?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Read credentials via service role — bandcamp_subsonic_token is never granted to authenticated
  const svc = serviceRole();
  const { data: profile } = await svc
    .from("profiles")
    .select("bandcamp_subsonic_username, bandcamp_subsonic_token")
    .eq("id", user.id)
    .maybeSingle();

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

  // Fetch existing scraper rows so we can match and update subsonic_id in-place
  const { data: existingRows } = await svc
    .from("digital_imports")
    .select("id, artist, album")
    .eq("user_id", user.id)
    .eq("source", "bandcamp");

  // Build lookup: normalized artist+album → row id
  const scraperMap = new Map<string, string>();
  for (const row of existingRows ?? []) {
    scraperMap.set(normalizeKey(row.artist, row.album), row.id);
  }

  // Partition subsonic albums: matched (update existing row) vs unmatched (insert new)
  const toUpdate: Array<{ id: string; subsonic_id: string }> = [];
  const toInsert: Array<Record<string, unknown>> = [];

  for (const a of allAlbums) {
    const key = normalizeKey(a.artist, a.name);
    const existingId = scraperMap.get(key);
    if (existingId) {
      toUpdate.push({ id: existingId, subsonic_id: a.id });
    } else {
      toInsert.push({
        user_id: user.id,
        source: "bandcamp-subsonic",
        artist: a.artist,
        album: a.name,
        subsonic_id: a.id,
        release_date: a.year ? String(a.year) : null,
        tags: a.genre ? [a.genre] : [],
        is_duplicate: false,
      });
    }
  }

  // Clear subsonic_id on existing bandcamp rows (so stale matches are reset)
  await svc
    .from("digital_imports")
    .update({ subsonic_id: null })
    .eq("user_id", user.id)
    .eq("source", "bandcamp");

  // Update matched rows with their subsonic_id (20 concurrent)
  const CONCURRENCY = 20;
  for (let i = 0; i < toUpdate.length; i += CONCURRENCY) {
    await Promise.all(
      toUpdate.slice(i, i + CONCURRENCY).map(({ id, subsonic_id }) =>
        svc.from("digital_imports").update({ subsonic_id }).eq("id", id)
      )
    );
  }

  // Replace unmatched bandcamp-subsonic rows
  await svc
    .from("digital_imports")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "bandcamp-subsonic");

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await svc.from("digital_imports").insert(toInsert.slice(i, i + BATCH));
    if (!error) inserted += Math.min(BATCH, toInsert.length - i);
  }

  // Update last-sync timestamp
  await svc
    .from("profiles")
    .update({ bandcamp_subsonic_synced_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ synced: toUpdate.length + inserted });
}
