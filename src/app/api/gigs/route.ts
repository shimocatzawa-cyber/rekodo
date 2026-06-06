import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TM_API_KEY = process.env.TICKETMASTER_API_KEY;
const EVENT_CACHE_TTL_MS      = 24 * 60 * 60 * 1000;       // 24 h  — events change
const ATTRACTION_CACHE_TTL_MS = 7  * 24 * 60 * 60 * 1000;  // 7 days — artist IDs are stable
const MAX_ARTISTS  = 50;
const RECORD_BATCH = 400;
const TM_DELAY_MS  = 250; // stay under 5 req/s

type TmVenue = { name: string; city?: { name: string } };
export type TmEvent = {
  id: string;
  name: string;
  url: string;
  dates: { start: { localDate?: string; localTime?: string } };
  _embedded?: { venues?: TmVenue[] };
};


function isoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isoMonthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. City ───────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("city")
    .eq("id", user.id)
    .maybeSingle();

  const city = profile?.city?.trim() ?? null;
  if (!city) return Response.json({ events: [], city: null, artistCount: 0, totalArtists: 0 });

  // ── 2. Unique artists from collection ────────────────────────────────────
  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  const recordIds = [...new Set((links ?? []).map((l) => l.record_id))];
  const artistCovers = new Map<string, string | null>();

  for (let i = 0; i < recordIds.length; i += RECORD_BATCH) {
    const { data } = await supabase
      .from("records")
      .select("artist, cover_url")
      .in("id", recordIds.slice(i, i + RECORD_BATCH));
    for (const r of data ?? []) {
      if (!artistCovers.has(r.artist)) {
        artistCovers.set(r.artist, r.cover_url ?? null);
      }
    }
  }

  const artists = [...artistCovers.keys()].slice(0, MAX_ARTISTS);
  if (artists.length === 0) return Response.json({ events: [], city, artistCount: 0, totalArtists: 0 });

  // ── 3. Resolve artist → Ticketmaster attractionId (7-day cache) ──────────
  // Stored as { id: "K8vZ..." } or { id: null } (null = no TM page for this artist).
  // Caching null means we don't re-query artists we already know aren't on TM.
  const attractionCacheKeys = artists.map((a) => `attraction:${a.toLowerCase()}`);
  const attractionCacheExpiry = new Date(Date.now() - ATTRACTION_CACHE_TTL_MS).toISOString();

  const { data: cachedAttractions } = await supabase
    .from("gig_cache")
    .select("cache_key, results")
    .in("cache_key", attractionCacheKeys)
    .gt("cached_at", attractionCacheExpiry);

  // attractionMap: cache_key → attractionId (string) or null (not on TM)
  const attractionMap = new Map<string, string | null>(
    (cachedAttractions ?? []).map((r) => {
      const res = r.results as { id: string | null } | null;
      return [r.cache_key, res?.id ?? null];
    })
  );

  if (TM_API_KEY) {
    for (const artist of artists) {
      const cacheKey = `attraction:${artist.toLowerCase()}`;
      if (attractionMap.has(cacheKey)) continue; // already resolved (hit or confirmed miss)

      let attractionId: string | null = null;
      try {
        const url =
          `https://app.ticketmaster.com/discovery/v2/attractions.json` +
          `?keyword=${encodeURIComponent(artist)}` +
          `&classificationName=music` +
          `&apikey=${TM_API_KEY}` +
          `&size=1`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          attractionId = json._embedded?.attractions?.[0]?.id ?? null;
        }
      } catch { /* non-fatal */ }

      await supabase.from("gig_cache").upsert(
        { cache_key: cacheKey, results: { id: attractionId }, cached_at: new Date().toISOString() },
        { onConflict: "cache_key" }
      );
      attractionMap.set(cacheKey, attractionId);
      await sleep(TM_DELAY_MS);
    }
  }

  // ── 4. Fetch events by attractionId + city (24-hour cache) ───────────────
  const eventCacheKeys = artists.map((a) => `${a.toLowerCase()}:${city.toLowerCase()}`);
  const eventCacheExpiry = new Date(Date.now() - EVENT_CACHE_TTL_MS).toISOString();

  const { data: cachedEventRows } = await supabase
    .from("gig_cache")
    .select("cache_key, results")
    .in("cache_key", eventCacheKeys)
    .gt("cached_at", eventCacheExpiry);

  const eventCacheMap = new Map<string, TmEvent[]>(
    (cachedEventRows ?? []).map((r) => [r.cache_key, r.results as TmEvent[]])
  );

  type EnrichedEvent = TmEvent & { _artistName: string; _coverUrl: string | null };
  const allEvents: EnrichedEvent[] = [];

  for (const artist of artists) {
    const eventCacheKey = `${artist.toLowerCase()}:${city.toLowerCase()}`;
    let events: TmEvent[];

    if (eventCacheMap.has(eventCacheKey)) {
      events = eventCacheMap.get(eventCacheKey)!;
    } else {
      const attractionId = attractionMap.get(`attraction:${artist.toLowerCase()}`);

      if (!attractionId) {
        // Not on Ticketmaster — store empty so we don't try again for 24h
        events = [];
      } else {
        events = [];
        if (TM_API_KEY) {
          try {
            const url =
              `https://app.ticketmaster.com/discovery/v2/events.json` +
              `?attractionId=${attractionId}` +
              `&city=${encodeURIComponent(city)}` +
              `&startDateTime=${isoNow()}` +
              `&endDateTime=${isoMonthsFromNow(6)}` +
              `&apikey=${TM_API_KEY}` +
              `&size=5` +
              `&sort=date,asc`;
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) events = (await res.json())._embedded?.events ?? [];
          } catch { /* non-fatal */ }
          await sleep(TM_DELAY_MS);
        }
      }

      await supabase.from("gig_cache").upsert(
        { cache_key: eventCacheKey, results: events, cached_at: new Date().toISOString() },
        { onConflict: "cache_key" }
      );
    }

    const coverUrl = artistCovers.get(artist) ?? null;
    for (const ev of events) {
      allEvents.push({ ...ev, _artistName: artist, _coverUrl: coverUrl });
    }
  }

  // ── 5. Deduplicate by event ID, sort by date ──────────────────────────────
  const seen = new Set<string>();
  const deduped = allEvents.filter((ev) => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  deduped.sort((a, b) =>
    (a.dates?.start?.localDate ?? "").localeCompare(b.dates?.start?.localDate ?? "")
  );

  const artistCount = new Set(deduped.map((ev) => ev._artistName)).size;

  return Response.json({ events: deduped, city, artistCount, totalArtists: artists.length });
}
