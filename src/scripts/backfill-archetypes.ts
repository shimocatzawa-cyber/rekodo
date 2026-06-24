import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { computeArchetypes } from '../lib/archetypes/computeArchetypes';

// Archetypes are normally computed lazily, the first time a user opens the
// (Supporter-gated) /archetypes page. That leaves the admin "Archetype"
// column blank for everyone who hasn't visited it yet — including Supporters
// who simply haven't tried the feature. This computes and caches an
// archetype for every user with a collection, regardless of tier, purely so
// admin has visibility. It does not unlock the gated feature for free users.

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.error('Could not load .env.local — make sure you run this from the project root.');
    process.exit(1);
  }
}

// Paginates past PostgREST's 1000-row hard cap.
async function fetchPagedColumn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  column: string
): Promise<string[]> {
  const values: string[] = [];
  const BATCH = 1000;
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase.from(table).select(column).range(from, from + BATCH - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values.push(...data.map((r: any) => r[column]));
    if (data.length < BATCH) break;
  }
  return values;
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('\nMissing required env vars. Add to .env.local:');
    if (!supabaseUrl) console.error('  NEXT_PUBLIC_SUPABASE_URL — already should be there');
    if (!serviceRoleKey) console.error('  SUPABASE_SERVICE_ROLE_KEY — get from Supabase Dashboard → Project Settings → API → service_role secret');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const [recordUserIds, cachedUserIds] = await Promise.all([
    fetchPagedColumn(supabase, 'user_records', 'user_id'),
    fetchPagedColumn(supabase, 'archetype_cache', 'user_id'),
  ]);

  const cached = new Set(cachedUserIds);
  const targetIds = [...new Set(recordUserIds)].filter((id) => !cached.has(id));

  if (targetIds.length === 0) {
    console.log('Nothing to backfill — every user with a collection already has a cached archetype.');
    return;
  }

  console.log(`\nBackfilling archetypes for ${targetIds.length} user(s)...\n`);

  const CONCURRENCY = 5;
  let done = 0;
  let failed = 0;

  async function worker(queue: string[]) {
    while (queue.length > 0) {
      const userId = queue.shift();
      if (!userId) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await computeArchetypes(userId, supabase as any);
        const { error } = await supabase.from('archetype_cache').upsert({
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
        }, { onConflict: 'user_id' });
        if (error) throw new Error(error.message);
        done++;
        console.log(`[${done + failed}/${targetIds.length}] ${userId} → ${result.primary}`);
      } catch (e: unknown) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`[${done + failed}/${targetIds.length}] ${userId} → skipped (${msg})`);
      }
    }
  }

  const queue = [...targetIds];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\nBackfill complete.`);
  console.log(`  Cached:  ${done}`);
  console.log(`  Skipped: ${failed}`);
  console.log(`  Total:   ${targetIds.length}`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
