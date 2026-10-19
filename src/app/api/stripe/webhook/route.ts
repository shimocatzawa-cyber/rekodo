import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendNewSupporterAlert } from "@/lib/email";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const type = session.metadata?.type;
    const customerEmail = session.customer_details?.email;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (type === "subscription" && userId) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("is_supporter")
        .eq("id", userId)
        .maybeSingle();

      if (existing?.is_supporter) {
        return NextResponse.json({ received: true });
      }

      const customerId = typeof session.customer === "string"
        ? session.customer
        : (session.customer as { id: string } | null)?.id ?? null;

      await Promise.all([
        supabase.from("profiles").update({
          is_supporter: true,
          subscription_tier: "premium",
          stripe_customer_id: customerId,
        }).eq("id", userId),
        session.amount_total != null && session.id
          ? supabase.from("payments").insert({
              user_id: userId,
              stripe_session_id: session.id,
              type: "subscription",
              amount_cents: session.amount_total,
              currency: session.currency ?? "usd",
            })
          : Promise.resolve(),
      ]);

      // Update Resend contact (supporter property + segment) + send welcome email — non-blocking, fail-silent.
      if (customerEmail) {
        const supportersSegId = process.env.RESEND_SEGMENT_SUPPORTERS_ID;

        // Update supporter property and add to supporters segment — fire-and-forget.
        // supporter is written as number (1) — matches CreateContactPropertiesOptions / UpdateContactPropertiesOptions
        // which type properties as { [key: string]: string | number | null }.
        // unsubscribed intentionally omitted in all paths to preserve the contact's opt-out status.
        void (async () => {
          try {
            const { error: updateErr } = await resend.contacts.update({
              email: customerEmail,
              properties: { supporter: 1 },
            });

            if (updateErr?.name === "not_found") {
              // Contact doesn't exist yet — create it (segment assigned at creation)
              const { error: createErr } = await resend.contacts.create({
                email: customerEmail,
                properties: { supporter: 1 },
                ...(supportersSegId ? { segments: [{ id: supportersSegId }] } : {}),
              });
              if (createErr) console.error("[resend] supporter contact create failed:", createErr.message);
            } else if (updateErr) {
              console.error("[resend] supporter contact update failed:", updateErr.message);
            } else if (supportersSegId) {
              // Contact existed and was updated — add to segment separately.
              // Ignore validation_error in case they're already in the segment.
              const { error: segErr } = await resend.contacts.segments.add({
                email: customerEmail,
                segmentId: supportersSegId,
              });
              if (segErr && segErr.name !== "validation_error") {
                console.error("[resend] supporter segment add failed:", segErr.message);
              }
            }
          } catch (err) {
            console.error("[resend] supporter contact failed:", err);
          }
        })();

        // Supporter welcome email
        resend.emails.send({
          from:    "rekōdo <hello@rekodo.co>",
          to:      customerEmail,
          subject: "Welcome to rekōdo — you're now a supporter",
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:48px 24px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0;font-family:Georgia,serif;font-weight:700;font-size:28px;color:#CC5500;line-height:1;">ō</p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:28px;color:#0d0d0d;line-height:1.2;">Thank you.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;color:#555555;line-height:1.7;letter-spacing:0.04em;">
                Your support keeps rekōdo going.<br /><br />
                rekōdo is a one-person project built out of a genuine love for records and
                the people who collect them. Every supporter makes it possible to keep building.<br /><br />
                Your account is now marked as a supporter — thank you for being part of this.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:40px;">
              <a href="https://rekodo.co" style="display:inline-block;background:#0d0d0d;color:#ffffff;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:15px 32px;">
                Go to rekōdo →
              </a>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;color:#aaaaaa;letter-spacing:0.06em;line-height:1.6;">
                <a href="https://rekodo.co" style="color:#CC5500;text-decoration:none;">rekodo.co</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        }).catch(err => console.error("[resend] supporter welcome email failed:", err));

        // Internal alert to admin — non-blocking, fail-silent.
        sendNewSupporterAlert({
          email: customerEmail,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
        }).catch(err => console.error("[resend] supporter alert failed:", err));
      }
    }

    if (type === "donation" && userId) {
      await Promise.all([
        supabase.from("profiles").update({ is_donor: true }).eq("id", userId),
        session.amount_total != null && session.id
          ? supabase.from("payments").insert({
              user_id: userId,
              stripe_session_id: session.id,
              type: "donation",
              amount_cents: session.amount_total,
              currency: session.currency ?? "usd",
            })
          : Promise.resolve(),
      ]);

      if (customerEmail) {
        await resend.emails.send({
          from: "rekōdo <hello@rekodo.co>",
          to: customerEmail,
          subject: "Thank you from rekōdo",
          text: `Thank you for supporting rekōdo.

It means more than you know. rekōdo is a one-person project built out of a genuine love for records and the people who collect them.

Your contribution goes directly into keeping the lights on and building what comes next.

— rekōdo`,
        });
      }
    }
  }

  // Subscription cancelled or ended — revoke supporter access.
  if (
    event.type === "customer.subscription.deleted" ||
    (event.type === "customer.subscription.updated" &&
      ["canceled", "unpaid", "past_due"].includes(
        (event.data.object as Stripe.Subscription).status
      ))
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer as { id: string }).id;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_supporter")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (profile?.is_supporter) {
      await supabase
        .from("profiles")
        .update({ is_supporter: false, subscription_tier: "free" })
        .eq("stripe_customer_id", customerId);
    }
  }

  return NextResponse.json({ received: true });
}
