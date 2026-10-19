"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendSignupNotification } from "@/lib/email";
import { Resend } from "resend";

export type AuthState =
  | { error?: string; message?: string }
  | undefined;

export async function signup(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const username        = (formData.get("username") as string)?.trim();
  const email           = (formData.get("email") as string)?.trim();
  const password        = formData.get("password") as string;
  const referralSource  = (formData.get("referral_source") as string)?.trim() || null;

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
    // Persist the chosen username straight away so onboarding is pre-filled.
    // Use update (not upsert) — the on_auth_user_created trigger always creates
    // the profile row first, and upsert with onConflict can fail silently.
    await supabase.from("profiles")
      .update({ username, referral_source: referralSource })
      .eq("id", data.user.id);
    await sendSignupNotification(email, username, referralSource);

    // Add to Resend contacts (users segment) so onboarding automations can fire.
    // Non-blocking — an outage must never break signup.
    try {
      const resendKey    = process.env.RESEND_API_KEY;
      const usersSegId   = process.env.RESEND_SEGMENT_USERS_ID;
      if (resendKey) {
        const r = new Resend(resendKey);
        const { error } = await r.contacts.create({
          email,
          unsubscribed: false,
          ...(usersSegId ? { segments: [{ id: usersSegId }] } : {}),
        });
        if (error) console.error("[resend] signup contact creation failed:", error.message);
      }
    } catch (err) {
      console.error("[resend] signup contact creation failed:", err);
    }

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

  type SignInRace =
    | { timedOut: false; data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>> }
    | { timedOut: true };

  const signInRace = await Promise.race<SignInRace>([
    supabase.auth.signInWithPassword({ email, password })
      .then(data => ({ timedOut: false as const, data })),
    new Promise<SignInRace>(resolve =>
      setTimeout(() => resolve({ timedOut: true }), 8000)
    ),
  ]);

  if (signInRace.timedOut) {
    return { error: "Service temporarily unavailable — please try again in a few minutes." };
  }

  const { data: signInData, error } = signInRace.data;

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

export async function requestPasswordReset(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Email is required." };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rekodo.co").replace(/\/$/, "");
  const redirectTo = `${siteUrl}/auth/update-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Always return a success message to avoid leaking whether an email exists
  if (error) console.error("[password-reset]", error.message);
  return { message: "If that email has an account, a reset link is on its way." };
}
