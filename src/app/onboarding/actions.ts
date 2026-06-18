"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveOnboardingProfile(
  username:    string,
  displayName: string,
  city:        string,
  country:     string,
  countryCode: string,
  starSign:    string,
  bandcamp:    string,
  tasteEssay:  string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const clean = username.trim();
  if (!clean) return { error: "Username is required." };
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) return { error: "Only letters, numbers, and underscores." };
  if (clean.length < 2) return { error: "Username must be at least 2 characters." };

  const cleanCity    = city.trim();
  const cleanCountry = country.trim();
  const cleanCode    = countryCode.trim().toUpperCase();

  if (!cleanCity)    return { error: "City is required." };
  if (!cleanCountry) return { error: "Country is required." };

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .neq("id", user.id)
    .maybeSingle();

  if (taken) return { error: "That username is already taken." };

  const { error } = await (supabase as any)
    .from("profiles")
    .upsert(
      {
        id:                user.id,
        username:          clean,
        display_name:      displayName.trim() || null,
        city:              cleanCity,
        country:           cleanCountry,
        country_code:      cleanCode,
        star_sign:         starSign || null,
        bandcamp_username: bandcamp.trim().toLowerCase() || null,
        bio:               tasteEssay.trim() || null,
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };

  redirect("/collection");
}
