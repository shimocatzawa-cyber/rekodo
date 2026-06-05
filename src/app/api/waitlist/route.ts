import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("waitlist_emails")
      .insert({ email });

    if (error) {
      if (error.code === "23505") {
        // Unique violation — already on the list
        return NextResponse.json({ message: "Already registered" }, { status: 200 });
      }
      throw error;
    }

    return NextResponse.json({ message: "Added to waitlist" }, { status: 201 });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
