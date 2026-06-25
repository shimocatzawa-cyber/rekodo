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
    console.error('Could not load .env.local — run this from the project root.');
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

// ─── Extraction helpers (mirrors discogs-sync-processor/index.ts) ─────────────

type Identifier = { type?: string; value?: string };
type Format     = { name?: string; descriptions?: string[]; text?: string };

function extractBarcode(identifiers?: Identifier[]): string {
  if (!identifiers?.length) return '';
  const bc = identifiers.find(i => i.type?.toLowerCase() === 'barcode');
  return bc?.value?.trim() || '';
}

function extractMatrix(identifiers?: Identifier[]): string[] {
  if (!identifiers?.length) return [];
  return identifiers
    .filter(i => i.type?.toLowerCase().includes('matrix'))
    .map(i => i.value?.trim())
    .filter((v): v is string => !!v);
}

const EDITION_RE = [
  /\/\s*(\d{2,5})\b/,
  /\blimited\s+(?:edition\s+)?(?:of\s+)?(\d{2,5})\b/i,
  /\bnumbered\s+(?:\/\s*)?(\d{2,5})\b/i,
  /\b(\d{2,5})\s+cop(?:y|ies)\b/i,
  /\b(\d{2,5})\s+pressed\b/i,
];

function extractEditionSize(formats?: Format[], notes?: string): number | null {
  const candidates = [
    ...(formats ?? []).map(f => f.text ?? ''),
    ...(formats ?? []).flatMap(f => f.descriptions ?? []),
    notes ?? '',
  ];
  for (const text of candidates) {
    if (!text) continue;
    for (const re of EDITION_RE) {
      const m = text.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 10 && n <= 25_000) return n;
      }
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const discogsKey    = process.env.DISCOGS_CONSUMER_KEY;
  const discogsSecret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!supabaseUrl || !serviceKey || !discogsKey || !discogsSecret) {
    console.error('Missing required env vars.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all records still needing identifiers (barcode IS NULL)
  const allRecords: { id: string; discogs_id: string; artist: string; album: string }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('records')
      .select('id, discogs_id, artist, album')
      .is('barcode', null)
      .not('discogs_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;
    allRecords.push(...data as typeof allRecords);
    if (data.length < PAGE) break;
  }

  if (allRecords.length === 0) {
    console.log('All records already have pressing identifiers — nothing to do.');
    return;
  }

  const total = allRecords.length;
  const estHours = ((total * 1.1) / 3600).toFixed(1);
  console.log(`\n${total} records to process (~${estHours}h at Discogs rate limit)\n`);

  let updated = 0, skipped = 0;
  const RATE_MS  = 1100; // just under 60 req/min
  const LOG_EVERY = 50;

  for (let i = 0; i < total; i++) {
    const record = allRecords[i];
    const num    = i + 1;

    try {
      const url = `https://api.discogs.com/releases/${encodeURIComponent(record.discogs_id)}?key=${discogsKey}&secret=${discogsSecret}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'rekodo/1.0' } });

      if (res.status === 429) {
        console.log(`  Rate limited at record ${num} — waiting 60s...`);
        await sleep(60_000);
        i--; // retry same record
        continue;
      }

      const patch: Record<string, unknown> = { barcode: '', matrix: [] };

      if (res.ok) {
        const rd = await res.json() as {
          formats?:     Format[];
          identifiers?: Identifier[];
          notes?:       string;
        };
        patch.barcode = extractBarcode(rd.identifiers);
        patch.matrix  = extractMatrix(rd.identifiers);
        const editionSize = extractEditionSize(rd.formats, rd.notes);
        if (editionSize !== null) patch.edition_size = editionSize;
      }

      const { error: updateErr } = await supabase
        .from('records')
        .update(patch)
        .eq('id', record.id);

      if (updateErr) throw new Error(updateErr.message);

      updated++;
      if (num % LOG_EVERY === 0 || num === total) {
        const pct  = Math.round((num / total) * 100);
        const minsLeft = Math.ceil(((total - num) * RATE_MS) / 60_000);
        console.log(`  [${pct}%] ${num}/${total} — ${updated} updated, ${skipped} skipped. ~${minsLeft}min remaining.`);
      }
    } catch (e) {
      skipped++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  Skipped ${record.artist} — ${record.album}: ${msg}`);
    }

    if (i < total - 1) await sleep(RATE_MS);
  }

  console.log(`\nDone.`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Total   : ${total}`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
