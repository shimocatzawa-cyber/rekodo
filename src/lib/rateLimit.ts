// Generic per-user daily usage cap for Anthropic-calling routes — same idea
// as the dig_daily_count mechanism in api/dig/route.ts, generalized so any
// route can opt in without its own table. Without a cap, a single scripted
// account can call an LLM-backed route in a tight loop with no ceiling on
// API spend.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type DailyLimitResult = { allowed: boolean; used: number; limit: number };

// Increments first, then checks — atomic via the increment_api_usage RPC, so
// two concurrent requests can't both slip through the same race the way a
// separate select-then-increment would.
export async function checkDailyLimit(
  supabase: AnySupabase, userId: string, route: string, limit: number,
): Promise<DailyLimitResult> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: used } = await supabase.rpc("increment_api_usage", {
    p_user_id: userId, p_date: today, p_route: route,
  }) as { data: number | null };
  const count = used ?? 1;
  return { allowed: count <= limit, used: count, limit };
}

export async function isSupporter(supabase: AnySupabase, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles").select("is_supporter, role").eq("id", userId).maybeSingle();
  return !!data?.is_supporter || data?.role === "admin";
}
