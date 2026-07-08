import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── DB setup ─────────────────────────────────────────────────────────────────
// Before using this route, run in Supabase SQL editor:
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

// ── Collection fetch ──────────────────────────────────────────────────────────

async function fetchCollection(userId: string, supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never): Promise<RecordRow[]> {
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
  const genreCounts  = new Map<string, number>();
  const styleCounts  = new Map<string, number>();
  const labelCounts  = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  const decadeCounts = new Map<number, number>();
  const countryCounts = new Map<string, number>();

  for (const row of rows) {
    const r = getRecord(row);
    if (!r) continue;
    if (r.genre) genreCounts.set(r.genre, (genreCounts.get(r.genre) ?? 0) + 1);
    if (r.styles) for (const s of r.styles) if (s) styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1);
    if (r.label) labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
    if (r.artist) artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
    if (r.year) {
      const decade = Math.floor(r.year / 10) * 10;
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    }
    if (r.country) countryCounts.set(r.country, (countryCounts.get(r.country) ?? 0) + 1);
  }

  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);
  const deepArtistNames = new Set(topArtists.filter(([, c]) => c >= 3).map(([a]) => a));

  // Collect owned albums for top artists (to help Claude avoid re-recommending them)
  const ownedAlbumsSet = new Set<string>();
  for (const row of rows) {
    const r = getRecord(row);
    if (r?.artist && r?.album && deepArtistNames.has(r.artist)) {
      ownedAlbumsSet.add(`${r.artist} — ${r.album}`);
    }
  }

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
    deepArtists: [...deepArtistNames],
    decades:     [...decadeCounts.entries()].sort((a, b) => a[0] - b[0]),
    countries:   [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    recentAdds,
    ownedAlbums: [...ownedAlbumsSet].slice(0, 40),
  };
}

type CollectionContext = ReturnType<typeof buildContext>;

