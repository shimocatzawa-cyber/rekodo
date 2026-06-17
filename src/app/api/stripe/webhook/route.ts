import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
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
      await supabase.from("profiles").update({ is_supporter: true }).eq("id", userId);

      if (customerEmail) {
        await resend.emails.send({
          from: "rekōdo <hello@rekodo.co>",
          to: customerEmail,
          subject: "Welcome to rekōdo — you're a Supporter",
          text: `You're in.

As a rekōdo Supporter you've helped make this thing real. The golden ō badge is now yours — you'll see it on your profile.

rekōdo is built for people who take records seriously. Thank you for taking rekōdo seriously in return.

— rekōdo`,
        });
      }
    }

    if (type === "donation" && userId) {
      await supabase.from("profiles").update({ is_donor: true }).eq("id", userId);

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
