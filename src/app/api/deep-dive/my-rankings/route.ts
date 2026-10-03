import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type RankingSlot = {
  position: number;
  album:    string;
  year:     number | null;
  coverUrl: string | null;
  note:     string | null;
};

function artistSlug(artist: string): string {
  return "ddrank-" + artist.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55);
}

async function getOrCreateList(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, artist: string) {
  const slug = artistSlug(artist);
  const { data: existing } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("lists")
    .insert({
      user_id:   userId,
      title:     `Top 5 ${artist} Albums`,
      slug,
      is_public: false,
      list_type: "top5",
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id as string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  if (!artist) return NextResponse.json({ rankings: [] });

  const slug = artistSlug(artist);
  const { data: list } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .maybeSingle();

  if (!list) return NextResponse.json({ rankings: [] });

  const { data: items } = await supabase
    .from("list_items")
    .select("position, song_album, song_year, song_cover_url, note")
    .eq("list_id", list.id)
    .order("position");

  const rankings: RankingSlot[] = (items ?? []).map(r => ({
    position: r.position as number,
    album:    (r.song_album as string | null) ?? "",
    year:     r.song_year as number | null,
    coverUrl: r.song_cover_url as string | null,
    note:     r.note as string | null,
  }));

  return NextResponse.json({ rankings });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { artist: string; rankings: RankingSlot[] };
  const { artist, rankings } = body;
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });

  const listId = await getOrCreateList(supabase, user.id, artist);
  if (!listId) return NextResponse.json({ error: "Could not create list" }, { status: 500 });

  // Replace all items for this list — delete then insert
  await supabase.from("list_items").delete().eq("list_id", listId);

  const filled = rankings.filter(r => r.album.trim());
  if (filled.length > 0) {
    await supabase.from("list_items").insert(
      filled.map(r => ({
        list_id:        listId,
        item_type:      "song" as const,
        position:       r.position,
        song_title:     r.album,
        song_album:     r.album,
        song_artist:    artist,
        song_year:      r.year,
        song_cover_url: r.coverUrl,
        note:           r.note?.trim() || null,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
