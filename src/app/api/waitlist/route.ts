import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWaitlistNotification } from "@/lib/email";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name  = typeof body.name  === "string" ? body.name.trim().slice(0, 100) : undefined;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  // Write to Supabase — fail-silent so the waitlist works even during a DB outage.
  // Brevo is the source of truth for waitlist contacts when Supabase is unavailable.
  try {
    const sb = serviceClient();
    const { error } = await sb.from("waitlist").insert({ email, name: name || null });
    if (error && error.code !== "23505") {
      console.error("[waitlist] Supabase insert failed:", error.message);
    }
  } catch (err) {
    console.error("[waitlist] Supabase error:", err);
  }

  // Add to Brevo with WAITLIST_DATE attribute so these contacts are clearly
  // distinguished from full signups (which carry SIGNUP_DATE instead).
  try {
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      const today = new Date().toISOString().slice(0, 10);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 5000);
      await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          attributes: { WAITLIST_DATE: today, ...(name ? { FIRSTNAME: name } : {}) },
          listIds: [8],
          updateEnabled: true,
        }),
        signal: ac.signal,
      }).finally(() => clearTimeout(timer));
    }
  } catch (err) {
    console.error("[brevo] waitlist contact creation failed:", err);
  }

  // Non-blocking — email failure must not break the user-facing response
  sendWaitlistNotification(email, name).catch((err) =>
    console.error("[waitlist] email failed:", err),
  );

  return NextResponse.json({ ok: true });
}
