"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveAvatarUrl(
  avatarUrl: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  revalidatePath(`/@${user.id}`);
  return { ok: true };
}

export async function saveDisplayName(
  displayName: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim() || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  return { ok: true };
}

export async function saveProfileSettings(
  location: string,
  bio: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (bio.length > 160) return { error: "Bio must be 160 characters or fewer." };

  const { error } = await supabase
    .from("profiles")
    .update({
      location: location.trim() || null,
      bio:      bio.trim()      || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  return { ok: true };
}
