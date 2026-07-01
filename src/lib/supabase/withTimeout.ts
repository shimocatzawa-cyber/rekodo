import type { SupabaseClient } from "@supabase/supabase-js";

const deadline = (ms: number) =>
  new Promise<null>(resolve => setTimeout(() => resolve(null), ms));

/** getUser() with a hard timeout — returns null if Supabase auth is slow/down */
export async function getUserWithTimeout(
  supabase: SupabaseClient,
  ms = 3000
) {
  const result = await Promise.race([
    supabase.auth.getUser().then(r => r.data.user),
    deadline(ms),
  ]);
  return result ?? null;
}

/** Generic single Supabase query with a hard timeout — returns null on timeout */
export async function queryWithTimeout<T>(
  query: PromiseLike<{ data: T | null }>,
  ms = 3000
): Promise<T | null> {
  const result = await Promise.race([
    query.then(r => r.data),
    deadline(ms),
  ]);
  return result ?? null;
}
