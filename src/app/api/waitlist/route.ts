import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWaitlistNotification } from "@/lib/email";
import { Resend } from "resend";

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

  // Add to Resend contacts (waitlist segment) after the response — never blocks the reply.
  // contacts.create resets unsubscribed to false when the field is omitted, so we
  // use update → create-if-not-found to avoid re-subscribing opted-out contacts.
  after(async () => {
    try {
      const resendKey     = process.env.RESEND_API_KEY;
      const waitlistSegId = process.env.RESEND_SEGMENT_WAITLIST_ID;
      if (!resendKey) return;
      const today = new Date().toISOString().slice(0, 10);
      const r = new Resend(resendKey);

      const updatePayload = {
        email,
        ...(name ? { firstName: name } : {}),
        properties: { waitlist_date: today },
      };
      const { error: updateErr } = await r.contacts.update(updatePayload);

      if (updateErr?.name === "not_found") {
        // New contact — safe to set unsubscribed: false
        const { error: createErr } = await r.contacts.create({
          email,
          unsubscribed: false,
          ...(name ? { firstName: name } : {}),
          properties: { waitlist_date: today },
          ...(waitlistSegId ? { segments: [{ id: waitlistSegId }] } : {}),
        });
        if (createErr) console.error("[resend] waitlist contact create failed:", createErr.message);
      } else if (updateErr) {
        console.error("[resend] waitlist contact update failed:", updateErr.message);
      } else if (waitlistSegId) {
        // Existing contact — add to segment without touching unsubscribed
        const { error: segErr } = await r.contacts.segments.add({ email, segmentId: waitlistSegId });
        if (segErr) {
          const alreadyMember = segErr.name === "validation_error" && segErr.message.toLowerCase().includes("already");
          if (!alreadyMember) console.error("[resend] waitlist segment add failed:", segErr.message);
        }
      }
    } catch (err) {
      console.error("[resend] waitlist contact failed:", err);
    }
  });

  // Non-blocking — email failure must not break the user-facing response
  sendWaitlistNotification(email, name).catch((err) =>
    console.error("[waitlist] email failed:", err),
  );

  return NextResponse.json({ ok: true });
}
