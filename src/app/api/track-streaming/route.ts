import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_SERVICES  = ["apple_music", "spotify", "tidal", "deezer"] as const;
const VALID_CONTEXTS  = ["collection", "dig", "playlist", "archetypes"] as const;

type Service = typeof VALID_SERVICES[number];
type Context = typeof VALID_CONTEXTS[number];

const SECTION: Record<Service, string> = {
  apple_music: "Streaming: Apple Music",
  spotify:     "Streaming: Spotify",
  tidal:       "Streaming: Tidal",
  deezer:      "Streaming: Deezer",
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { service?: string; context?: string } | null;
    const service = body?.service as Service | undefined;
    const context = body?.context as Context | undefined;

    if (!service || !VALID_SERVICES.includes(service)) return NextResponse.json({ ok: true });
    if (!context || !VALID_CONTEXTS.includes(context)) return NextResponse.json({ ok: true });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: true });

    await supabase.from("page_views").insert({
      user_id: user.id,
      section: SECTION[service],
      path:    `/${context}`,
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true });
}
