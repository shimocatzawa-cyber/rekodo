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

// ─── Types ────────────────────────────────────────────────────────────────────

type Identifier = { type?: string; value?: string };
type Format     = { name?: string; descriptions?: string[]; text?: string };
type ExtraArtist = { name: string; role: string };

// ─── Extractors (mirrors discogs-sync-processor/index.ts) ─────────────────────

const VINYL_SIZES = ['7"', '10"', '12"'];

const COLOUR_KW = [
  'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple',
  'Pink', 'Silver', 'Gold', 'Grey', 'Gray', 'Brown', 'Teal',
  'Clear', 'Colored', 'Coloured', 'Marbled', 'Splatter', 'Opaque',
  'Translucent', 'Transparent', 'Picture Disc', 'Etched',
  'Swirl', 'Galaxy', 'Smoke', 'Haze', 'Glow',
];

function hasColourKw(s: string): boolean {
  return COLOUR_KW.some((kw) => s.toLowerCase().includes(kw.toLowerCase()));
}

function extractFormat(formats?: Format[]): string | null {
  const fmt = formats?.[0];
  if (!fmt) return null;
  const name  = fmt.name ?? '';
  const descs = fmt.descriptions ?? [];
  if (name === 'Vinyl') return descs.find((d) => VINYL_SIZES.includes(d)) ?? 'Vinyl';
  return name || null;
}

function extractVinylColour(formats?: Format[]): string | null {
  const vinyl = formats?.find((f) => f.name === 'Vinyl');
  if (!vinyl) return null;
  // Only use text if it actually contains colour info — Discogs also puts
  // pressing notes like "Gatefold", "180g", "Remastered" in this field.
  if (vinyl.text?.trim() && hasColourKw(vinyl.text)) return vinyl.text.trim();
  const match = (vinyl.descriptions ?? []).find((d) => hasColourKw(d));
  return match ?? null;
}

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

function extractProducers(extraartists?: ExtraArtist[]): string[] {
  if (!extraartists?.length) return [];
  return extraartists
    .filter((e) => /producer/i.test(e.role))
    .map((e) => e.name);
}

const EDITION_RE = [
  // /500 or #47/500 — exclude when preceded by a sample rate (e.g. "44/16", "96/24") or
  // followed by descriptive words like "page", "track", "section", or audio terms like "bit", "khz", "digital"
  /(?<!\d)\/\s*(\d{2,5})\b(?!\s*-?\s*(?:page|pages|track|tracks|section|sections|sided|panel|panels|fold|disc|discs|sheet|sheets|bit|khz|hz|digital|kbps))/i,
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

  // Fetch records that still have any gap:
  //   - barcode IS NULL  → not processed at all yet
  //   - country IS NULL  → processed by old script (barcode set) but missed new fields
  const allRecords: {
    id: string;
    discogs_id: string;
    artist: string;
    album: string;
    format: string | null;
    country: string | null;
    vinyl_colour: string | null;
    producers: string[] | null;
    genre: string | null;
    styles: string[] | null;
    year: number | null;
  }[] = [];

  // Paginate by primary key (always fast) and filter in-memory.
  // Filtering barcode IS NULL at the DB level hits a full table scan on an
  // unindexed column across 200k+ rows and triggers a statement timeout.
  const PAGE = 1000;
  let lastId = '';
  let totalScanned = 0;
  while (true) {
    let qb = supabase
      .from('records')
      .select('id, discogs_id, artist, album, format, country, vinyl_colour, producers, genre, styles, year, barcode')
      .order('id', { ascending: true })
      .limit(PAGE);

    if (lastId) qb = qb.gt('id', lastId);

    const { data, error } = await qb;

    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;

    totalScanned += data.length;
    for (const row of data as (typeof allRecords[0] & { barcode: string | null })[]) {
      // Skip records with no discogs_id (can't enrich) or already have a barcode (already done)
      if (!row.discogs_id || row.barcode !== null) continue;
      allRecords.push(row);
    }
    lastId = data[data.length - 1].id;
    if (data.length < PAGE) break;

    process.stdout.write(`\rScanning… ${totalScanned.toLocaleString()} records checked, ${allRecords.length} need backfill`);
  }
  process.stdout.write('\n');

  if (allRecords.length === 0) {
    console.log('All records are fully backfilled — nothing to do.');
    return;
  }

  const total    = allRecords.length;
  const estHours = ((total * 1.1) / 3600).toFixed(1);
  console.log(`\n${total} records to backfill (~${estHours}h at Discogs rate limit)\n`);
  console.log('Fields being captured: barcode · matrix · edition_size · country · format · vinyl_colour · producers · genre · styles · year · discogs_artist_id · community stats\n');

  let updated = 0, skipped = 0;
  const RATE_MS  = 1100;
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
        i--;
        continue;
      }

      // barcode/matrix are safe sentinels — they are new fields that didn't
      // exist before this script ran, so writing '' / [] can never wipe real data.
      // country, vinyl_colour, producers are NOT included here — they may already
      // have real values and must only be written from the API response.
      const patch: Record<string, unknown> = {
        barcode: '',
        matrix:  [],
      };

      if (res.ok) {
        const rd = await res.json() as {
          country?:      string;
          year?:         number;
          notes?:        string;
          formats?:      Format[];
          identifiers?:  Identifier[];
          extraartists?: ExtraArtist[];
          genres?:       string[];
          styles?:       string[];
          artists?:      Array<{ id: number; name: string }>;
          community?: {
            have?: number;
            want?: number;
            num_for_sale?: number;
          };
        };

        // Pressing identifiers
        patch.barcode      = extractBarcode(rd.identifiers);
        patch.matrix       = extractMatrix(rd.identifiers);
        const editionSize  = extractEditionSize(rd.formats, rd.notes);
        if (editionSize !== null) patch.edition_size = editionSize;

        // Core release fields — only overwrite if currently null
        if (!record.format)       { const f = extractFormat(rd.formats);       if (f)  patch.format = f; }
        if (!record.vinyl_colour) patch.vinyl_colour = extractVinylColour(rd.formats) ?? '';
        if (!record.country)      { patch.country      = rd.country ?? ''; }
        if (!record.genre && rd.genres?.length)  patch.genre  = rd.genres[0];
        if (!record.styles && rd.styles?.length) patch.styles = rd.styles;
        if (!record.year && rd.year)             patch.year   = rd.year;

        // Producers — only write from API result, never default-wipe existing data
        if (!record.producers?.length) patch.producers = extractProducers(rd.extraartists) ?? [];

        // Discogs artist ID
        const artistId = rd.artists?.[0]?.id;
        if (artistId) patch.discogs_artist_id = artistId;

        // Community stats
        if (rd.community) {
          patch.community_have         = rd.community.have         ?? null;
          patch.community_want         = rd.community.want         ?? null;
          patch.community_num_for_sale = rd.community.num_for_sale ?? null;
          patch.community_fetched_at   = new Date().toISOString();
        }
      }

      const { error: updateErr } = await supabase
        .from('records')
        .update(patch)
        .eq('id', record.id);

      if (updateErr) throw new Error(updateErr.message);

      updated++;
      if (num % LOG_EVERY === 0 || num === total) {
        const pct      = Math.round((num / total) * 100);
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
