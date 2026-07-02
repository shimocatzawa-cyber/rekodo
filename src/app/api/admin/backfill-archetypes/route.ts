import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";
import { computeArchetypes } from "@/lib/archetypes/computeArchetypes";

// Process this many profiles per call. Each computeArchetypes does several
// DB queries but no external API calls, so 30 fits well inside Vercel's limit.
const BATCH = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { offset?: number };
  const offset = typeof body.offset === "number" ? body.offset : 0;

  const adminDb = getAdminDb();

  // Profiles is one row per user — safe to paginate without the fan-out
  // problem that user_records has (many rows per user inflating the row count).
  const [{ count: totalProfiles }, profilesResult, cachedResult] = await Promise.all([
    adminDb.from("profiles").select("*", { count: "exact", head: true }),
    adminDb.from("profiles").select("id").range(offset, offset + BATCH - 1),
    adminDb.from("archetype_cache").select("user_id").limit(10000),
  ]);

  const total   = totalProfiles ?? 0;
  const profiles = profilesResult.data ?? [];
  const cached  = new Set((cachedResult.data ?? []).map(r => r.user_id as string));

  const todo = profiles.filter(p => !cached.has(p.id as string));

  let processed = 0;
  let skipped   = 0;
  const errors: string[] = [];

  await Promise.all(todo.map(async (p) => {
    try {
      const result = await computeArchetypes(p.id as string, adminDb as any);
      if (!result || result.recordCount === 0) { skipped++; return; }
      await adminDb.from("archetype_cache").upsert({
        user_id:                    p.id,
        signals:                    result.signals,
        archetype_scores:           result.scores,
        primary_archetype:          result.primary,
        secondary_archetype:        result.secondary,
        shadow_archetype:           result.shadow,
        primary_score:              result.primaryScore,
        secondary_score:            result.secondaryScore,
        named_pairing:              result.namedPairing ?? null,
        record_count_at_generation: result.recordCount,
        generated_at:               result.generatedAt,
      }, { onConflict: "user_id" });
      processed++;
    } catch (e) {
      errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }));

  const nextOffset = offset + BATCH;
  const done = nextOffset >= total;

  return NextResponse.json({
    processed,
    skipped,
    nextOffset,
    done,
    total,
    cachedTotal: cached.size + processed,
    errors: errors.slice(0, 5),
  });
}
