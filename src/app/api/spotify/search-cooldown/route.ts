import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotifySearchCooldownUntil } from "@/lib/spotify";

export const dynamic = "force-dynamic";

// The Collection page's Now Playing search runs directly from the browser
// against Spotify, bypassing the matcher worker's circuit breaker entirely.
// This lets it check the same shared cooldown first, so it doesn't keep
// poking a rate-limited endpoint either.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cooldownUntil = await getSpotifySearchCooldownUntil();
  return NextResponse.json({ cooldownUntil });
}
