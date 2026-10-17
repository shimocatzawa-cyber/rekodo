import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type DiscogsTrack = { position: string; title: string; duration: string; type_: string };

// Fetches a Discogs tracklist and persists it to records.discogs_tracks.
// Called lazily the first time a user expands an album in the mixtape.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { discogs_id, record_id } = await request.json() as { discogs_id: string; record_id: string };
  if (!discogs_id || !record_id) {
    return NextResponse.json({ error: "discogs_id and record_id required" }, { status: 400 });
  }

  // Check if already stored — avoid redundant Discogs call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: existing } = await db
    .from("records")
    .select("discogs_tracks")
    .eq("id", record_id)
    .maybeSingle();

  if (existing?.discogs_tracks?.length) {
    return NextResponse.json({ tracks: existing.discogs_tracks as DiscogsTrack[] });
  }

  // Fetch from Discogs
  const key = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "Discogs not configured" }, { status: 500 });
  }

  const url = `https://api.discogs.com/releases/${encodeURIComponent(discogs_id)}?key=${key}&secret=${secret}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "rekodo/1.0" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Discogs fetch failed", status: res.status }, { status: 502 });
  }

  const data = await res.json() as {
    tracklist?: Array<{ position?: string; title?: string; duration?: string; type_?: string }>;
  };

  const tracks: DiscogsTrack[] = (data.tracklist ?? [])
    .filter(t => t.type_ !== "heading")
    .map(t => ({
      position: t.position ?? "",
      title: t.title ?? "",
      duration: t.duration ?? "",
      type_: t.type_ ?? "track",
    }));

  if (tracks.length > 0) {
    // Persist using service role — records is a shared table (no per-user RLS write)
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    await admin.from("records").update({ discogs_tracks: tracks }).eq("id", record_id);
  }

  return NextResponse.json({ tracks });
}
