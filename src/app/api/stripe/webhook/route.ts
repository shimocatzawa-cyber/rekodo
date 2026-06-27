import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendNewSupporterAlert } from "@/lib/email";
import Stripe from "stripe";

const BREVO_SUPPORTER_TEMPLATE_ID = 19;

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

      // Update Brevo contact + send supporter welcome email — non-blocking, fail-silent.
      if (customerEmail) {
        try {
          const brevoKey = process.env.BREVO_API_KEY;
          if (brevoKey) {
            await Promise.all([
              fetch("https://api.brevo.com/v3/contacts", {
                method: "POST",
                headers: { "api-key": brevoKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: customerEmail,
                  attributes: { IS_SUPPORTER: true },
                  updateEnabled: true,
                }),
              }),
              fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: { "api-key": brevoKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: [{ email: customerEmail }],
                  templateId: BREVO_SUPPORTER_TEMPLATE_ID,
                }),
              }),
            ]);
          }
        } catch (err) {
          console.error("[brevo] supporter update/email failed:", err);
        }

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

  return NextResponse.json({ received: true });
}
