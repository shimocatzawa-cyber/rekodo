#!/usr/bin/env npx tsx
/**
 * Populates the artist_influences table by running Claude over every distinct
 * artist in the records table. Run repeatedly until "All done!" appears.
 *
 * Usage:
 *   npx tsx scripts/build-influences.ts
 *   npx tsx scripts/build-influences.ts --force   (re-process already done artists)
 *   npx tsx scripts/build-influences.ts --batch 15
 */

import * as fs from "fs";
import * as path from "path";

// Parse .env.local manually (no dotenv dep needed)
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Inline minimal Supabase + Anthropic clients to avoid import issues
const SUPABASE_URL            = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY           = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !ANTHROPIC_KEY) {
  console.error("Missing env vars. Check .env.local for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY");
  process.exit(1);
}

const args        = process.argv.slice(2);
const FORCE       = args.includes("--force");
const BATCH_IDX   = args.indexOf("--batch");
const BATCH_SIZE  = BATCH_IDX !== -1 ? parseInt(args[BATCH_IDX + 1], 10) : 10;
const DELAY_MS    = 1000; // ms between Claude calls to avoid rate limits

// ── Supabase helpers (raw fetch) ──────────────────────────────────────────────

async function sbGet<T>(path: string, params?: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      apikey:        SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`sbGet ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbUpsert(table: string, rows: object[]) {
  if (rows.length === 0) return;
  // Insert one row at a time to avoid PGRST102 "All object keys must match" and
  // to silently skip 409 duplicate conflicts rather than losing the whole batch.
  for (const row of rows) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?on_conflict=source_artist,target_artist,type`,
      {
        method: "POST",
        headers: {
          apikey:         SUPABASE_SERVICE_ROLE,
          Authorization:  `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer:         "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      if (text.includes("42P01")) throw new Error("artist_influences table not found — run migrations first");
      // 409 duplicate — already have this pair, skip silently
      if (res.status === 409) continue;
      throw new Error(`sbUpsert ${table}: ${res.status} ${text}`);
    }
  }
}

// ── Anthropic helper (raw fetch) ──────────────────────────────────────────────

interface InfluenceEntry { name: string; note: string }
interface ArtistResult   { artist: string; influenced_by: InfluenceEntry[]; influenced: InfluenceEntry[] }

async function claudeInfluences(artists: string[]): Promise<ArtistResult[]> {
  const body = {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools: [{
      name: "record_influences",
      description: "Record well-documented musical influence relationships for a batch of artists",
      input_schema: {
        type: "object",
        properties: {
          artists: {
            type: "array",
            items: {
              type: "object",
              properties: {
                artist:        { type: "string" },
                influenced_by: { type: "array", items: { type: "object", properties: { name: { type: "string" }, note: { type: "string" } }, required: ["name","note"] } },
                influenced:    { type: "array", items: { type: "object", properties: { name: { type: "string" }, note: { type: "string" } }, required: ["name","note"] } },
              },
              required: ["artist","influenced_by","influenced"],
            },
          },
        },
        required: ["artists"],
      },
    }],
    tool_choice: { type: "any" },
    messages: [{
      role: "user",
      content: `For each artist below, list up to 5 artists who directly influenced them (influenced_by) and up to 5 artists they are documented to have directly influenced (influenced). Only well-documented, verifiable relationships. If uncertain, omit rather than guess.\n\nArtists: ${artists.join(", ")}`,
    }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Claude API: ${res.status} ${await res.text()}`);
  const data = await res.json() as { content: { type: string; input?: { artists: ArtistResult[] } }[] };
  const tool  = data.content.find(b => b.type === "tool_use");
  return tool?.input?.artists ?? [];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching distinct artists from records table…");

  // Get all distinct artists (Supabase REST doesn't support DISTINCT natively,
  // so we fetch in pages and deduplicate in memory — records table is ~467k rows)
  const seen  = new Set<string>();
  const all: string[] = [];
  const PAGE  = 1000;

  for (let from = 0; ; from += PAGE) {
    const rows = await sbGet<{ artist: string }>("/records", {
      select: "artist",
      limit:  String(PAGE),
      offset: String(from),
    });
    for (const r of rows) {
      if (r.artist && !seen.has(r.artist)) { seen.add(r.artist); all.push(r.artist); }
    }
    process.stdout.write(`\r  Scanned ${from + rows.length} rows, ${all.length} unique artists…`);
    if (rows.length < PAGE) break;
  }
  console.log(`\nTotal unique artists: ${all.length}`);

  // Which ones already have influence data?
  let toProcess = all;
  if (!FORCE) {
    console.log("Checking existing artist_influences rows…");
    const existing = await sbGet<{ source_artist: string }>("/artist_influences", {
      select: "source_artist",
      limit:  "10000",
    });
    const done = new Set(existing.map(r => r.source_artist.toLowerCase()));
    toProcess   = all.filter(a => !done.has(a.toLowerCase()));
    console.log(`Already processed: ${all.length - toProcess.length}  Remaining: ${toProcess.length}`);
  }

  if (toProcess.length === 0) {
    console.log("All done! No artists remaining.");
    return;
  }

  // Log file for resumability
  const logPath = path.resolve(__dirname, "build-influences.log");
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(msg);
    fs.appendFileSync(logPath, line + "\n");
  };

  let inserted = 0;
  let errors   = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\rBatch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(toProcess.length / BATCH_SIZE)}  (${i}/${toProcess.length})  inserted=${inserted}  errors=${errors}   `);

    try {
      const results = await claudeInfluences(batch);
      const rows: object[] = [];
      for (const r of results) {
        for (const inf of r.influenced_by ?? []) {
          rows.push({ source_artist: r.artist, target_artist: inf.name, type: "influenced_by", note: inf.note, via: "claude", confidence: 75 });
        }
        for (const inf of r.influenced ?? []) {
          rows.push({ source_artist: r.artist, target_artist: inf.name, type: "influenced", note: inf.note, via: "claude", confidence: 75 });
        }
      }
      await sbUpsert("artist_influences", rows);
      inserted += rows.length;
    } catch (err) {
      errors++;
      log(`ERROR batch starting at ${batch[0]}: ${err}`);
    }

    if (i + BATCH_SIZE < toProcess.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n\nDone. Inserted ${inserted} rows, ${errors} errors.`);
  if (errors > 0) console.log(`See ${logPath} for error details.`);
}

main().catch(err => { console.error(err); process.exit(1); });
