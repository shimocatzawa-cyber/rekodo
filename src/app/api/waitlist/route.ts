import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWaitlistConfirmation, sendWaitlistNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const estCollectionSize = Number(body.estCollectionSize);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "First name required" }, { status: 400 });
    }

    if (!Number.isInteger(estCollectionSize) || estCollectionSize < 0) {
      return NextResponse.json({ error: "Estimated collection size required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("waitlist_emails")
      .insert({ email, name, est_collection_size: estCollectionSize });

    if (error) {
      console.error("Waitlist insert error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (error.code === "23505") {
        return NextResponse.json({ message: "Already registered" }, { status: 200 });
      }
      return NextResponse.json(
        { error: "Internal server error", detail: error.message },
        { status: 500 },
      );
    }

    await Promise.all([
      sendWaitlistConfirmation(email, name),
      sendWaitlistNotification(email, name, estCollectionSize),
    ]).catch((err) => console.error("Email send error:", err));

    return NextResponse.json({ message: "Added to waitlist" }, { status: 201 });
  } catch (err) {
    console.error("Waitlist unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("waitlist_emails")
    .select("id, email, name, est_collection_size, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({ entries: data, total: data?.length ?? 0 });
}
