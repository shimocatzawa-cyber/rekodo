import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";
import { sendWaitlistInvite } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminDb = getAdminDb();
  const { data: entries, error } = await adminDb
    .from("waitlist")
    .select("email, name, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: entries ?? [], count: (entries ?? []).length });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminDb = getAdminDb();

  // Fetch all waitlist entries
  const { data: entries, error: listErr } = await adminDb
    .from("waitlist")
    .select("email, name")
    .order("created_at", { ascending: true });

  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  if (!entries?.length) return NextResponse.json({ sent: 0, skipped: 0, failed: 0 });

  // Collect emails of existing auth users so we can skip anyone already signed up.
  const existingEmails = new Set<string>();
  let authPage = 1;
  while (true) {
    const { data: { users }, error: authErr } = await adminDb.auth.admin.listUsers({ page: authPage, perPage: 1000 });
    if (authErr) break;
    for (const u of users) if (u.email) existingEmails.add(u.email.toLowerCase());
    if (users.length < 1000) break;
    authPage++;
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const entry of entries) {
    if (existingEmails.has(entry.email.toLowerCase())) {
      skipped++;
      continue;
    }
    try {
      await sendWaitlistInvite(entry.email, entry.name);
      sent++;
    } catch (err) {
      console.error(`[waitlist-invite] failed for ${entry.email}:`, err);
      failed++;
    }
    // Small delay to avoid overwhelming Brevo's transactional API
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({ sent, skipped, failed });
}
