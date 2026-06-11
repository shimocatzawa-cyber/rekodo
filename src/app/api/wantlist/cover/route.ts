import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const releaseId = req.nextUrl.searchParams.get("release_id");
  if (!releaseId || isNaN(Number(releaseId))) {
    return Response.json({ error: "Missing release_id" }, { status: 400 });
  }

  // Auth — must be logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const releaseIdNum = Number(releaseId);

  // Check if any wantlist row already has a cached cover URL for this release
  const { data: cached } = await supabase
    .from("wantlist")
    .select("cover_image_url")
    .eq("discogs_release_id", releaseIdNum)
    .not("cover_image_url", "is", null)
    .limit(1)
    .maybeSingle();

  if (cached?.cover_image_url) {
    return Response.json({ url: cached.cover_image_url });
  }

  // Fetch from Discogs using key+secret
  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) {
    return Response.json({ error: "Discogs not configured" }, { status: 500 });
  }

  let coverUrl: string | null = null;
  try {
    const url = `https://api.discogs.com/releases/${releaseIdNum}?key=${key}&secret=${secret}`;
    const res = await fetch(url, { headers: { "User-Agent": "rekodo/1.0" } });
    if (res.ok) {
      const data = await res.json() as { images?: Array<{ uri?: string }> };
      coverUrl = data.images?.[0]?.uri ?? null;
    }
  } catch {
    return Response.json({ error: "Discogs fetch failed" }, { status: 502 });
  }

  if (!coverUrl) {
    return Response.json({ url: null });
  }

  // Write back to all wantlist rows with this release_id (service role to bypass per-user RLS)
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (svcKey && svcUrl) {
    const adminDb = createServiceClient(svcUrl, svcKey);
    await adminDb
      .from("wantlist")
      .update({ cover_image_url: coverUrl })
      .eq("discogs_release_id", releaseIdNum)
      .is("cover_image_url", null);
  }

  return Response.json({ url: coverUrl });
}
