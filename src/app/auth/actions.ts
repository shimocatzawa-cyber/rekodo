"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  | { error?: string; message?: string }
  | undefined;

export async function signup(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const username = (formData.get("username") as string)?.trim();
  const email    = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!username) return { error: "Username is required." };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return { error: "Username may only contain letters, numbers, and underscores." };
  if (username.length < 2) return { error: "Username must be at least 2 characters." };
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const supabase = await createClient();

  // Check username availability before creating the auth user
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return { error: "That username is already taken." };

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Email confirmation disabled — session available immediately
  if (data.session && data.user) {
    // Persist the chosen username straight away so onboarding is pre-filled
    await supabase.from("profiles").upsert(
      { id: data.user.id, username },
      { onConflict: "id" }
    );
    redirect("/onboarding");
  }

  // Email confirmation required
  return { message: "Check your email to confirm your account." };
}

export async function login(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", signInData.user.id)
    .maybeSingle();

  if (!profile?.username) {
    redirect("/onboarding");
  }

  redirect("/collection");
}
