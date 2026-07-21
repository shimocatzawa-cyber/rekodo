import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await db
    .from("gigs")
    .select(`
      id, date, venue, city, country, journal_entry, rating,
      setlist_fm_id, setlist_source,
      photo_1_url, photo_2_url, poster_url,
      highlight_moment, highlight_best_song, highlight_sound,
      start_time, duration,
      created_at, updated_at,
      gig_artists ( id, artist_name, is_headliner ),
      gig_setlist_songs ( id, position, song_title, set_label )
    `)
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Supabase returns nested tables using their table name as the key.
  // Remap to the shape the client expects.
  const gigs = (data ?? []).map((g: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    ...g,
    artists: g.gig_artists   ?? [],
    songs:   g.gig_setlist_songs ?? [],
  }));

  return NextResponse.json({ gigs });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.date) return NextResponse.json({ error: "Date required" }, { status: 400 });

  const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { artists = [], songs = [] } = body;

  const { data: gig, error: gigErr } = await db
    .from("gigs")
    .insert({
      user_id:       user.id,
      date:          body.date,
      venue:         body.venue         || null,
      city:          body.city          || null,
      country:       body.country       || null,
      journal_entry: body.journal_entry || null,
      rating:               body.rating               || null,
      setlist_fm_id:        body.setlist_fm_id        || null,
      setlist_source:       body.setlist_source       || "none",
      highlight_moment:     body.highlight_moment     || null,
      highlight_best_song:  body.highlight_best_song  || null,
      highlight_sound:      body.highlight_sound      || null,
      start_time:           body.start_time           || null,
      duration:             body.duration             || null,
    })
    .select("id")
    .single();

  if (gigErr || !gig) return NextResponse.json({ error: gigErr?.message ?? "Insert failed" }, { status: 500 });

  if (artists.length > 0) {
    await db.from("gig_artists").insert(
      artists.map((a: { name: string; is_headliner: boolean }) => ({
        gig_id: gig.id, artist_name: a.name.trim(), is_headliner: a.is_headliner,
      }))
    );
  }

  if (songs.length > 0) {
    await db.from("gig_setlist_songs").insert(
      songs.map((s: { title: string; setLabel: string }, i: number) => ({
        gig_id: gig.id, position: i + 1, song_title: s.title, set_label: s.setLabel || "Main Set",
      }))
    );
  }

  return NextResponse.json({ id: gig.id });
}
