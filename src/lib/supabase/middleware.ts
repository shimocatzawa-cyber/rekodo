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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoutes = ["/collection", "/lists", "/dig", "/onboarding", "/settings", "/admin", "/library"];
  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    await pingLastActive(supabase, request, supabaseResponse, user.id);
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

  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId);
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    maxAge: ACTIVITY_INTERVAL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
