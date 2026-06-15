import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// ISO 3166-1 alpha-2 → ISO 4217 currency code (most common countries)
const COUNTRY_CURRENCY: Record<string, string> = {
  AU: "aud", NZ: "nzd", GB: "gbp", IE: "eur", DE: "eur", FR: "eur",
  IT: "eur", ES: "eur", NL: "eur", BE: "eur", PT: "eur", AT: "eur",
  FI: "eur", GR: "eur", CA: "cad", JP: "jpy", SG: "sgd", HK: "hkd",
  CH: "chf", SE: "sek", NO: "nok", DK: "dkk", PL: "pln", CZ: "czk",
  HU: "huf", RO: "ron", BR: "brl", MX: "mxn", IN: "inr", KR: "krw",
  TH: "thb", MY: "myr", ID: "idr", PH: "php", ZA: "zar", IL: "ils",
  AE: "aed", SA: "sar", TR: "try", EG: "egp",
};

export async function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") ?? "US";
  const currency = COUNTRY_CURRENCY[country] ?? "usd";

  try {
    const price = await stripe.prices.retrieve(
      "price_1TiXPMEi5occhYh8Ofad2FYo",
      { expand: ["currency_options"] }
    );

    const options = price.currency_options as Record<
      string,
      { unit_amount: number | null }
    > | undefined;

    const localOption = options?.[currency];

    if (localOption?.unit_amount != null) {
      return NextResponse.json({
        unit_amount: localOption.unit_amount,
        currency,
      });
    }

    // Fall back to base price (USD)
    return NextResponse.json({
      unit_amount: price.unit_amount ?? 500,
      currency: price.currency,
    });
  } catch {
    return NextResponse.json({ unit_amount: 500, currency: "usd" });
  }
}
