"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveOnboardingProfile(
  username: string,
  displayName: string,
  location: string
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const clean = username.trim();
  if (!clean) return { error: "Username is required." };
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) return { error: "Only letters, numbers, and underscores." };
  if (clean.length < 2) return { error: "Username must be at least 2 characters." };

  // Uniqueness check (exclude own row)
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .neq("id", user.id)
    .maybeSingle();

  if (taken) return { error: "That username is already taken." };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username: clean,
        display_name: displayName.trim() || null,
        location: location.trim() || null,
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };

  redirect("/collection");
}
