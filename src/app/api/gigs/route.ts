import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

const TM_API_KEY        = process.env.TICKETMASTER_API_KEY;
const EVENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type TmAttraction = { id: string; name: string };
type TmVenue      = { name: string; city?: { name: string } };
export type TmEvent = {
  id: string;
  name: string;
  url: string;
  dates: { start: { localDate?: string; localTime?: string } };
  _embedded?: { venues?: TmVenue[]; attractions?: TmAttraction[] };
};

function isoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isoMonthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. City + country code from profile ───────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("city, country_code")
    .eq("id", user.id)
    .maybeSingle();

  const city        = profile?.city?.trim() ?? null;
  const countryCode = (profile as { country_code?: string } | null)?.country_code?.trim() ?? null;

  if (!city) return Response.json({ events: [], city: null, artistCount: 0, totalArtists: 0 });

  // ── 2. Fetch all music events in city (24 h cache) ───────────────────────
  const cacheKey = `city_events:${city.toLowerCase()}${countryCode ? `:${countryCode.toLowerCase()}` : ""}`;
  const cacheExpiry = new Date(Date.now() - EVENT_CACHE_TTL_MS).toISOString();

  const { data: cached } = await supabase
    .from("gig_cache")
    .select("results")
    .eq("cache_key", cacheKey)
    .gt("cached_at", cacheExpiry)
    .maybeSingle();

  let rawEvents: TmEvent[] = [];

  if (cached) {
    rawEvents = cached.results as TmEvent[];
  } else if (TM_API_KEY) {
    try {
      const url =
        `https://app.ticketmaster.com/discovery/v2/events.json` +
        `?city=${encodeURIComponent(city)}` +
        (countryCode ? `&countryCode=${encodeURIComponent(countryCode)}` : "") +
        `&classificationName=music` +
        `&startDateTime=${isoNow()}` +
        `&endDateTime=${isoMonthsFromNow(9)}` +
        `&apikey=${TM_API_KEY}` +
        `&size=50` +
        `&sort=date,asc`;

      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        rawEvents = json._embedded?.events ?? [];
      }
    } catch { /* non-fatal */ }

    await getServiceDb().from("gig_cache").upsert(
      { cache_key: cacheKey, results: rawEvents, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    );
  }

  // ── 4. Shape events ───────────────────────────────────────────────────────
  type EnrichedEvent = TmEvent & { _artistName: string; _coverUrl: string | null };

  const seen    = new Set<string>();
  const deduped: EnrichedEvent[] = [];

  for (const ev of rawEvents) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    const attractionName = ev._embedded?.attractions?.[0]?.name ?? ev.name;
    deduped.push({ ...ev, _artistName: attractionName, _coverUrl: null });
  }

  deduped.sort((a, b) =>
    (a.dates?.start?.localDate ?? "").localeCompare(b.dates?.start?.localDate ?? "")
  );

  return Response.json({
    events:       deduped,
    city,
    artistCount:  deduped.length,
    totalArtists: deduped.length,
  });
}
