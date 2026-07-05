"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendSignupNotification } from "@/lib/email";

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
    // Persist the chosen username straight away so onboarding is pre-filled
    await supabase.from("profiles").upsert(
      { id: data.user.id, username, referral_source: referralSource },
      { onConflict: "id" }
    );
    await sendSignupNotification(email, username, referralSource);

    // Add to Brevo list 5 so the onboarding automation fires.
    // Non-blocking — a Brevo outage must never break signup.
    try {
      const brevoKey = process.env.BREVO_API_KEY;
      console.log("[brevo] key present:", !!brevoKey);
      if (brevoKey) {
        const today = new Date().toISOString().slice(0, 10);
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 5000);
        const res = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            attributes: { SIGNUP_DATE: today },
            listIds: [5],
            updateEnabled: true,
          }),
          signal: ac.signal,
        }).finally(() => clearTimeout(timer));
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`[brevo] signup contact creation returned ${res.status}:`, body);
        }
      }
    } catch (err) {
      console.error("[brevo] signup contact creation failed:", err);
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
