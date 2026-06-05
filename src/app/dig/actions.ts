"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addToWantlist(
  artist: string,
  album: string,
  year: number | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  await supabase.from("profiles").upsert(
    { id: user.id, username: `${emailPrefix}_${user.id.slice(0, 6)}` },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // Ensure "Want to Buy" list exists
  const { error: upsertErr } = await supabase.from("lists").upsert(
    {
      user_id: user.id,
      title: "Want to Buy",
      slug: "want-to-buy",
      is_public: false,
      list_type: "personal",
    },
    { onConflict: "user_id,slug", ignoreDuplicates: true }
  );
  // Fallback without list_type if column doesn't exist yet
  if (upsertErr?.message?.includes("list_type")) {
    await supabase.from("lists").upsert(
      { user_id: user.id, title: "Want to Buy", slug: "want-to-buy", is_public: false },
      { onConflict: "user_id,slug", ignoreDuplicates: true }
    );
  }

  const { data: wantlist } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", "want-to-buy")
    .maybeSingle();

  if (!wantlist) return { error: "Could not find wantlist" };

  // Insert the record (no discogs_id — it's a recommendation)
  const { data: inserted, error: insertErr } = await supabase
    .from("records")
    .insert({ artist, album, year, genre: null, cover_url: null, label: null })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { error: insertErr?.message ?? "Record insert failed" };
  }

  // Find next position in wantlist
  const { data: existing } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", wantlist.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { error: linkErr } = await supabase
    .from("list_items")
    .insert({ list_id: wantlist.id, record_id: inserted.id, position: nextPos });

  if (linkErr) {
    return { error: linkErr.message };
  }

  revalidatePath("/lists");
  return { success: true };
}
