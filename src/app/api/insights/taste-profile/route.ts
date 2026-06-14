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
      const { count: recordCount } = await supabase
        .from("user_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      const currentRecords = recordCount ?? 0;
      const storedRecords  = cached.record_count_at_generation ?? 0;
      const recordDriftOk  = storedRecords === 0 ||
        Math.abs(currentRecords - storedRecords) / Math.max(storedRecords, 1) <= DRIFT_PCT;

      type CachedProfile = { metrics?: { m12?: { wantlistCount?: number }; m02?: { noData?: boolean } } };
      const cachedProfile = cached.profile_data as CachedProfile;

      // Invalidate if wantlist was empty at generation but now has items
      const cachedWantlistCount = cachedProfile?.metrics?.m12?.wantlistCount ?? 0;
      let wantlistDriftOk = true;
      if (cachedWantlistCount === 0) {
        const { count: wlCount } = await supabase
          .from("wantlist")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        // Also check in-app wantlist
        const { data: appWL } = await supabase
          .from("lists")
          .select("id")
          .eq("user_id", user.id)
          .eq("slug", "wantlist")
          .maybeSingle();
        const { count: appWLCount } = appWL?.id
          ? await supabase.from("list_items").select("*", { count: "exact", head: true }).eq("list_id", appWL.id)
          : { count: 0 };
        if ((wlCount ?? 0) + (appWLCount ?? 0) > 0) wantlistDriftOk = false;
      }

      // Invalidate if Bandcamp imports were empty at generation but now exist
      const cachedNoDigital = cachedProfile?.metrics?.m02?.noData ?? true;
      let digitalDriftOk = true;
      if (cachedNoDigital) {
        const { count: diCount } = await supabase
          .from("digital_imports")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if ((diCount ?? 0) > 0) digitalDriftOk = false;
      }

      if (recordDriftOk && wantlistDriftOk && digitalDriftOk) {
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
