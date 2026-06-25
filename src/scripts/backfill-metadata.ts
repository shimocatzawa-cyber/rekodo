import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function fetchReleaseMetadata(
  discogsId: string,
  key: string,
  secret: string
): Promise<{ format: string | null; country: string | null }> {
  const url = `https://api.discogs.com/releases/${encodeURIComponent(discogsId)}?key=${key}&secret=${secret}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'rekodo/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Discogs returned HTTP ${res.status}`);
  }

  const data = await res.json() as {
    formats?: Array<{ name: string }>;
    country?: string;
  };

  const format = data.formats?.[0]?.name ?? null;
  const country = data.country ?? null;

  return { format, country };
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const discogsKey = process.env.DISCOGS_CONSUMER_KEY;
  const discogsSecret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('\nMissing required env vars. Add to .env.local:');
    if (!supabaseUrl) console.error('  NEXT_PUBLIC_SUPABASE_URL — already should be there');
    if (!serviceRoleKey) console.error('  SUPABASE_SERVICE_ROLE_KEY — get from Supabase Dashboard → Project Settings → API → service_role secret');
    process.exit(1);
  }

  if (!discogsKey || !discogsSecret) {
    console.error('\nMissing DISCOGS_CONSUMER_KEY or DISCOGS_CONSUMER_SECRET in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: records, error } = await supabase
    .from('records')
    .select('id, discogs_id, artist, album')
    .not('discogs_id', 'is', null)
    .or('format.is.null,country.is.null')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch records:', error.message);
    process.exit(1);
  }

  if (!records || records.length === 0) {
    console.log('No records need backfilling — all format/country values are already set.');
    return;
  }

  const total = records.length;
  console.log(`\nStarting backfill for ${total} records...\n`);

  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 10_000;

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const record = records[i];
    const num = i + 1;

    try {
      const { format, country } = await fetchReleaseMetadata(
        record.discogs_id!,
        discogsKey,
        discogsSecret
      );

      const { error: updateError } = await supabase
        .from('records')
        .update({ format, country })
        .eq('id', record.id);

      if (updateError) throw new Error(updateError.message);

      updated++;
      console.log(`Updated record ${num} of ${total}: ${record.artist} - ${record.album} [${format ?? '—'}, ${country ?? '—'}]`);
    } catch (e: unknown) {
      skipped++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`Skipped record ${num} of ${total}: ${record.artist} - ${record.album} (${msg})`);
    }

    // After every batch of 10 (but not after the very last record), wait 10s
    if (num % BATCH_SIZE === 0 && num < total) {
      const remaining = total - num;
      const batchesDone = Math.floor(num / BATCH_SIZE);
      const estimatedMinutes = Math.ceil((remaining / BATCH_SIZE) * ((BATCH_DELAY_MS / 1000) / 60 * 60 + 5) / 60);
      console.log(`\n  — Batch ${batchesDone} complete (${updated} updated, ${skipped} skipped so far). ${remaining} records remaining (~${estimatedMinutes}min). Waiting 10s...\n`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nBackfill complete.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${total}`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
