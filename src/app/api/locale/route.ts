import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { locale } = await request.json() as { locale: string };
  const valid = ["en", "ja", "de", "pt", "fr"];
  if (!valid.includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
