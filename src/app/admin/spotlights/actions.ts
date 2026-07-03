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

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return p?.role === "admin";
}

export interface SpotlightPayload {
  type: "artist" | "label";
  month: string;
  status: "draft" | "active" | "archived";
  name: string;
  discogs_id: string;
  subtitle: string;
  meta: string;
  bio: string;
  releases: string;
  collector_notes: string;
  neighbors: string;
  rekoodos_pick: string;
}

function parsePayload(payload: SpotlightPayload) {
  return {
    type: payload.type,
    month: payload.month.trim(),
    status: payload.status,
    name: payload.name.trim(),
    discogs_id: payload.discogs_id.trim(),
    subtitle: payload.subtitle.trim(),
    meta: JSON.parse(payload.meta),
    bio: JSON.parse(payload.bio),
    releases: JSON.parse(payload.releases),
    collector_notes: JSON.parse(payload.collector_notes),
    neighbors: JSON.parse(payload.neighbors),
    rekoodos_pick: payload.rekoodos_pick.trim() || null,
  };
}

export async function createSpotlight(payload: SpotlightPayload): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  let parsed;
  try { parsed = parsePayload(payload); }
  catch { return { success: false, error: "Invalid JSON in one or more fields" }; }

  const adminDb = getAdminDb();
  const { error } = await (adminDb as any).from("spotlights").insert(parsed);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/spotlights");
  return { success: true };
}

export async function updateSpotlight(id: string, payload: SpotlightPayload): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  let parsed;
  try { parsed = parsePayload(payload); }
  catch { return { success: false, error: "Invalid JSON in one or more fields" }; }

  const adminDb = getAdminDb();
  const { error } = await (adminDb as any)
    .from("spotlights")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/spotlights");
  return { success: true };
}

export async function deleteSpotlight(id: string): Promise<{ success: boolean; error?: string }> {
  if (!await verifyAdmin()) return { success: false, error: "Forbidden" };

  const adminDb = getAdminDb();
  const { error } = await (adminDb as any).from("spotlights").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/spotlights");
  return { success: true };
}
