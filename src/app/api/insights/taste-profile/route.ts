import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeTasteProfile } from "@/lib/tasteProfile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_DAYS = 30;
const DRIFT_PCT  = 0.10; // invalidate if record count changed > 10%

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check cache
  const { data: cached } = await (supabase as any)
    .from("taste_profile_cache")
    .select("profile_data, generated_at, record_count_at_generation")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cached?.profile_data) {
    const age = Date.now() - new Date(cached.generated_at).getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);
    if (ageDays < CACHE_DAYS) {
      // Check record count drift
      const { count } = await supabase
        .from("user_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      const current = count ?? 0;
      const stored  = cached.record_count_at_generation ?? 0;
      if (stored === 0 || Math.abs(current - stored) / Math.max(stored, 1) <= DRIFT_PCT) {
        return NextResponse.json(cached.profile_data);
      }
    }
  }

  return _generate(user.id, supabase);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return _generate(user.id, supabase);
}

async function _generate(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const profile = await computeTasteProfile(userId, supabase as any);

    await (supabase as any)
      .from("taste_profile_cache")
      .upsert({
        user_id:                    userId,
        profile_data:               profile,
        archetype_primary:          profile.archetypes.primary,
        archetype_secondary:        profile.archetypes.secondary,
        generated_at:               new Date().toISOString(),
        record_count_at_generation: profile.recordCount,
      }, { onConflict: "user_id" });

    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      { error: "computation_failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
