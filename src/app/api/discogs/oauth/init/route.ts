import { NextResponse, type NextRequest } from "next/server";
import { getRequestToken } from "@/lib/discogs/oauth";

export async function GET(request: NextRequest) {
  const key = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!key || !secret) {
    return new Response("Discogs not configured", { status: 500 });
  }

  const { origin } = request.nextUrl;
  const callbackUrl = `${origin}/api/discogs/oauth/callback`;

  try {
    const { token, secret: reqSecret } = await getRequestToken(key, secret, callbackUrl);

    // NextResponse.redirect is the reliable way to set cookies on a redirect —
    // cookies().set() + Response.redirect() doesn't guarantee Set-Cookie headers
    // end up on the redirect response in Next.js Route Handlers.
    const response = NextResponse.redirect(
      `https://www.discogs.com/oauth/authorize?oauth_token=${encodeURIComponent(token)}`
    );
    response.cookies.set("dg_req_secret", reqSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Discogs OAuth init:", err);
    return NextResponse.redirect(`${origin}/collection?oauth_error=1`);
  }
}
