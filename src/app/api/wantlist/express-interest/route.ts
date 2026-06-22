import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createClient as createServerClient } from "@/lib/supabase/server";

const FROM = "rekōdo <hello@rekodo.co>";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  // The buyer must be derived from their own authenticated session — this
  // route used to trust a client-supplied buyerUserId, which let anyone
  // disclose an arbitrary user's real email address to any seller they named.
  const sessionSupabase = await createServerClient();
  const { data: { user: caller } } = await sessionSupabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { sellerUsername?: unknown; artist?: unknown; album?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sellerUsername, artist, album } = body;
  if (
    typeof sellerUsername !== "string" || !sellerUsername ||
    typeof artist !== "string" || !artist ||
    typeof album !== "string" || !album
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const buyerUserId = caller.id;
  const supabase = getAdminSupabase();

  // Resolve buyer email + username
  const { data: { user: buyerAuth } } = await supabase.auth.admin.getUserById(buyerUserId);
  if (!buyerAuth?.email) return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  const buyerEmail = buyerAuth.email;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: buyerProfile } = await (supabase as any)
    .from("profiles").select("username").eq("id", buyerUserId).maybeSingle();
  const buyerUsername = (buyerProfile?.username as string | null) ?? "A rekōdo member";

  // Resolve seller userId + email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sellerProfile } = await (supabase as any)
    .from("profiles").select("id").eq("username", sellerUsername).maybeSingle();
  if (!sellerProfile?.id) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  const { data: { user: sellerAuth } } = await supabase.auth.admin.getUserById(sellerProfile.id as string);
  if (!sellerAuth?.email) return NextResponse.json({ error: "Seller email not found" }, { status: 404 });
  const sellerEmail = sellerAuth.email;

  const record = `${artist} — ${album}`;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const emailHtml = (heading: string, body: string, profileUrl: string, profileLabel: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 24px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding-bottom:40px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#CC5500;">rekōdo</p>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:22px;line-height:1.4;color:#ffffff;">${heading}</p>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="margin:0;font-size:13px;line-height:1.8;color:rgba(255,255,255,0.65);">${body}</p>
        </td></tr>
        <tr><td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;">
          <a href="${profileUrl}" style="font-size:11px;letter-spacing:0.08em;color:#CC5500;text-decoration:none;">${profileLabel} →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await Promise.all([
    resend.emails.send({
      from: FROM,
      to: sellerEmail,
      subject: `Someone wants your ${record} on rekōdo`,
      html: emailHtml(
        `${buyerUsername} is interested in your copy of ${record}.`,
        `${buyerUsername} would like to purchase <strong style="color:#fff;">${record}</strong> from you on rekōdo.<br/><br/>Their email is <strong style="color:#fff;">${buyerEmail}</strong>. Reach out if you'd like to connect.`,
        `https://rekodo.co/@${buyerUsername}`,
        `View ${buyerUsername}'s profile`
      ),
    }),
    resend.emails.send({
      from: FROM,
      to: buyerEmail,
      subject: `Your interest in ${record} has been shared`,
      html: emailHtml(
        `We've let ${sellerUsername} know you're interested.`,
        `We've shared your email with <strong style="color:#fff;">${sellerUsername}</strong> about <strong style="color:#fff;">${record}</strong>.<br/><br/>They'll reach out via email if they'd like to proceed.`,
        `https://rekodo.co/@${sellerUsername}`,
        `View ${sellerUsername}'s profile`
      ),
    }),
  ]);

  return NextResponse.json({ success: true });
}
