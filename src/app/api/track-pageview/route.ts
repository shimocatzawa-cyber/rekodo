import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ordered by specificity isn't required since each prefix is distinct, but
// keep labels matching AppNav.tsx so admin reporting lines up with what
// users actually see in the nav.
const SECTION_BY_PREFIX: [prefix: string, label: string][] = [
  ["/selects",            "Rekōdo Selects"],
  ["/collection",         "Collection"],
  ["/deep-dive",          "Deep Dive"],
  ["/dig",                "Dig"],
  ["/lists",              "Lists"],
  ["/insights",           "Insights"],
  ["/archetypes",         "Archetypes"],
  ["/community",          "Community"],
  ["/constellation",      "Constellation"],
  ["/about",              "Support"],
  ["/settings",           "Settings"],
  ["/library",            "Library"],
  ["/gigs",               "Gigs"],
  ["/quiz",               "Quiz"],
  ["/p",                  "Profile"],
];

function sectionForPath(path: string): string | null {
  for (const [prefix, label] of SECTION_BY_PREFIX) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return label;
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const path = body?.path;
  if (typeof path !== "string") {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const section = sectionForPath(path);
  if (!section) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("page_views").insert({ user_id: user.id, section, path });
  if (error) console.error("[track-pageview] insert failed:", error.message);

  return NextResponse.json({ ok: true });
}
