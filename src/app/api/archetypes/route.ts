import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeArchetypes } from "@/lib/archetypes/computeArchetypes";

export const dynamic = "force-dynamic";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get current record count
  const { count: currentCount } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Check cache
  const { data: cache } = await db
    .from("archetype_cache")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle() as { data: Record<string, unknown> | null };

  if (
    cache &&
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

    await db.from("archetype_cache").upsert({
      user_id: user.id,
      signals: result.signals,
      archetype_scores: result.scores,
      primary_archetype: result.primary,
      secondary_archetype: result.secondary,
      shadow_archetype: result.shadow,
      primary_score: result.primaryScore,
      secondary_score: result.secondaryScore,
      record_count_at_generation: result.recordCount,
      generated_at: result.generatedAt,
    }, { onConflict: "user_id" });

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { count: currentCount } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  try {
    const result = await computeArchetypes(user.id, supabase);

    await db.from("archetype_cache").upsert({
      user_id: user.id,
      signals: result.signals,
      archetype_scores: result.scores,
      primary_archetype: result.primary,
      secondary_archetype: result.secondary,
      shadow_archetype: result.shadow,
      primary_score: result.primaryScore,
      secondary_score: result.secondaryScore,
      record_count_at_generation: result.recordCount,
      generated_at: result.generatedAt,
      // Clear essay cache on regeneration
      essay_text: null,
      essay_generated_at: null,
    }, { onConflict: "user_id" });

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
