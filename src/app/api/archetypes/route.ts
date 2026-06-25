import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { computeArchetypes } from "@/lib/archetypes/computeArchetypes";
import { isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// archetype_cache is a purely server-computed cache (never user-edited), and —
// like profiles and list_items before it — was created directly against the
// database outside any tracked migration, so its grants for the authenticated
// role were never verifiable from the repo. Read/write it via the service role
// (same pattern lib/spotify.ts already uses for token columns) so this cache
// doesn't depend on that uncertainty at all; userId always comes from the
// caller's own verified session below, never a client-supplied value.
function getCacheDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function isCacheValid(
  generatedAt: string | null,
  recordCountAtGeneration: number | null,
  currentCount: number
): boolean {
  if (!generatedAt) return false;
  const age = Date.now() - new Date(generatedAt).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (age > thirtyDays) return false;
  if (recordCountAtGeneration == null) return false;
  const pct = Math.abs(currentCount - recordCountAtGeneration) / Math.max(recordCountAtGeneration, 1);
  return pct <= 0.1;
}

export async function GET() {
  const { supabase, user } = await getAuthUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Archetypes is a supporter-only feature (see src/app/archetypes/page.tsx) —
  // the page gates access, but this route didn't, so it was callable directly
  // by anyone with an account, bypassing the paywall (same bug already fixed
  // on the essay sub-route).
  if (!(await isSupporter(supabase, user.id))) {
    return Response.json({ error: "Supporter access required" }, { status: 403 });
  }

  const cacheDb = getCacheDb();

  // Get current record count
  const { count: currentCount } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Check cache
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cache, error: cacheReadError } = await (cacheDb as any)
    .from("archetype_cache")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle() as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (cacheReadError) {
    console.error("[archetypes] cache read failed:", cacheReadError.message);
  }

  // Cached signals predating the emotionalRange signal (added below) lack that key —
  // treat as stale so existing users get it on their next load instead of waiting
  // out the full 30-day cache window.
  const cacheHasCurrentSignals = (cache?.signals as Record<string, unknown> | null)?.listeningIntensity != null;

  if (
    cache &&
    cacheHasCurrentSignals &&
    isCacheValid(
      cache.generated_at as string | null,
      cache.record_count_at_generation as number | null,
      currentCount ?? 0
    )
  ) {
    return Response.json({
      data: cache.signals,
      scores: cache.archetype_scores,
      primary: cache.primary_archetype,
      secondary: cache.secondary_archetype,
      shadow: cache.shadow_archetype,
      primaryScore: cache.primary_score,
      secondaryScore: cache.secondary_score,
      namedPairing: cache.named_pairing ?? null,
      recordCount: cache.record_count_at_generation,
      currentCount: currentCount ?? 0,
      cached: true,
    });
  }

  // Compute fresh
  try {
    const result = await computeArchetypes(user.id, supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (cacheDb as any).from("archetype_cache").upsert({
      user_id: user.id,
      signals: result.signals,
      archetype_scores: result.scores,
      primary_archetype: result.primary,
      secondary_archetype: result.secondary,
      shadow_archetype: result.shadow,
      primary_score: result.primaryScore,
      secondary_score: result.secondaryScore,
      named_pairing: result.namedPairing ?? null,
      record_count_at_generation: result.recordCount,
      generated_at: result.generatedAt,
    }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[archetypes] cache write failed:", upsertError.message);
    }

    return Response.json({
      data: result.signals,
      scores: result.scores,
      primary: result.primary,
      secondary: result.secondary,
      shadow: result.shadow,
      primaryScore: result.primaryScore,
      secondaryScore: result.secondaryScore,
      namedPairing: result.namedPairing,
      recordCount: result.recordCount,
      currentCount: currentCount ?? result.recordCount,
      cached: false,
    });
  } catch (err) {
    console.error("computeArchetypes error:", err);
    return Response.json({ error: "Failed to compute archetypes" }, { status: 500 });
  }
}

export async function POST() {
  const { supabase, user } = await getAuthUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await isSupporter(supabase, user.id))) {
    return Response.json({ error: "Supporter access required" }, { status: 403 });
  }

  const cacheDb = getCacheDb();

  const { count: currentCount } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  try {
    const result = await computeArchetypes(user.id, supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (cacheDb as any).from("archetype_cache").upsert({
      user_id: user.id,
      signals: result.signals,
      archetype_scores: result.scores,
      primary_archetype: result.primary,
      secondary_archetype: result.secondary,
      shadow_archetype: result.shadow,
      primary_score: result.primaryScore,
      secondary_score: result.secondaryScore,
      named_pairing: result.namedPairing ?? null,
      record_count_at_generation: result.recordCount,
      generated_at: result.generatedAt,
      // Clear essay cache on regeneration
      essay_text: null,
      essay_generated_at: null,
    }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[archetypes] cache write failed:", upsertError.message);
    }

    return Response.json({
      data: result.signals,
      scores: result.scores,
      primary: result.primary,
      secondary: result.secondary,
      shadow: result.shadow,
      primaryScore: result.primaryScore,
      secondaryScore: result.secondaryScore,
      namedPairing: result.namedPairing,
      recordCount: result.recordCount,
      currentCount: currentCount ?? result.recordCount,
      cached: false,
    });
  } catch (err) {
    console.error("computeArchetypes error:", err);
    return Response.json({ error: "Failed to compute archetypes" }, { status: 500 });
  }
}
