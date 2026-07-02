import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";
import { computeArchetypes } from "@/lib/archetypes/computeArchetypes";

const BATCH = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminDb = getAdminDb();

  // All user_ids with at least one record
  const { data: recordRows, error: recordErr } = await adminDb
    .from("user_records")
    .select("user_id")
    .limit(10000);
  if (recordErr) return NextResponse.json({ error: recordErr.message }, { status: 500 });

  const allUserIds = [...new Set((recordRows ?? []).map(r => r.user_id as string))];

  // Already cached
  const { data: cachedRows } = await adminDb
    .from("archetype_cache")
    .select("user_id")
    .limit(10000);
  const cached = new Set((cachedRows ?? []).map(r => r.user_id as string));

  const todo = allUserIds.filter(id => !cached.has(id));
  const batch = todo.slice(0, BATCH);

  let processed = 0;
  const errors: string[] = [];

  await Promise.all(batch.map(async (userId) => {
    try {
      const result = await computeArchetypes(userId, adminDb as any);
      if (!result) return;
      await adminDb.from("archetype_cache").upsert({
        user_id: userId,
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
      processed++;
    } catch (e) {
      errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }));

  return NextResponse.json({
    processed,
    remaining: todo.length - batch.length,
    total: allUserIds.length,
    cached: cached.size + processed,
    errors: errors.slice(0, 5),
  });
}
