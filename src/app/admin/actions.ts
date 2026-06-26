"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function getAdminDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return p?.role === "admin";
}

export async function updateUserAdmin(
  userId: string,
  tier: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  const adminDb = getAdminDb();
  // "supporter" is the UI label; store as "premium" in DB for consistency with existing data
  const dbTier = tier === "supporter" ? "premium" : tier;
  const isSupporter = tier === "supporter";
  const { error } = await (adminDb as any)
    .from("profiles")
    .update({ subscription_tier: dbTier, role, is_supporter: isSupporter })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updateUserIdentity(
  userId: string,
  username: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  const adminDb = getAdminDb();
  const errors: string[] = [];

  if (username.trim()) {
    const { error } = await adminDb
      .from("profiles")
      .update({ username: username.trim() })
      .eq("id", userId);
    if (error) errors.push(`Username: ${error.message}`);
  }

  if (email.trim()) {
    const { error } = await adminDb.auth.admin.updateUserById(userId, {
      email: email.trim(),
    });
    if (error) errors.push(`Email: ${error.message}`);
  }

  if (errors.length) return { success: false, error: errors.join(" · ") };

  revalidatePath("/admin");
  return { success: true };
}

export async function blockUser(
  userId: string,
  block: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  const adminDb = getAdminDb();
  const { error } = await adminDb.auth.admin.updateUserById(userId, {
    ban_duration: block ? "876000h" : "none",
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserAdmin(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  const adminDb = getAdminDb();

  // Cancel any active Stripe subscription before deletion.
  try {
    const { data: profile } = await adminDb
      .from("profiles").select("stripe_customer_id").eq("id", userId).maybeSingle() as
      { data: { stripe_customer_id: string | null } | null };
    if (profile?.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "active", limit: 10 });
      await Promise.all(subs.data.map(s => stripe.subscriptions.cancel(s.id)));
    }
  } catch (err) {
    console.error("[admin/delete] Stripe cancellation failed:", err);
  }

  // Remove storage objects (not FK-linked, won't cascade).
  await Promise.all([
    adminDb.storage.from("avatars").remove([`${userId}/avatar.jpg`]),
    adminDb.storage.from("collection-photos").remove([`${userId}/1.jpg`]),
  ]).catch(() => {});

  // Delete auth user — cascades through all FK-linked tables.
  const { error } = await adminDb.auth.admin.deleteUser(userId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

// Test accounts are excluded from Community discovery (All Collectors, Top
// Matches candidates) but otherwise behave like any normal account.
export async function setTestAccount(
  userId: string,
  isTest: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  const adminDb = getAdminDb();
  const { error } = await adminDb
    .from("profiles")
    .update({ is_test: isTest })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}
