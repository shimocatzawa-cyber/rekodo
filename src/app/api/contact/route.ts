import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = await request.json() as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  const { name, email, subject, message } = body;

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  try {
    await resend.emails.send({
      from:    "rekōdo contact <hello@rekodo.co>",
      to:      "hello@rekodo.co",
      replyTo: email.trim(),
      subject: `[rekōdo contact] ${subject}`,
      text: [
        `Name:    ${name.trim()}`,
        `Email:   ${email.trim()}`,
        `Subject: ${subject}`,
        ``,
        message.trim(),
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] Resend error:", err);
    return NextResponse.json({ error: "Failed to send." }, { status: 500 });
  }
}
