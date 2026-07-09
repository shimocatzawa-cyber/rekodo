import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/app/admin/lib";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    styles?: string[];
    excludeArtists?: string[];
    limit?: number;
  };

  const styles  = Array.isArray(body.styles) ? body.styles : [];
  const exclude = Array.isArray(body.excludeArtists) ? body.excludeArtists : [];
  const limit   = typeof body.limit === "number" ? Math.min(body.limit, 100) : 40;

  if (styles.length === 0) {
    return NextResponse.json({ neighbours: [] });
  }

  const db = getAdminDb();

  const { data, error } = await db.rpc("get_sonic_neighbours", {
    p_styles:          styles,
    p_exclude_artists: exclude,
    p_limit:           limit,
  });

  if (error) {
    console.error("[sonic-neighbours]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ neighbours: data ?? [] });
}
