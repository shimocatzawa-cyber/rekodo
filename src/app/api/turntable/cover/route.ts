import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const artist = (searchParams.get("artist") ?? "").trim();
  const album  = (searchParams.get("album")  ?? "").trim();
  if (!artist || !album) return NextResponse.json({ url: null });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) return NextResponse.json({ url: null });

  try {
    const q = `${artist} ${album}`;
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5&key=${key}&secret=${secret}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "rekodo/1.0 (rekodo.co)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ url: null });

    const data = await res.json() as {
      results?: Array<{ cover_image?: string; thumb?: string }>;
    };
    const cover = data.results?.[0]?.cover_image ?? data.results?.[0]?.thumb ?? null;
    return NextResponse.json({ url: cover });
  } catch {
    return NextResponse.json({ url: null });
  }
}
