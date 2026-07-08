import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── DB setup ─────────────────────────────────────────────────────────────────
// Run in Supabase SQL editor before using this route:
//   ALTER TABLE archetype_cache
//     ADD COLUMN IF NOT EXISTS echoes_data jsonb,
//     ADD COLUMN IF NOT EXISTS echoes_generated_at timestamptz;

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RecordRow = {
  date_added: string | null;
  records: {
    artist: string | null;
    album: string | null;
    year: number | null;
    genre: string | null;
    styles: string[] | null;
    label: string | null;
    country: string | null;
  } | null;
};

export interface EchoAlbum {
  title: string;
  artist: string;
  year: number;
  why: string;
  imageUrl?: string;
}

// ── Collection fetch ──────────────────────────────────────────────────────────

async function fetchCollection(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<RecordRow[]> {
  const PAGE_SIZE = 1000;
  let all: RecordRow[] = [];
  let page = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: batch } = await (supabase as any)
      .from("user_records")
      .select("date_added, records(artist, album, year, genre, styles, label, country)")
      .eq("user_id", userId)
      .order("date_added", { ascending: false, nullsFirst: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch as RecordRow[]);
    if (batch.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

function getRecord(row: RecordRow) {
  if (!row.records) return null;
  return Array.isArray(row.records) ? (row.records[0] ?? null) : row.records;
}

// ── Context builder ───────────────────────────────────────────────────────────

function buildContext(rows: RecordRow[]) {
  const genreCounts   = new Map<string, number>();
  const styleCounts   = new Map<string, number>();
  const labelCounts   = new Map<string, number>();
  const artistCounts  = new Map<string, number>();
  const decadeCounts  = new Map<number, number>();
  const countryCounts = new Map<string, number>();
  // All owned albums — used to prevent Claude recommending owned records
  const ownedAlbumsSet = new Set<string>();

  for (const row of rows) {
    const r = getRecord(row);
    if (!r) continue;
    if (r.genre)   genreCounts.set(r.genre, (genreCounts.get(r.genre) ?? 0) + 1);
    if (r.styles)  for (const s of r.styles) if (s) styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1);
    if (r.label)   labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
    if (r.artist)  artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
    if (r.year) {
      const decade = Math.floor(r.year / 10) * 10;
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    }
    if (r.country) countryCounts.set(r.country, (countryCounts.get(r.country) ?? 0) + 1);
    // Include every owned album so Claude can't accidentally recommend them
    if (r.artist && r.album) ownedAlbumsSet.add(`${r.artist} — ${r.album}`);
  }

  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);

  const recentAdds = rows
    .slice(0, 15)
    .map(row => {
      const r = getRecord(row);
      if (!r?.artist || !r?.album) return null;
      const tags = [r.genre, ...(r.styles?.slice(0, 2) ?? [])].filter(Boolean).join(", ");
      return `${r.artist} — ${r.album} (${r.year ?? "?"})${tags ? ` [${tags}]` : ""}`;
    })
    .filter((x): x is string => x !== null);

  return {
    total:       rows.length,
    topGenres:   [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    topStyles:   [...styleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    topLabels:   [...labelCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    topArtists:  topArtists.slice(0, 20),
    deepArtists: topArtists.filter(([, c]) => c >= 3).map(([a]) => a),
    decades:     [...decadeCounts.entries()].sort((a, b) => a[0] - b[0]),
    countries:   [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    recentAdds,
    ownedAlbums: [...ownedAlbumsSet],
  };
}

type CollectionContext = ReturnType<typeof buildContext>;

type ArchetypeSignals = Record<string, {
  score: number;
  label: string;
  uniqueStyles?: number;
  modalDecade?: number | null;
}>;

// ── Artwork fetch ─────────────────────────────────────────────────────────────

async function fetchArtwork(albums: EchoAlbum[], headers: Record<string, string>) {
  const BATCH      = 4;
  const DELAY_MS   = 4100; // keeps well under 60 req/min for consumer key
  const PLACEHOLDER = "spacer"; // Discogs placeholder image fragment

  for (let i = 0; i < albums.length; i += BATCH) {
    if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));
    await Promise.all(
      albums.slice(i, i + BATCH).map(async (album) => {
        try {
          const q = encodeURIComponent(`${album.artist} ${album.title}`);
          const res = await fetch(
            `https://api.discogs.com/database/search?q=${q}&type=master&per_page=3`,
            { headers, signal: AbortSignal.timeout(5000) }
          );
          if (!res.ok) return;
          const json = await res.json() as { results?: { cover_image?: string }[] };
          const cover = json.results?.[0]?.cover_image;
          if (cover && !cover.includes(PLACEHOLDER)) album.imageUrl = cover;
        } catch { /* skip — artwork is optional */ }
      })
    );
  }
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  ctx: CollectionContext,
  archetype: { primary: string; primaryScore: number; secondary: string | null; shadow: string; signals: ArchetypeSignals }
): string {
  const ls = (entries: [string | number, number][], fmt: (k: string | number, v: number) => string) =>
    entries.map(([k, v]) => `  ${fmt(k, v)}`).join("\n");

  const sig = (key: string) => {
    const s = archetype.signals?.[key];
    return s ? `${s.label} (${s.score}/100)` : "unknown";
  };

  // Pass all owned albums so Claude can reliably avoid them
  const ownedBlock = ctx.ownedAlbums.length > 0
    ? ctx.ownedAlbums.slice(0, 300).map(a => `  ${a}`).join("\n")
    : "  (none recorded)";

  return `You are the Echoes engine for rekōdo, a vinyl collector app. Generate 5 discovery modules. Every album/artist must be real. Ground every recommendation in the collection data below.

COLLECTOR PROFILE:
Records: ${ctx.total} | Archetype: ${archetype.primary} (${archetype.primaryScore}/100) | Secondary: ${archetype.secondary ?? "none"} | Shadow: ${archetype.shadow}

SIGNALS:
Sonic Coherence: ${sig("sonicCoherence")} | Style Range: ${sig("styleRange")} (${archetype.signals?.styleRange?.uniqueStyles ?? 0} styles) | Historical Depth: ${sig("historicalDepth")} (modal ${archetype.signals?.historicalDepth?.modalDecade ?? "?"}s) | Canon Obscurity: ${sig("canonObscurity")} | Geographic Range: ${sig("geographicRange")} | Artist Concentration: ${sig("artistConcentration")} | Transgressive: ${sig("transgressiveIndex")}

Genres: ${ctx.topGenres.map(([g, c]) => `${g}:${c}`).join(", ")}
Styles: ${ctx.topStyles.map(([s, c]) => `${s}:${c}`).join(", ")}
Decades: ${ctx.decades.map(([d, c]) => `${d}s:${c}`).join(", ")}
Countries: ${ctx.countries.map(([c, n]) => `${c}:${n}`).join(", ")}
Labels: ${ctx.topLabels.map(([l, c]) => `${l}:${c}`).join(", ")}
Top artists: ${ctx.topArtists.map(([a, c]) => `${a}(${c})`).join(", ")}
Deep artists (3+ records): ${ctx.deepArtists.join(", ") || "none"}

Recently added:
${ctx.recentAdds.map(r => `  ${r}`).join("\n")}

OWNED ALBUMS — DO NOT recommend any album listed here:
${ownedBlock}

---

RULES:
- "why" field: max 10 words, factual, no filler (e.g. "Bridges kosmische and isolationist drone via motorik pulse")
- Never recommend an album from the owned list above
- Every artist and title must be real and accurately named

GENERATE ALL 5:

1. MISSING MIDDLE: Two distinct genre/style clusters the collector inhabits heavily. 3–4 transitional records bridging both worlds. Bridge = 1 short sentence about what the connective tissue sounds like.

2. UNBOUGHT CLASSIC: The scene with the most density. 4 canonical touchstones they don't own. Intro = 1 short sentence.

3. SCENE PORTALS: 2 adjacent micro-scenes/labels completely absent from collection. One natural next-step, one slight left-turn. One gateway album each.

4. TASTE FORKS: Where this collector's path diverges from a typical ${archetype.primary}. 2 albums = roads not taken. archetypePattern + yourDivergence = 1 sentence each.

5. NEXT OBSESSION: Single scene they're about to fall into. One entry-point album. reasoning = 2 sentences, slightly uncanny.

Return ONLY valid JSON, no markdown, no backticks:
{
  "missingMiddle": {
    "clusterA": "2–5 words",
    "clusterB": "2–5 words",
    "bridge": "1 sentence",
    "albums": [{ "title": "", "artist": "", "year": 0, "why": "max 10 words" }]
  },
  "unboughtClassic": {
    "scene": "3–6 words",
    "intro": "1 sentence",
    "albums": [{ "title": "", "artist": "", "year": 0, "why": "max 10 words" }]
  },
  "scenePortals": [
    {
      "scene": "",
      "adjacentTo": "3–5 words",
      "why": "1–2 sentences",
      "gatewayAlbum": { "title": "", "artist": "", "year": 0, "why": "max 10 words" }
    }
  ],
  "tasteForks": {
    "archetypePattern": "1 sentence",
    "yourDivergence": "1 sentence",
    "albums": [{ "title": "", "artist": "", "year": 0, "why": "max 10 words" }]
  },
  "nextObsession": {
    "prediction": "4–8 words",
    "reasoning": "2 sentences",
    "entryPoint": { "title": "", "artist": "", "year": 0, "why": "max 10 words" }
  }
}`;
}

// ── Core generate ─────────────────────────────────────────────────────────────

async function generate(userId: string, supabase: Awaited<ReturnType<typeof createClient>>, cacheDb: ReturnType<typeof getServiceDb>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: archetypeCache } = await (cacheDb as any)
    .from("archetype_cache")
    .select("signals, primary_archetype, primary_score, secondary_archetype, shadow_archetype")
    .eq("user_id", userId)
    .maybeSingle() as {
      data: {
        signals: ArchetypeSignals | null;
        primary_archetype: string | null;
        primary_score: number | null;
        secondary_archetype: string | null;
        shadow_archetype: string | null;
      } | null;
    };

  if (!archetypeCache?.primary_archetype || !archetypeCache.signals) {
    return { error: "archetypes_required" as const };
  }

  const rows = await fetchCollection(userId, supabase);
  if (rows.length < 20) return { error: "insufficient_collection" as const };

  const ctx    = buildContext(rows);
  const prompt = buildPrompt(ctx, {
    primary:      archetypeCache.primary_archetype,
    primaryScore: archetypeCache.primary_score ?? 0,
    secondary:    archetypeCache.secondary_archetype,
    shadow:       archetypeCache.shadow_archetype ?? "keeper",
    signals:      archetypeCache.signals,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "api_unavailable" as const };

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are the Echoes engine for rekōdo. Return valid JSON exactly matching the requested schema. Artist names, album titles, and years must be real and accurate.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!claudeRes.ok) return { error: "api_unavailable" as const };

  const claudeData = await claudeRes.json() as { content?: Array<{ type: string; text: string }> };
  const raw = claudeData.content?.[0]?.text ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let echoes: any;
  try {
    echoes = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { error: "parse_error" as const };
    try { echoes = JSON.parse(match[0]); } catch { return { error: "parse_error" as const }; }
  }

  // Fetch Discogs artwork for all recommended albums
  const discKey    = process.env.DISCOGS_CONSUMER_KEY;
  const discSecret = process.env.DISCOGS_CONSUMER_SECRET;
  const discHeaders: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
  if (discKey && discSecret) discHeaders["Authorization"] = `Discogs key=${discKey}, secret=${discSecret}`;

  const allAlbums: EchoAlbum[] = [
    ...(echoes.missingMiddle?.albums ?? []),
    ...(echoes.unboughtClassic?.albums ?? []),
    ...(echoes.scenePortals?.map((p: { gatewayAlbum: EchoAlbum }) => p.gatewayAlbum) ?? []),
    ...(echoes.tasteForks?.albums ?? []),
    ...(echoes.nextObsession?.entryPoint ? [echoes.nextObsession.entryPoint] : []),
  ];
  await fetchArtwork(allAlbums, discHeaders);

  // Cache result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (cacheDb as any)
    .from("archetype_cache")
    .update({ echoes_data: echoes, echoes_generated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { data: echoes };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isSupporter(supabase, user.id))) {
    return Response.json({ error: "Supporter access required" }, { status: 403 });
  }

  const cacheDb = getServiceDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cache } = await (cacheDb as any)
    .from("archetype_cache")
    .select("echoes_data, echoes_generated_at")
    .eq("user_id", user.id)
    .maybeSingle() as { data: { echoes_data: unknown | null; echoes_generated_at: string | null } | null };

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (
    cache?.echoes_data &&
    cache.echoes_generated_at &&
    Date.now() - new Date(cache.echoes_generated_at).getTime() < thirtyDays
  ) {
    return Response.json({ ...(cache.echoes_data as object), cached: true });
  }

  const result = await generate(user.id, supabase, cacheDb);
  if ("error" in result) {
    const status = result.error === "api_unavailable" ? 503 : result.error === "archetypes_required" ? 412 : 500;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ...(result.data as object), cached: false });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isSupporter(supabase, user.id))) {
    return Response.json({ error: "Supporter access required" }, { status: 403 });
  }

  const cacheDb = getServiceDb();
  const result  = await generate(user.id, supabase, cacheDb);
  if ("error" in result) {
    const status = result.error === "api_unavailable" ? 503 : result.error === "archetypes_required" ? 412 : 500;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ...(result.data as object), cached: false });
}
