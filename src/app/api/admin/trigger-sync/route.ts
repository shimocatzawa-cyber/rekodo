import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const targetUserId = body?.userId as string | undefined;
  if (!targetUserId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const adminDb = getAdminDb();

  // Check if Discogs tokens exist for this user — fail fast rather than
  // letting the Edge Function start a job that will immediately error out.
  const { data: tokenRow } = await adminDb
    .from("discogs_tokens")
    .select("discogs_username")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "No Discogs connection for this user" }, { status: 400 });
  }

  // Return existing job if one is already active.
  const { data: existing } = await adminDb
    .from("sync_queue")
    .select("id")
    .eq("user_id", targetUserId)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  let jobId: string;
  if (existing) {
    jobId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await adminDb
      .from("sync_queue")
      .insert({ user_id: targetUserId, status: "pending" })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      return NextResponse.json({ error: insertErr?.message ?? "Failed to enqueue" }, { status: 500 });
    }
    jobId = inserted.id;
  }

  // Fire Edge Function non-blocking — it runs via EdgeRuntime.waitUntil
  // and will update sync_queue as it progresses.
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/discogs-sync-processor`;
  fetch(edgeFnUrl, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ jobId, userId: targetUserId }),
  }).catch(err => console.error("[admin/trigger-sync] Edge Function fire error:", err));

  return NextResponse.json({ jobId });
}
