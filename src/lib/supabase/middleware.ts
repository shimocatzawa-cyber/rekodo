import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  // Skip auth middleware if Supabase isn't configured yet
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  // Don't auth-check the down page — it must always be reachable
  if (request.nextUrl.pathname === "/down") {
    return NextResponse.next({ request });
  }

  // Redirect /signup → /waitlist when signup is disabled (e.g. during outages).
  // Toggle via SIGNUP_DISABLED=1 in Vercel env vars — no code change needed.
  if (process.env.SIGNUP_DISABLED === "1" && request.nextUrl.pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/waitlist";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const protectedRoutes = ["/collection", "/lists", "/dig", "/onboarding", "/settings", "/admin", "/library"];
  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  type AuthRace =
    | { timedOut: false; user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] }
    | { timedOut: true; user: null };

  let authRace: AuthRace;
  try {
    authRace = await Promise.race<AuthRace>([
      supabase.auth.getUser().then(r => ({ timedOut: false as const, user: r.data.user })),
      new Promise<AuthRace>(resolve =>
        setTimeout(() => resolve({ timedOut: true, user: null }), 5000)
      ),
    ]);
  } catch (err: unknown) {
    const is504 = err != null && typeof err === "object" && "status" in err && (err as { status: unknown }).status === 504;
    if (is504) {
      const url = request.nextUrl.clone();
      url.pathname = "/down";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  if (authRace.timedOut) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/down";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  const { user } = authRace;

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Cap the ping at 2 s so a slow DB write doesn't delay the response.
    await Promise.race([
      pingLastActive(supabase, request, supabaseResponse, user.id),
      new Promise<void>(resolve => setTimeout(resolve, 2000)),
    ]);
  }

  return supabaseResponse;
}

const ACTIVITY_COOKIE = "rk_last_active_ping";
const ACTIVITY_INTERVAL_SECONDS = 15 * 60;

// Bumps profiles.last_active_at, throttled via a cookie so it's at most one
// DB write per ~15 minutes per browser session rather than on every request.
async function pingLastActive(
  supabase: ReturnType<typeof createServerClient<Database>>,
  request: NextRequest,
  response: NextResponse,
  userId: string
) {
  const lastPing = request.cookies.get(ACTIVITY_COOKIE)?.value;
  const isStale = !lastPing || Date.now() - Number(lastPing) > ACTIVITY_INTERVAL_SECONDS * 1000;
  if (!isStale) return;

  const { error } = await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId);
  if (error) {
    // Don't set the cookie on failure — retry on the next request instead of
    // going quiet for ACTIVITY_INTERVAL_SECONDS on a permission/DB error.
    console.error("[middleware] last_active_at update failed:", error.message);
    return;
  }
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    maxAge: ACTIVITY_INTERVAL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
