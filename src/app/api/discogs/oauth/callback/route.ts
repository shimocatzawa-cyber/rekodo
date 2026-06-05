import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken, getIdentity } from "@/lib/discogs/oauth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const oauthToken = searchParams.get("oauth_token");
  const verifier = searchParams.get("oauth_verifier");
  const denied = searchParams.get("denied");

  if (denied) {
    return NextResponse.redirect(`${origin}/collection?oauth_denied=1`);
  }
  if (!oauthToken || !verifier) {
    return NextResponse.redirect(`${origin}/collection?oauth_error=1`);
  }

  // dg_req_secret was set on the init redirect — read it from the incoming request
  const reqSecret = request.cookies.get("dg_req_secret")?.value;
  if (!reqSecret) {
    console.error("Discogs OAuth callback: dg_req_secret cookie missing");
    return NextResponse.redirect(`${origin}/collection?oauth_error=1`);
  }

  const key = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;

  try {
    const {
      token: accessToken,
      secret: tokenSecret,
      username: tokenUsername,
    } = await getAccessToken(key, secret, oauthToken, reqSecret, verifier);

    console.log("Discogs OAuth: access token response username:", tokenUsername);

    // Discogs includes username in the token response — use it directly.
    // Only call /oauth/identity as a fallback if it wasn't present.
    let username = tokenUsername;
    if (!username) {
      console.log("Discogs OAuth: username absent from token response, calling /oauth/identity");
      const identity = await getIdentity(key, secret, accessToken, tokenSecret);
      username = identity.username;
    }

    console.log("Discogs OAuth: resolved username:", username);

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600,
      path: "/",
    };

    const response = NextResponse.redirect(`${origin}/collection?start_sync=1`);
    response.cookies.delete("dg_req_secret");
    response.cookies.set("dg_at", accessToken, cookieOpts);
    response.cookies.set("dg_ts", tokenSecret, cookieOpts);
    response.cookies.set("dg_un", username, cookieOpts);
    return response;
  } catch (err) {
    console.error("Discogs OAuth callback:", err);
    return NextResponse.redirect(`${origin}/collection?oauth_error=1`);
  }
}