type ArchetypeSignals = Record<string, {
  score: number;
  label: string;
  uniqueStyles?: number;
  modalDecade?: number | null;
}>;

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

  return `You are the Echoes engine for rekōdo, a vinyl collector app. Analyse this collector's data and generate 5 discovery modules. Every album and artist you name must be real. Ground each recommendation in the actual collection data provided.

COLLECTOR PROFILE:
Records owned: ${ctx.total}
Primary archetype: ${archetype.primary} (${archetype.primaryScore}/100)
Secondary archetype: ${archetype.secondary ?? "none"}
Shadow archetype: ${archetype.shadow}

COLLECTION SIGNALS:
- Sonic Coherence: ${sig("sonicCoherence")}
- Style Range: ${sig("styleRange")} — ${archetype.signals?.styleRange?.uniqueStyles ?? 0} unique styles
- Historical Depth: ${sig("historicalDepth")} — modal decade: ${archetype.signals?.historicalDepth?.modalDecade ?? "?"}s
- Canon Obscurity: ${sig("canonObscurity")}
- Geographic Range: ${sig("geographicRange")}
- Artist Concentration: ${sig("artistConcentration")}
- Transgressive Index: ${sig("transgressiveIndex")}

COLLECTION BREAKDOWN:

Genres (name: count):
${ls(ctx.topGenres, (g, c) => `${g}: ${c}`)}

Style tags (name: count):
${ls(ctx.topStyles, (s, c) => `${s}: ${c}`)}

Decades (decade: count):
${ls(ctx.decades, (d, c) => `${d}s: ${c}`)}

Pressing countries (country: count):
${ls(ctx.countries, (c, n) => `${c}: ${n}`)}

Labels (label: count):
${ls(ctx.topLabels, (l, c) => `${l}: ${c}`)}

Most collected artists (artist: records owned):
${ctx.topArtists.map(([a, c]) => `  ${a}: ${c}`).join("\n")}

Deeply invested artists (3+ records owned): ${ctx.deepArtists.join(", ") || "none"}

Recently added (newest first):
${ctx.recentAdds.map(r => `  ${r}`).join("\n")}

Known owned albums (for most-collected artists — do not recommend any of these):
${ctx.ownedAlbums.map(a => `  ${a}`).join("\n")}

---

GENERATE ALL 5 MODULES:

1. MISSING MIDDLE
Find the two most distinct genre/style clusters this collector inhabits heavily (look at genre + style tag density to identify two separate worlds). Then identify 3–4 specific transitional records that bridge both worlds — connective-tissue albums that sit at the intersection. These are not general recommendations; they are the precise records a serious collector with BOTH clusters would logically own. The bridge description should explain what that connective tissue sounds like.

2. UNBOUGHT CLASSIC
Identify the single scene this collector is most deeply invested in (by record count density). List exactly 4 canonical, critically acknowledged touchstones from that scene that they almost certainly do not own. Do not list any album from the "known owned albums" list above. This module should feel like a checklist — deliberate, obvious gaps in otherwise deep territory.

3. SCENE PORTALS
Identify exactly 2 micro-scenes or labels that are adjacent to this collection but completely absent from it. One should feel like a natural next door (the logical extension); the other should feel like a left-turn (adjacent but surprising). For each, name one precise gateway album that is the best single entry point. Do not pick scenes that overlap with the collector's existing genres.

4. TASTE FORKS
Analyse where this collector's trajectory diverges from the expected path for their primary archetype (${archetype.primary}). What does a typical ${archetype.primary} collector usually move toward? Where has this collector clearly gone a different direction? Name exactly 2 albums that represent the road not taken — real records that collectors of this archetype commonly own but this collection is missing.

5. NEXT OBSESSION
Synthesise archetype + recent trajectory + style/genre momentum to name the single scene, subgenre, or artist cluster this collector is about to fall into — whether they know it yet or not. This module is the only one allowed to feel slightly uncanny or foreseen rather than analytical. Provide one precise entry-point album.

Return ONLY valid JSON, no markdown, no backticks, no explanation before or after:
{
  "missingMiddle": {
    "clusterA": "First cluster (2–5 words)",
    "clusterB": "Second cluster (2–5 words)",
    "bridge": "1–2 sentences describing what the connective tissue sounds like",
    "albums": [
      { "title": "Album Title", "artist": "Artist Name", "year": 1979, "why": "1 sentence grounded in their specific collection" }
    ]
  },
  "unboughtClassic": {
    "scene": "Scene name (3–6 words)",
    "intro": "1 sentence: why this is clearly already their territory",
    "albums": [
      { "title": "Album Title", "artist": "Artist Name", "year": 1979, "why": "1 sentence on why this is the gap" }
    ]
  },
  "scenePortals": [
    {
      "scene": "Micro-scene or label name",
      "adjacentTo": "The specific thing in their collection it connects to (3–5 words)",
      "why": "1–2 sentences on why this door opens here for this collector",
      "gatewayAlbum": { "title": "Album Title", "artist": "Artist Name", "year": 1979, "why": "1 sentence on why this is the best entry point" }
    }
  ],
  "tasteForks": {
    "archetypePattern": "1 sentence: what a typical ${archetype.primary} collector usually moves toward",
    "yourDivergence": "1–2 sentences: how this specific collection diverged from that pattern",
    "albums": [
      { "title": "Album Title", "artist": "Artist Name", "year": 1979, "why": "1 sentence on why this represents the road not taken" }
    ]
  },
  "nextObsession": {
    "prediction": "The scene or cluster (4–8 words)",
    "reasoning": "2–3 sentences — make it feel foreseen, not mechanical",
    "entryPoint": { "title": "Album Title", "artist": "Artist Name", "year": 1979, "why": "1 sentence" }
  }
}`;
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function generate(userId: string, supabase: Awaited<ReturnType<typeof createClient>>, cacheDb: ReturnType<typeof getServiceDb>) {
  // Require archetype data to exist (used for signals + archetype context)
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
  if (rows.length < 20) {
    return { error: "insufficient_collection" as const };
  }

  const ctx = buildContext(rows);
  const prompt = buildPrompt(ctx, {
    primary:      archetypeCache.primary_archetype,
    primaryScore: archetypeCache.primary_score ?? 0,
    secondary:    archetypeCache.secondary_archetype,
    shadow:       archetypeCache.shadow_archetype ?? "keeper",
    signals:      archetypeCache.signals,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "api_unavailable" as const };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are the Echoes engine for rekōdo. You generate vinyl collection discovery modules. Always return valid JSON exactly matching the schema requested. Names of artists, albums, and years must be real and accurate.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) return { error: "api_unavailable" as const };

  const resData = await res.json() as { content?: Array<{ type: string; text: string }> };
  const raw = resData.content?.[0]?.text ?? "";

  let echoes: unknown;
  try {
    echoes = JSON.parse(raw);
  } catch {
    // Try to extract JSON if there's surrounding text
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { error: "parse_error" as const };
    try { echoes = JSON.parse(match[0]); } catch { return { error: "parse_error" as const }; }
  }

  // Cache result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (cacheDb as any)
    .from("archetype_cache")
    .update({
      echoes_data: echoes,
      echoes_generated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { data: echoes };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isSupporter(supabase, user.id))) {
    return Response.json({ error: "Supporter access required" }, { status: 403 });
  }

  const cacheDb = getServiceDb();

  // Check cache (30-day TTL)
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
  const result = await generate(user.id, supabase, cacheDb);
  if ("error" in result) {
    const status = result.error === "api_unavailable" ? 503 : result.error === "archetypes_required" ? 412 : 500;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ...(result.data as object), cached: false });
}
