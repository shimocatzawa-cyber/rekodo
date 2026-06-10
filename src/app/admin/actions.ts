"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getAdminDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function updateUserAdmin(
  userId: string,
  tier: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  // Re-verify the calling user is admin before any mutation
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (callerProfile?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  const adminDb = getAdminDb();
  const { error } = await adminDb
    .from("profiles")
    .update({ subscription_tier: tier, role })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}
