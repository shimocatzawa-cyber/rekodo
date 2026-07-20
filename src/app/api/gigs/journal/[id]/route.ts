import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: existing } = await db
    .from("gigs").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { artists, songs } = body;

  await db.from("gigs").update({
    date:          body.date,
    venue:         body.venue         || null,
    city:          body.city          || null,
    country:       body.country       || null,
    journal_entry: body.journal_entry || null,
    rating:        body.rating        || null,
    setlist_fm_id: body.setlist_fm_id || null,
    setlist_source: body.setlist_source || "none",
    photo_1_url:   body.photo_1_url   ?? null,
    photo_2_url:   body.photo_2_url   ?? null,
    poster_url:    body.poster_url    ?? null,
    updated_at:    new Date().toISOString(),
  }).eq("id", id);

  if (artists !== undefined) {
    await db.from("gig_artists").delete().eq("gig_id", id);
    if (artists.length > 0) {
      await db.from("gig_artists").insert(
        artists.map((a: { name: string; is_headliner: boolean }) => ({
          gig_id: id, artist_name: a.name.trim(), is_headliner: a.is_headliner,
        }))
      );
    }
  }

  if (songs !== undefined) {
    await db.from("gig_setlist_songs").delete().eq("gig_id", id);
    if (songs.length > 0) {
      await db.from("gig_setlist_songs").insert(
        songs.map((s: { title: string; setLabel: string }, i: number) => ({
          gig_id: id, position: i + 1, song_title: s.title, set_label: s.setLabel || "Main Set",
        }))
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { error } = await db.from("gigs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
