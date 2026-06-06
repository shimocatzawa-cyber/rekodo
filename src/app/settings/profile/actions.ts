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
  city: string,
  country: string,
  countryCode: string,
  bio: string,
  starSign: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const cleanCity    = city.trim();
  const cleanCountry = country.trim();
  const cleanCode    = countryCode.trim().toUpperCase();

  if (!cleanCity)    return { error: "City is required." };
  if (!cleanCountry) return { error: "Country is required." };
  if (bio.length > 160) return { error: "Bio must be 160 characters or fewer." };

  const { error } = await supabase
    .from("profiles")
    .update({
      city:         cleanCity,
      country:      cleanCountry,
      country_code: cleanCode,
      bio:          bio.trim() || null,
      star_sign:    starSign || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  return { ok: true };
}
