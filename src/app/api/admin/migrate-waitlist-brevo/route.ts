import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BREVO_LIST_ID = 8;
const BATCH_SIZE    = 150;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.MIGRATE_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await sb
    .from("waitlist")
    .select("email, name, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: true, imported: 0 });

  const brevoKey = process.env.BREVO_API_KEY!;
  let imported = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const contacts = batch.map((row: { email: string; name: string | null; created_at: string }) => ({
      email: row.email,
      attributes: {
        WAITLIST_DATE: row.created_at.slice(0, 10),
        ...(row.name ? { FIRSTNAME: row.name } : {}),
      },
    }));

    const res = await fetch("https://api.brevo.com/v3/contacts/import", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({ listIds: [BREVO_LIST_ID], updateEnabled: true, contacts }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Brevo batch failed: ${body}` }, { status: 500 });
    }
    imported += batch.length;
  }

  return NextResponse.json({ ok: true, imported });
}
