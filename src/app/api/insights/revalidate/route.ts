import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Called by the client after a Discogs sync or CSV import completes.
// revalidateTag must run in a normal (non-streaming) request context so that
// Next.js's pendingRevalidatedTags queue is flushed after this handler returns.
// Calling it from inside an SSE route's background IIFE doesn't work because
// Next.js flushes pendingRevalidatedTags when the route handler function
// returns its Response — before the IIFE has a chance to call revalidateTag.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag(`collection-${user.id}`, {});
  return NextResponse.json({ ok: true });
}
