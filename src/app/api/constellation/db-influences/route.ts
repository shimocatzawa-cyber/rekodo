import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/app/admin/lib";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { artists?: string[] };
  const artists = Array.isArray(body.artists) ? body.artists : [];
  if (artists.length === 0) return NextResponse.json({ rows: [] });

  const db = getAdminDb();

  // Fetch in a single query using raw SQL to avoid generated-types mismatch
  // while the migration is pending on the remote instance.
  const { data, error } = await db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("artist_influences" as any)
    .select("source_artist, target_artist, type, note, via")
    .or(`source_artist.in.(${artists.map(a => `"${a}"`).join(",")}),target_artist.in.(${artists.map(a => `"${a}"`).join(",")})`)
    .limit(500);

  if (error) {
    // Table may not exist yet — return empty gracefully
    if (error.code === "42P01") return NextResponse.json({ rows: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
