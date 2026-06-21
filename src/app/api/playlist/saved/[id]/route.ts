import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SpotifyTrackJson = { spotify_uri: string; title: string; duration_ms: number; preview_url: string | null };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: list } = await db
    .from("lists").select("id, title").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: items } = await db
    .from("list_items")
    .select("song_title, song_artist, song_album, song_cover_url, song_year, spotify_tracks")
    .eq("list_id", id).eq("item_type", "song")
    .order("position", { ascending: true });

  const tracks = ((items ?? []) as Array<{
    song_title: string; song_artist: string; song_album: string;
    song_cover_url: string | null; song_year: number | null;
    spotify_tracks: SpotifyTrackJson[] | null;
  }>)
    .filter((i) => i.spotify_tracks?.[0]?.spotify_uri)
    .map((i) => {
      const t = i.spotify_tracks![0];
      return {
        spotify_uri: t.spotify_uri, artist: i.song_artist, title: i.song_title, album: i.song_album,
        year: i.song_year, cover_url: i.song_cover_url, duration_ms: t.duration_ms,
        preview_url: t.preview_url, rationale: "", source: "collection" as const,
      };
    });

  return NextResponse.json({ title: list.title, tracks });
}
