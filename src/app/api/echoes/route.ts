import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── DB setup ──────────────────────────────────────────────────────────────────
// Run once in Supabase SQL editor:
//
//   CREATE EXTENSION IF NOT EXISTS pg_trgm;
//
//   CREATE OR REPLACE FUNCTION echoes_validate_albums(
//     p_user_id uuid,
//     p_picks   jsonb
//   )
//   RETURNS jsonb
//   LANGUAGE sql STABLE AS $$
//     SELECT coalesce(jsonb_agg(
//       jsonb_build_object(
//         'input_artist', pick->>'artist',
//         'input_title',  pick->>'title',
//         'artist',  r.artist,
//         'title',   r.album,
//         'year',    r.year,
//         'genre',   r.genre,
//         'styles',  r.styles,
//         'label',   r.label,
//         'found',   r.id IS NOT NULL,
//         'owned',   CASE WHEN r.id IS NOT NULL
//                      THEN EXISTS(
//                        SELECT 1 FROM user_records ur
//                        WHERE ur.user_id = p_user_id AND ur.record_id = r.id
//                      )
//                    ELSE false END
//       )
//     ), '[]'::jsonb)
//     FROM jsonb_array_elements(p_picks) pick
//     LEFT JOIN LATERAL (
//       SELECT *
//       FROM records
//       WHERE similarity(lower(artist), lower(pick->>'artist')) > 0.45
//         AND similarity(lower(album),  lower(pick->>'title'))  > 0.45
//       ORDER BY
//         similarity(lower(artist), lower(pick->>'artist')) +
//         similarity(lower(album),  lower(pick->>'title'))   DESC
//       LIMIT 1
//     ) r ON true;
//   $$;

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
    artist: string | null; album: string | null; year: number | null;
    genre: string | null; styles: string[] | null; label: string | null; country: string | null;
  } | null;
};

export interface EchoAlbum {
  title: string; artist: string; year?: number | null; why: string; imageUrl?: string;
}

type ArchetypeSignals = Record<string, {
  score: number; label: string; subtext?: string; unavailable?: boolean;
  uniqueStyles?: number; modalDecade?: number | null; rhythmType?: string;
  digitalOnlyArtists?: string[]; top3Pct?: number; uniqueCountries?: number;
  topCountry?: string | null; ratio?: number; uniqueFeelings?: number; taggedCount?: number;
}>;

interface ValidatedAlbum {
  input_artist: string; input_title: string;
  artist?: string | null; title?: string | null;
  year?: number | null; genre?: string | null;
  styles?: string[] | null; label?: string | null;
  found: boolean; owned: boolean;
}

const SHADOW_TRAIT: Record<string, string> = {
  keeper:    "craves stability; resists drift and the unfamiliar",
  seeker:    "craves novelty; avoids settling or repeating",
  scholar:   "craves context and lineage; avoids the uninformed",
  ritualist: "craves precision and slowness; avoids carelessness",
  hunter:    "craves rarity and trophies; avoids the ordinary",
  lover:     "craves feeling and personal connection; avoids the cerebral",
  alchemist: "craves synthesis and cross-contamination; avoids purity",
  pilgrim:   "craves geographic and pressing specificity; avoids the placeless",
  ruler:     "craves domain mastery; avoids breadth",
  outlaw:    "craves transgression and noise; avoids convention",
  caregiver: "craves sharing and contextualising; avoids collecting in isolation",
};

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

  for (const row of rows) {
    const r = getRecord(row);
    if (!r) continue;
    if (r.genre)  genreCounts.set(r.genre, (genreCounts.get(r.genre) ?? 0) + 1);
    if (r.styles) for (const s of r.styles) if (s) styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1);
    if (r.label)  labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
    if (r.artist) artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
    if (r.year)   decadeCounts.set(Math.floor(r.year / 10) * 10, (decadeCounts.get(Math.floor(r.year / 10) * 10) ?? 0) + 1);
    if (r.country) countryCounts.set(r.country, (countryCounts.get(r.country) ?? 0) + 1);
  }

  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);

  const recentAdds = rows.slice(0, 12).map(row => {
    const r = getRecord(row);
    if (!r?.artist || !r?.album) return null;
    const tags = [r.genre, ...(r.styles?.slice(0, 2) ?? [])].filter(Boolean).join(", ");
    return `${r.artist} — ${r.album}${tags ? ` [${tags}]` : ""}`;
  }).filter((x): x is string => x !== null);

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
  };
}

type CollectionContext = ReturnType<typeof buildContext>;

