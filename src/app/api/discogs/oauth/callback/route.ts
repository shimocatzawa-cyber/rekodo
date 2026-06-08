import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAccessToken, getIdentity } from "@/lib/discogs/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const oauthToken = searchParams.get("oauth_token");
  const verifier   = searchParams.get("oauth_verifier");
  const denied     = searchParams.get("denied");

  if (denied) return NextResponse.redirect(`${origin}/collection?oauth_denied=1`);
  if (!oauthToken || !verifier) return NextResponse.redirect(`${origin}/collection?oauth_error=1`);

  const reqSecret = request.cookies.get("dg_req_secret")?.value;
  if (!reqSecret) {
    console.error("Discogs OAuth callback: dg_req_secret cookie missing");
    return NextResponse.redirect(`${origin}/collection?oauth_error=1`);
  }

  const key    = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;

  try {
    const {
      token: accessToken,
      secret: tokenSecret,
      username: tokenUsername,
    } = await getAccessToken(key, secret, oauthToken, reqSecret, verifier);

    console.log("Discogs OAuth: access token response username:", tokenUsername);

    let username = tokenUsername;
    if (!username) {
      console.log("Discogs OAuth: username absent from token response, calling /oauth/identity");
      const identity = await getIdentity(key, secret, accessToken, tokenSecret);
      username = identity.username;
    }

    console.log("Discogs OAuth: resolved username:", username);

    // ── Persist tokens to discogs_tokens (service role — no user RLS) ─────────
    // Non-fatal: if this fails the sync still works via cookies for this session.
    try {
      const supabase    = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        if (svcKey) {
          const adminDb = createServiceClient(sbUrl, svcKey, { auth: { persistSession: false } });
          await adminDb.from("discogs_tokens").upsert({
            user_id:          user.id,
            access_token:     accessToken,
            token_secret:     tokenSecret,
            discogs_username: username,
            updated_at:       new Date().toISOString(),
          }, { onConflict: "user_id" });
        }
      }
    } catch (dbErr) {
      console.error("Discogs OAuth: failed to persist tokens to DB (non-fatal):", dbErr);
    }

    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge:   600,
      path:     "/",
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
