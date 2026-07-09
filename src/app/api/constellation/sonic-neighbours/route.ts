import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    styles?: string[];
    excludeArtists?: string[];
    limit?: number;
  };

  const styles  = Array.isArray(body.styles) ? body.styles : [];
  const exclude = Array.isArray(body.excludeArtists) ? body.excludeArtists : [];
  const limit   = typeof body.limit === "number" ? Math.min(body.limit, 100) : 40;

  if (styles.length === 0) return NextResponse.json({ neighbours: [] });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_sonic_neighbours`, {
    method: "POST",
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_styles: styles, p_exclude_artists: exclude, p_limit: limit }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[sonic-neighbours]", res.status, text);
    return NextResponse.json({ error: text }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ neighbours: data ?? [] });
}
