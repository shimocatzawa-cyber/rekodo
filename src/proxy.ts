import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // WAITLIST_MODE: set WAITLIST_MODE=true in Vercel env vars and redeploy to
  // redirect /signup to /waitlist. Remove the var and redeploy to re-enable signups.
  if (process.env.WAITLIST_MODE === "true" && pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/waitlist";
    return NextResponse.redirect(url);
  }

  // Next.js 16 treats any URL segment starting with "@" as a parallel-route slot,
  // so /@username never matches [username]/page.tsx and always 404s.
  // Rewrite /@username → /p/username internally; browser URL stays /@username.
  if (pathname.startsWith("/@")) {
    const url = request.nextUrl.clone();
    url.pathname = "/p/" + pathname.slice(2); // /@foo → /p/foo
    return NextResponse.rewrite(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