// ── DB validation + owned-album check ─────────────────────────────────────────
// Single RPC call validates every pick against the 467k records table:
//   - not found on Discogs → removed (hallucination)
//   - found but owned    → removed
//   - found and unowned  → enriched with real metadata (year, genre, etc.)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function validateAndEnrich(echoes: any, userId: string, db: ReturnType<typeof getServiceDb>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPicks: { artist: string; title: string }[] = [
    ...(echoes.missingMiddle?.albums     ?? []),
    ...(echoes.unboughtClassic?.albums   ?? []),
    ...(echoes.tasteForks?.albums        ?? []),
    ...((echoes.scenePortals ?? []).map((p: { gatewayAlbum?: EchoAlbum }) => p.gatewayAlbum).filter(Boolean)),
    ...(echoes.nextObsession?.entryPoint ? [echoes.nextObsession.entryPoint] : []),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ].map((a: any) => ({ artist: a.artist, title: a.title }));

  if (allPicks.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("echoes_validate_albums", {
    p_user_id: userId,
    p_picks:   allPicks,
  });

  if (error) {
    // Function might not exist yet — fail open so Claude's output still renders
    console.error("[Echoes] DB validation error (run the migration SQL):", error.message);
    return;
  }

  const results = (data ?? []) as ValidatedAlbum[];
  const lookup  = new Map(results.map(r => [`${r.input_artist}|||${r.input_title}`, r]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function process(album: any): EchoAlbum | null {
    const r = lookup.get(`${album.artist}|||${album.title}`);
    if (!r || !r.found || r.owned) return null;
    return {
      title:  r.title   ?? album.title,
      artist: r.artist  ?? album.artist,
      year:   r.year    ?? undefined,
      why:    album.why,
    };
  }

  if (echoes.missingMiddle?.albums)
    echoes.missingMiddle.albums = (echoes.missingMiddle.albums as EchoAlbum[]).map(process).filter(Boolean);
  if (echoes.unboughtClassic?.albums)
    echoes.unboughtClassic.albums = (echoes.unboughtClassic.albums as EchoAlbum[]).map(process).filter(Boolean);
  if (echoes.tasteForks?.albums)
    echoes.tasteForks.albums = (echoes.tasteForks.albums as EchoAlbum[]).map(process).filter(Boolean);
  if (Array.isArray(echoes.scenePortals)) {
    echoes.scenePortals = echoes.scenePortals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => {
        if (!p.gatewayAlbum) return null;
        const processed = process(p.gatewayAlbum);
        return processed ? { ...p, gatewayAlbum: processed } : null;
      })
      .filter(Boolean);
  }
  if (echoes.nextObsession?.entryPoint) {
    echoes.nextObsession.entryPoint = process(echoes.nextObsession.entryPoint);
  }
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  ctx: CollectionContext,
  archetype: {
    primary: string; primaryScore: number; secondary: string | null;
    shadow: string; namedPairing: string | null; signals: ArchetypeSignals;
  }
): string {
  const s = archetype.signals ?? {};

  const sig  = (k: string) => s[k] ? `${s[k].label} (${s[k].score}/100)` : "unknown";
  const sval = (k: string) => s[k]?.score ?? 0;

  const shadowTrait = SHADOW_TRAIT[archetype.shadow] ?? "";
  const rhythmType  = s.acquisitionRhythm?.rhythmType ?? s.acquisitionRhythm?.label ?? "unknown";
  const digitalOnly = (s.digitalDivergence?.digitalOnlyArtists ?? []).join(", ");

  const rhythmTone =
    rhythmType === "Ritualist" ? "Frame as slow and inevitable — this will unfold over months." :
    rhythmType === "Binge"     ? "Frame as imminent and total — they're already circling this." :
                                 "Frame as a steady drift they may not have noticed yet.";

  const canonFrame =
    sval("canonObscurity") > 65 ? "Collector leans obscure — frame gaps as 'records you've been circling without entering'." :
    sval("canonObscurity") < 35 ? "Collector is canonical — frame as genuine gaps they'd naturally own." :
                                   "Mixed balance — surface gaps that feel unresolved, not obviously avoided.";

  const portalFrame =
    sval("labelLoyalty") > 55 ? "Collector navigates by label — Portal 1 should be an adjacent label family." :
                                 "Labels don't organise this world — use scene/genre portals instead.";

  return `Generate 5 Echoes discovery modules for this record collector. Output artist names and album titles as accurately as possible — recommendations will be validated against a music database and dropped if not found, so precision matters.

ARCHETYPE: ${archetype.primary} (${archetype.primaryScore}/100)${archetype.namedPairing ? ` — "${archetype.namedPairing}"` : ""} | Secondary: ${archetype.secondary ?? "none"} | Shadow: ${archetype.shadow}

DRIVING SIGNALS:
Sonic Coherence:      ${sig("sonicCoherence")}
Artist Concentration: ${sig("artistConcentration")}
Canon Obscurity:      ${sig("canonObscurity")}
Label Loyalty:        ${sig("labelLoyalty")}${s.labelLoyalty?.top3Pct != null ? ` (top 3 labels = ${Math.round(s.labelLoyalty.top3Pct)}% of collection)` : ""}
Digital Divergence:   ${sig("digitalDivergence")}${digitalOnly ? ` — digital-only artists: ${digitalOnly}` : ""}
Acquisition Rhythm:   ${rhythmType} — ${sig("acquisitionRhythm")}
Transgressive Index:  ${sig("transgressiveIndex")}

COLLECTION (${ctx.total} records):
Genres:   ${ctx.topGenres.map(([g, c]) => `${g}:${c}`).join(", ")}
Styles:   ${ctx.topStyles.map(([s, c]) => `${s}:${c}`).join(", ")}
Decades:  ${ctx.decades.map(([d, c]) => `${d}s:${c}`).join(", ")}
Labels:   ${ctx.topLabels.map(([l, c]) => `${l}:${c}`).join(", ")}
Artists:  ${ctx.topArtists.map(([a, c]) => `${a}(${c})`).join(", ")}
Deep (3+): ${ctx.deepArtists.join(", ") || "none"}
Recent:   ${ctx.recentAdds.join(" | ")}

MODULE 01 — MISSING MIDDLE
${sval("sonicCoherence") > 65 ? "High coherence: clusters are adjacent — bridge is subtle." : sval("sonicCoherence") < 40 ? "Low coherence: clusters are far apart — bridge does real connective work." : "Medium coherence: bridge records are natural intermediaries."}
Find the 2 most distinct genre/style clusters in this collection. Give 3–4 bridge records.

MODULE 02 — UNBOUGHT CLASSIC
${canonFrame}
Find the collector's densest scene. Give 4 canonical touchstones they don't already own.

MODULE 03 — SCENE PORTALS
${portalFrame}${digitalOnly ? ` Consider connecting to digital-only artists: ${digitalOnly}.` : ""}
Give 2 adjacent micro-scenes: one natural next-step, one slight left-turn. One gateway album each.

MODULE 04 — TASTE FORKS
Shadow archetype: ${archetype.shadow} — ${shadowTrait}
"Road not taken" albums must come from ${archetype.shadow} territory.
archetypePattern = what a typical ${archetype.primary} moves toward.
yourDivergence = how THIS collection veered away from ${archetype.shadow} territory.

MODULE 05 — NEXT OBSESSION
Rhythm: ${rhythmType}. ${rhythmTone}
Often lives in shadow (${archetype.shadow}) territory. Give 1 entry-point album.

IMPORTANT: Do not include year in your output — it will be sourced from the database.

Return ONLY valid JSON, no markdown:
{
  "missingMiddle": {
    "clusterA": "2–5 words",
    "clusterB": "2–5 words",
    "bridge": "1 sentence",
    "albums": [{ "artist": "", "title": "", "why": "max 10 words" }]
  },
  "unboughtClassic": {
    "scene": "3–6 words",
    "intro": "1 sentence",
    "albums": [{ "artist": "", "title": "", "why": "max 10 words" }]
  },
  "scenePortals": [
    { "scene": "", "adjacentTo": "3–5 words", "why": "1–2 sentences", "gatewayAlbum": { "artist": "", "title": "", "why": "max 10 words" } }
  ],
  "tasteForks": {
    "archetypePattern": "1 sentence",
    "yourDivergence": "1 sentence",
    "albums": [{ "artist": "", "title": "", "why": "max 10 words" }]
  },
  "nextObsession": {
    "prediction": "4–8 words",
    "reasoning": "2 sentences",
    "entryPoint": { "artist": "", "title": "", "why": "max 10 words" }
  }
}`;
}

// ── Core generate ─────────────────────────────────────────────────────────────

async function generate(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  cacheDb: ReturnType<typeof getServiceDb>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ac } = await (cacheDb as any)
    .from("archetype_cache")
    .select("signals, primary_archetype, primary_score, secondary_archetype, shadow_archetype, named_pairing")
    .eq("user_id", userId)
    .maybeSingle() as {
      data: {
        signals: ArchetypeSignals | null;
        primary_archetype: string | null; primary_score: number | null;
        secondary_archetype: string | null; shadow_archetype: string | null;
        named_pairing: string | null;
      } | null;
    };

  if (!ac?.primary_archetype || !ac.signals) return { error: "archetypes_required" as const };

  const rows = await fetchCollection(userId, supabase);
  if (rows.length < 20) return { error: "insufficient_collection" as const };

  const ctx    = buildContext(rows);
  const prompt = buildPrompt(ctx, {
    primary:      ac.primary_archetype,
    primaryScore: ac.primary_score ?? 0,
    secondary:    ac.secondary_archetype,
    shadow:       ac.shadow_archetype ?? "keeper",
    namedPairing: ac.named_pairing,
    signals:      ac.signals,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "api_unavailable" as const };

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      system:     "You are a music discovery engine. Return valid JSON only — no markdown, no code blocks. Output real artist names and album titles accurately; recommendations are validated against a 467,000-record music database and silently dropped if not found.",
      messages:   [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!claudeRes.ok) return { error: "api_unavailable" as const };

  const claudeData = await claudeRes.json() as { content?: Array<{ type: string; text?: string }> };
  const raw = claudeData.content?.[0]?.type === "text" ? (claudeData.content[0].text ?? "") : "";
  if (!raw) return { error: "parse_error" as const };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let echoes: any;
  try {
    echoes = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { console.error("[Echoes] No JSON in response:", raw.slice(0, 300)); return { error: "parse_error" as const }; }
    try { echoes = JSON.parse(match[0]); } catch { return { error: "parse_error" as const }; }
  }

  // Validate every pick against the global records table:
  //   - album not in 467k DB → dropped (hallucination)
  //   - album in DB but owned → dropped
  //   - album in DB and unowned → enriched with real year/genre/label
  await validateAndEnrich(echoes, userId, cacheDb);

  // Signal context for the UI
  echoes._context = {
    sonicCoherence:      ac.signals.sonicCoherence      ? { score: ac.signals.sonicCoherence.score,      label: ac.signals.sonicCoherence.label }      : null,
    canonObscurity:      ac.signals.canonObscurity      ? { score: ac.signals.canonObscurity.score,      label: ac.signals.canonObscurity.label }      : null,
    labelLoyalty:        ac.signals.labelLoyalty        ? { score: ac.signals.labelLoyalty.score,        label: ac.signals.labelLoyalty.label }        : null,
    artistConcentration: ac.signals.artistConcentration ? { score: ac.signals.artistConcentration.score, label: ac.signals.artistConcentration.label } : null,
    transgressiveIndex:  ac.signals.transgressiveIndex  ? { score: ac.signals.transgressiveIndex.score,  label: ac.signals.transgressiveIndex.label }  : null,
    acquisitionRhythm:   ac.signals.acquisitionRhythm   ? { label: ac.signals.acquisitionRhythm.label,   rhythmType: ac.signals.acquisitionRhythm.rhythmType } : null,
    digitalDivergence:   ac.signals.digitalDivergence   ? { score: ac.signals.digitalDivergence.score,   label: ac.signals.digitalDivergence.label, digitalOnlyArtists: ac.signals.digitalDivergence.digitalOnlyArtists ?? [] } : null,
    shadow:      ac.shadow_archetype,
    namedPairing: ac.named_pairing,
  };

  // Cache
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
  if (!(await isSupporter(supabase, user.id))) return Response.json({ error: "Supporter access required" }, { status: 403 });

  const cacheDb = getServiceDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cache } = await (cacheDb as any)
    .from("archetype_cache")
    .select("echoes_data, echoes_generated_at")
    .eq("user_id", user.id)
    .maybeSingle() as { data: { echoes_data: unknown | null; echoes_generated_at: string | null } | null };

  const cacheTime   = cache?.echoes_generated_at ? new Date(cache.echoes_generated_at).getTime() : 0;
  const thirtyDays  = 30 * 24 * 60 * 60 * 1000;
  const cacheExpired = !cacheTime || (Date.now() - cacheTime) > thirtyDays;

  if (!cacheExpired && cache?.echoes_data) {
    // Check if the collection has grown since the cache was built
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newest } = await (supabase as any)
      .from("user_records")
      .select("date_added")
      .eq("user_id", user.id)
      .order("date_added", { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { date_added: string } | null };

    const newestAdd = newest?.date_added ? new Date(newest.date_added).getTime() : 0;

    if (newestAdd <= cacheTime) {
      // Cache is fresh and collection hasn't changed
      return Response.json({ ...(cache.echoes_data as object), cached: true });
    }
    // Collection has new records — fall through to regenerate
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
  if (!(await isSupporter(supabase, user.id))) return Response.json({ error: "Supporter access required" }, { status: 403 });

  const cacheDb = getServiceDb();
  const result  = await generate(user.id, supabase, cacheDb);
  if ("error" in result) {
    const status = result.error === "api_unavailable" ? 503 : result.error === "archetypes_required" ? 412 : 500;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ...(result.data as object), cached: false });
}
