"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Both slugs accepted so existing "Want to Buy" lists work without a migration.
const WANTLIST_SLUGS = ["wantlist", "want-to-buy"] as const;

export async function addToWantlist(
  artist: string,
  album: string,
  year: number | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // ── 1. Find or create the wantlist ─────────────────────────────────────────

  // Accept either slug so users with the old "Want to Buy" list work immediately.
  const { data: rows } = await supabase
    .from("lists")
    .select("id, slug")
    .eq("user_id", user.id)
    .in("slug", WANTLIST_SLUGS);

  let wantlistId = rows?.[0]?.id ?? null;

  if (!wantlistId) {
    // Create it. Try with list_type first; fall back if column doesn't exist yet.
    const base = { user_id: user.id, title: "Wantlist", slug: "wantlist", is_public: false };

    const { data: created, error: createErr } = await supabase
      .from("lists")
      .insert({ ...base, list_type: "personal" })
      .select("id")
      .single();

    if (createErr) {
      // list_type column may not exist — retry without it
      const { data: created2, error: createErr2 } = await supabase
        .from("lists")
        .insert(base)
        .select("id")
        .single();

      if (createErr2 || !created2) {
        console.error("Wantlist create error:", createErr2 ?? createErr);
        return { error: "Could not create wantlist" };
      }
      wantlistId = created2.id;
    } else if (created) {
      wantlistId = created.id;
    } else {
      return { error: "Could not create wantlist" };
    }
  }

  // ── 2. Find next position (and check for duplicate) ────────────────────────

  const { data: existing } = await supabase
    .from("list_items")
    .select("position, song_artist, song_album")
    .eq("list_id", wantlistId)
    .order("position", { ascending: false });

  const alreadyAdded = (existing ?? []).some(
    i => i.song_artist?.toLowerCase() === artist.toLowerCase() &&
         i.song_album?.toLowerCase()  === album.toLowerCase()
  );
  if (alreadyAdded) return { success: true };

  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  // ── 3. Insert directly as a song item — no records table insert needed ──────

  const { error: linkErr } = await supabase
    .from("list_items")
    .insert({
      list_id: wantlistId,
      position: nextPos,
      item_type: "song",
      song_title: album,
      song_artist: artist,
      song_album: album,
      song_year: year ?? null,
      source: "dig",
    });

  if (linkErr) return { error: linkErr.message };

  revalidatePath("/lists");
  return { success: true };
}
