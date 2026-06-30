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

  const sb = serviceClient();
  const { error } = await sb.from("waitlist").insert({ email, name: name || null });

  if (error) {
    if (error.code === "23505") {
      // Duplicate email — treat as success so we don't leak which emails are already listed
      return NextResponse.json({ ok: true });
    }
    console.error("[waitlist] insert error:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Non-blocking — email failure must not break the user-facing response
  sendWaitlistNotification(email, name).catch((err) =>
    console.error("[waitlist] email failed:", err),
  );

  return NextResponse.json({ ok: true });
}
