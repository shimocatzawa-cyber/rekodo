import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Currencies Stripe represents in whole units rather than a /100 minor unit
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
  "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    type: "subscription" | "donation";
    amount?: number;
    currency?: string;
  };

  const origin = new URL(request.url).origin;

  if (body.type === "subscription") {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: "price_1TiXPMEi5occhYh8Ofad2FYo", quantity: 1 }],
      success_url: `${origin}/about?success=subscription`,
      cancel_url: `${origin}/about`,
      metadata: { userId: user.id, type: "subscription" },
    });
    return NextResponse.json({ url: session.url });
  }

  if (body.type === "donation") {
    const currency = (body.currency ?? "usd").toLowerCase();
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency);
    const amount = Number(body.amount ?? 0);
    const unitAmount = Math.round(isZeroDecimal ? amount : amount * 100);
    if (unitAmount < (isZeroDecimal ? 1 : 100)) {
      return NextResponse.json(
        { error: "Minimum donation is 1 unit of your local currency" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: "rekōdo Donation",
              description: "One-off donation — golden ō badge",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/about?success=donation`,
      cancel_url: `${origin}/about`,
      metadata: { userId: user.id, type: "donation" },
    });
    return NextResponse.json({ url: session.url });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
