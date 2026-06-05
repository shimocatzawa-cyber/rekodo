"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function enforceTop5(raw: string): string {
  const t = raw.trim();
  return /^top\s+5\s+/i.test(t) ? t : `Top 5 ${t}`;
}

function slugify(title: string, maxLen = 60): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen) || "list";
}

async function assertListOwner(supabase: Awaited<ReturnType<typeof createClient>>, listId: string, userId: string) {
  // Select only `id` — avoids failing when list_type column hasn't been migrated yet.
  const { data } = await supabase
    .from("lists").select("id").eq("id", listId).eq("user_id", userId).maybeSingle();
  return data;
}

// ─── Create list ───────────────────────────────────────────────────────────────

export async function createList(
  title: string,
  listType: "top5" | "personal" = "top5"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const normalizedTitle =
    listType === "top5" ? enforceTop5(title) : title.trim() || "My List";

  const baseSlug = slugify(normalizedTitle);

  const { data: existing } = await supabase
    .from("lists").select("slug").eq("user_id", user.id).like("slug", `${baseSlug}%`);

  const finalSlug =
    existing && existing.length > 0 ? `${baseSlug}-${existing.length + 1}` : baseSlug;

  const { data, error } = await supabase
    .from("lists")
    .insert({
      user_id: user.id,
      title: normalizedTitle,
      slug: finalSlug,
      is_public: listType === "top5",
      list_type: listType,
    })
    .select("id, title, slug, is_public, list_type")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/lists");
  return { success: true, list: data };
}

// ─── Set record in a specific slot (Top 5) ─────────────────────────────────────

export async function setListRecord(listId: string, position: number, recordId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  // Delete any existing row at this position, then insert fresh.
  // Avoids relying on the unique constraint for upsert ON CONFLICT behaviour.
  await supabase.from("list_items").delete().eq("list_id", listId).eq("position", position);

  const { data: written, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, record_id: recordId, position })
    .select("id");

  if (error) return { error: error.message };
  if (!written?.length) return { error: "Save failed — no rows written" };

  revalidatePath("/lists");
  return { success: true };
}

// ─── Add Discogs record to a slot ──────────────────────────────────────────────

export interface DiscogsPayload {
  discogs_id: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  label: string | null;
}

export async function addDiscogsRecordToList(
  listId: string,
  position: number,
  payload: DiscogsPayload
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  // Find or create the record
  let recordId: string;
  const { data: existing } = await supabase
    .from("records").select("id").eq("discogs_id", payload.discogs_id).maybeSingle();

  if (existing) {
    recordId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("records")
      .insert({
        discogs_id: payload.discogs_id,
        artist: payload.artist,
        album: payload.album,
        year: payload.year,
        genre: payload.genre,
        cover_url: payload.cover_url,
        label: payload.label,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      const { data: raceWinner } = await supabase
        .from("records").select("id").eq("discogs_id", payload.discogs_id).maybeSingle();
      if (!raceWinner) return { error: insertErr?.message ?? "Record insert failed" };
      recordId = raceWinner.id;
    } else {
      recordId = inserted.id;
    }
  }

  await supabase.from("list_items").delete().eq("list_id", listId).eq("position", position);

  const { data: written, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, record_id: recordId, position })
    .select("id");

  if (error) return { error: error.message };
  if (!written?.length) return { error: "Save failed — no rows written" };

  revalidatePath("/lists");
  return {
    success: true,
    item: {
      id: recordId,
      item_type: "record" as const,
      artist: payload.artist,
      album: payload.album,
      year: payload.year,
      genre: payload.genre,
      cover_url: payload.cover_url,
      song_title: null,
    },
  };
}

// ─── Add song to a slot ────────────────────────────────────────────────────────

export interface SongPayload {
  song_title: string;
  song_artist: string;
  song_album: string;
  song_cover_url: string | null;
  song_year: number | null;
}

export async function addSongToList(
  listId: string,
  position: number,
  payload: SongPayload
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  await supabase.from("list_items").delete().eq("list_id", listId).eq("position", position);

  const { data: written, error } = await supabase
    .from("list_items")
    .insert({
      list_id: listId,
      position,
      item_type: "song",
      record_id: null,
      song_title: payload.song_title,
      song_artist: payload.song_artist,
      song_album: payload.song_album,
      song_cover_url: payload.song_cover_url,
      song_year: payload.song_year,
    })
    .select("id");

  if (error) return { error: error.message };
  if (!written?.length) return { error: "Save failed — no rows written" };

  revalidatePath("/lists");
  return {
    success: true,
    item: {
      id: written[0].id,
      item_type: "song" as const,
      artist: payload.song_artist,
      album: payload.song_album,
      year: payload.song_year,
      genre: null,
      cover_url: payload.song_cover_url,
      song_title: payload.song_title,
    },
  };
}

// ─── Append to personal list (finds next position) ─────────────────────────────

export async function appendRecordToList(listId: string, recordId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  const { data: existing } = await supabase
    .from("list_items").select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1);

  const nextPos = (existing?.[0]?.position ?? 0) + 1;
  if (nextPos > 20) return { error: "List is full (20 items maximum)" };

  const { data: written, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, record_id: recordId, position: nextPos })
    .select("id");

  if (error) return { error: error.message };
  if (!written?.length) return { error: "Save failed" };

  revalidatePath("/lists");
  return { success: true, position: nextPos };
}

export async function appendDiscogsRecordToList(listId: string, payload: DiscogsPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  const { data: existing } = await supabase
    .from("list_items").select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1);

  const nextPos = (existing?.[0]?.position ?? 0) + 1;
  if (nextPos > 20) return { error: "List is full (20 items maximum)" };

  // Find or create the record
  let recordId: string;
  const { data: existingRec } = await supabase
    .from("records").select("id").eq("discogs_id", payload.discogs_id).maybeSingle();

  if (existingRec) {
    recordId = existingRec.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("records")
      .insert({ discogs_id: payload.discogs_id, artist: payload.artist, album: payload.album, year: payload.year, genre: payload.genre, cover_url: payload.cover_url, label: payload.label })
      .select("id").single();

    if (insertErr || !inserted) {
      const { data: raceWinner } = await supabase.from("records").select("id").eq("discogs_id", payload.discogs_id).maybeSingle();
      if (!raceWinner) return { error: insertErr?.message ?? "Record insert failed" };
      recordId = raceWinner.id;
    } else {
      recordId = inserted.id;
    }
  }

  const { data: written, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, record_id: recordId, position: nextPos })
    .select("id");

  if (error) return { error: error.message };
  if (!written?.length) return { error: "Save failed" };

  revalidatePath("/lists");
  return {
    success: true,
    position: nextPos,
    item: { id: recordId, item_type: "record" as const, artist: payload.artist, album: payload.album, year: payload.year, genre: payload.genre, cover_url: payload.cover_url, song_title: null },
  };
}

export async function appendSongToList(listId: string, payload: SongPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  const { data: existing } = await supabase
    .from("list_items").select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1);

  const nextPos = (existing?.[0]?.position ?? 0) + 1;
  if (nextPos > 20) return { error: "List is full (20 items maximum)" };

  const { data: written, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, position: nextPos, item_type: "song", record_id: null, song_title: payload.song_title, song_artist: payload.song_artist, song_album: payload.song_album, song_cover_url: payload.song_cover_url, song_year: payload.song_year })
    .select("id");

  if (error) return { error: error.message };
  if (!written?.length) return { error: "Save failed" };

  revalidatePath("/lists");
  return {
    success: true,
    position: nextPos,
    item: { id: written[0].id, item_type: "song" as const, artist: payload.song_artist, album: payload.song_album, year: payload.song_year, genre: null, cover_url: payload.song_cover_url, song_title: payload.song_title },
  };
}

// ─── Remove item from list ─────────────────────────────────────────────────────

export async function removeListItem(listId: string, position: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await assertListOwner(supabase, listId, user.id))) return { error: "List not found" };

  const { error } = await supabase
    .from("list_items").delete().eq("list_id", listId).eq("position", position);
  if (error) return { error: error.message };

  revalidatePath("/lists");
  return { success: true };
}

// ─── Toggle public/private ─────────────────────────────────────────────────────

export async function toggleListPublic(listId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: list } = await supabase
    .from("lists").select("is_public").eq("id", listId).eq("user_id", user.id).maybeSingle();
  if (!list) return { error: "List not found" };

  const { error } = await supabase
    .from("lists").update({ is_public: !list.is_public }).eq("id", listId).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/lists");
  return { success: true, isPublic: !list.is_public };
}

// ─── Delete list ───────────────────────────────────────────────────────────────

export async function deleteList(listId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: list } = await supabase
    .from("lists").select("id").eq("id", listId).eq("user_id", user.id).maybeSingle();
  if (!list) return { error: "List not found" };

  // list_items cascade-delete via FK — no need to delete them separately.
  const { error } = await supabase
    .from("lists").delete().eq("id", listId).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/lists");
  return { success: true };
}
