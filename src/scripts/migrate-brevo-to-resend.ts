/**
 * Migrate Brevo contacts → Resend (global Contacts model).
 *
 * Usage:
 *   # Dry run (no Resend writes — shows counts per segment/status):
 *   BREVO_API_KEY=xxx RESEND_API_KEY=xxx \
 *     npx ts-node -P tsconfig.scripts.json src/scripts/migrate-brevo-to-resend.ts --dry-run
 *
 *   # With a Brevo CSV export instead:
 *   RESEND_API_KEY=xxx \
 *     npx ts-node -P tsconfig.scripts.json src/scripts/migrate-brevo-to-resend.ts contacts.csv --dry-run
 *
 *   # Live import (creates segments if not present, imports all contacts):
 *   BREVO_API_KEY=xxx RESEND_API_KEY=xxx \
 *     npx ts-node -P tsconfig.scripts.json src/scripts/migrate-brevo-to-resend.ts
 *
 * Required env:  RESEND_API_KEY
 * Optional env:  BREVO_API_KEY (required when not using CSV)
 *                RESEND_SEGMENT_USERS_ID      — skip creation if already exists
 *                RESEND_SEGMENT_WAITLIST_ID
 *                RESEND_SEGMENT_SUPPORTERS_ID
 *
 * Segment / property mapping:
 *   Brevo list 5 (signups)  → "users" segment
 *   Brevo list 8 (waitlist) → "waitlist" segment
 *   IS_SUPPORTER = true     → "supporters" segment + property supporter=1
 *   WAITLIST_DATE attribute → property waitlist_date="YYYY-MM-DD"
 *   emailBlacklisted / per-list unsubscribed / hard-bounced → unsubscribed: true
 *
 * Rate limit: 4 contacts/sec (250ms between calls), well under Resend's limit.
 * Contacts.create upserts by email — safe to re-run.
 */

import * as fs   from "fs";
import * as path from "path";
import * as rl   from "readline";
import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN    = process.argv.includes("--dry-run");
const CSV_PATH   = process.argv.find(a => !a.startsWith("-") && a.endsWith(".csv"));
const RATE_MS    = 250; // 4 req/sec

const RESEND_KEY = process.env.RESEND_API_KEY;
const BREVO_KEY  = process.env.BREVO_API_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceContact {
  email:        string;
  firstName?:   string;
  unsubscribed: boolean;
  supporter:    boolean;
  waitlistDate: string | null; // "YYYY-MM-DD" or null
  inList5:      boolean; // Brevo list 5 = signups
  inList8:      boolean; // Brevo list 8 = waitlist
}

interface SegmentIds {
  users:      string;
  waitlist:   string;
  supporters: string;
}

// ---------------------------------------------------------------------------
// Brevo API source
// ---------------------------------------------------------------------------

interface BrevoRawContact {
  email:            string;
  emailBlacklisted: boolean;
  listIds?:         number[];
  attributes?: {
    FIRSTNAME?:    string;
    IS_SUPPORTER?: boolean | number;
    WAITLIST_DATE?: string;
    [k: string]:   unknown;
  };
}

async function fetchBrevoContacts(): Promise<SourceContact[]> {
  if (!BREVO_KEY) throw new Error("BREVO_API_KEY not set (and no CSV file provided)");

  const all: BrevoRawContact[] = [];
  const limit = 50;
  let offset  = 0;
  let total   = Infinity;

  console.log("Fetching contacts from Brevo API…");

  while (offset < total) {
    const res = await fetch(
      `https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}&sort=asc`,
      { headers: { "api-key": BREVO_KEY } },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Brevo API ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json() as { contacts: BrevoRawContact[]; count: number };
    total = data.count;
    all.push(...data.contacts);
    process.stdout.write(`\r  ${Math.min(offset + limit, total)} / ${total}`);
    offset += limit;
    await sleep(300); // Brevo rate limit
  }
  console.log();

  // Also collect per-list unsubscribes (global emailBlacklisted misses list-level unsubs)
  const unsubEmails = new Set<string>();
  for (const listId of [5, 8]) {
    let off2 = 0, tot2 = Infinity;
    while (off2 < tot2) {
      const r = await fetch(
        `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/unsubscribed?limit=50&offset=${off2}`,
        { headers: { "api-key": BREVO_KEY } },
      );
      if (!r.ok) break;
      const d = await r.json() as { contacts?: { email?: string }[]; count: number };
      tot2 = d.count ?? 0;
      for (const c of d.contacts ?? []) {
        if (c.email) unsubEmails.add(c.email.toLowerCase().trim());
      }
      off2 += 50;
      await sleep(300);
    }
  }

  return all
    .filter(c => !!c.email)
    .map(c => ({
      email:        c.email.toLowerCase().trim(),
      firstName:    (c.attributes?.FIRSTNAME as string | undefined)?.trim() || undefined,
      unsubscribed: c.emailBlacklisted || unsubEmails.has(c.email.toLowerCase().trim()),
      supporter:    !!(c.attributes?.IS_SUPPORTER),
      waitlistDate: (c.attributes?.WAITLIST_DATE as string | null) ?? null,
      inList5:      (c.listIds ?? []).includes(5),
      inList8:      (c.listIds ?? []).includes(8),
    }));
}

// ---------------------------------------------------------------------------
// CSV source
// ---------------------------------------------------------------------------

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(f => f.trim());
}

async function readCsvContacts(filePath: string): Promise<SourceContact[]> {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`CSV not found: ${abs}`);

  const lines: string[] = [];
  const reader = rl.createInterface({ input: fs.createReadStream(abs) });
  for await (const line of reader) lines.push(line);
  if (lines.length < 2) throw new Error("CSV appears empty");

  const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/[\s-]/g, "_"));
  const col = (...candidates: string[]) =>
    candidates.map(c => headers.indexOf(c)).find(i => i >= 0) ?? -1;

  const emailIdx  = col("email", "e_mail", "email_address");
  const fnIdx     = col("firstname", "prenom", "prénom", "first_name");
  const statusIdx = col("status", "statut", "état", "etat", "email_status");
  const blkIdx    = col("blacklisted", "blocklisted", "email_blacklisted", "blocked");
  const suppIdx   = col("is_supporter", "supporter");
  const wdIdx     = col("waitlist_date", "waitlistdate");

  if (emailIdx < 0) throw new Error(`No email column in CSV headers: [${headers.join(", ")}]`);

  const contacts: SourceContact[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const email = row[emailIdx]?.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    const rawStatus = statusIdx >= 0 ? row[statusIdx]?.toLowerCase() ?? "" : "";
    const unsub =
      rawStatus.includes("unsub") || rawStatus.includes("désinscrit") ||
      rawStatus.includes("bounce") || rawStatus.includes("rebondi") ||
      rawStatus.includes("block") || rawStatus.includes("bloqué") ||
      (blkIdx >= 0 && ["1","true","yes","oui"].includes(row[blkIdx]?.toLowerCase() ?? ""));

    contacts.push({
      email,
      firstName:    fnIdx   >= 0 ? row[fnIdx]?.trim()  || undefined : undefined,
      unsubscribed: unsub,
      supporter:    suppIdx >= 0 ? ["1","true","yes"].includes(row[suppIdx]?.toLowerCase() ?? "") : false,
      waitlistDate: wdIdx   >= 0 ? row[wdIdx]?.trim() || null : null,
      inList5:      true,  // treat all CSV rows as signups unless status indicates otherwise
      inList8:      false,
    });
  }

  console.log(`Parsed ${contacts.length} contacts from ${abs}`);
  return contacts;
}

// ---------------------------------------------------------------------------
// Resend segment helpers
// ---------------------------------------------------------------------------

async function ensureSegment(r: Resend, name: string, envId?: string): Promise<string> {
  if (envId) return envId;

  // Check if one already exists with this name
  const { data: list } = await r.segments.list();
  const existing = list?.data?.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    console.log(`  segment "${name}" already exists: ${existing.id}`);
    return existing.id;
  }

  const { data, error } = await r.segments.create({ name });
  if (error || !data) throw new Error(`Failed to create segment "${name}": ${error?.message}`);
  console.log(`  created segment "${name}": ${data.id}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function pad(n: number | string, w = 7): string {
  return String(n).padStart(w, " ");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!RESEND_KEY) { console.error("Missing RESEND_API_KEY"); process.exit(1); }

  console.log(DRY_RUN ? "=== DRY RUN — no contacts or segments will be created in Resend ===\n" : "");

  // 1. Load source contacts
  const contacts: SourceContact[] = CSV_PATH
    ? await readCsvContacts(CSV_PATH)
    : await fetchBrevoContacts();

  if (contacts.length === 0) { console.log("No contacts found."); return; }

  // 2. Compute per-contact segment membership and counts for summary
  const counts = {
    total:      contacts.length,
    users:      0,
    waitlist:   0,
    supporters: 0,
    active:     0,
    unsubscribed: 0,
    invalid:    0,
  };

  for (const c of contacts) {
    if (!c.email) { counts.invalid++; continue; }
    // A contact with no listIds in both 5 and 8 still goes to "users"
    // (they exist in Brevo so they signed up somehow)
    if (c.inList5 || (!c.inList5 && !c.inList8)) counts.users++;
    if (c.inList8) counts.waitlist++;
    if (c.supporter) counts.supporters++;
    if (c.unsubscribed) counts.unsubscribed++;
    else counts.active++;
  }

  // 3. Dry-run: print analysis and exit
  if (DRY_RUN) {
    console.log("Source analysis:");
    console.log(`  ${"Total contacts:".padEnd(26)} ${pad(counts.total)}`);
    console.log();
    console.log("By segment:");
    console.log(`  ${"→ users (list 5):".padEnd(26)} ${pad(counts.users)}`);
    console.log(`  ${"→ waitlist (list 8):".padEnd(26)} ${pad(counts.waitlist)}`);
    console.log(`  ${"→ supporters:".padEnd(26)} ${pad(counts.supporters)}`);
    console.log();
    console.log("By subscription status:");
    console.log(`  ${"Active:".padEnd(26)} ${pad(counts.active)}`);
    console.log(`  ${"Unsubscribed (incl. bounced/blocked):".padEnd(26)} ${pad(counts.unsubscribed)}`);
    if (counts.invalid > 0) {
      console.log(`  ${"Skipped (invalid email):".padEnd(26)} ${pad(counts.invalid)}`);
    }
    console.log();
    console.log("Contact properties that will be set:");
    console.log("  supporter    (number 1/0) — 1 for supporters, 0 for everyone else");
    console.log("  waitlist_date (string YYYY-MM-DD) — set for waitlist contacts with a date");
    console.log();
    console.log("Sample (first 10 contacts):");
    contacts.slice(0, 10).forEach((c, i) => {
      const segs: string[] = [];
      if (c.inList5 || (!c.inList5 && !c.inList8)) segs.push("users");
      if (c.inList8)    segs.push("waitlist");
      if (c.supporter)  segs.push("supporters");
      console.log(
        `  ${String(i + 1).padStart(3)}. [${c.unsubscribed ? "unsub " : "active"}]` +
        ` ${c.email.padEnd(35)}` +
        ` segments=[${segs.join(",")}]` +
        (c.firstName ? ` name="${c.firstName}"` : ""),
      );
    });
    console.log("\nDry run complete. Re-run without --dry-run to import.");
    return;
  }

  // 4. Live run — set up segments in Resend
  const r = new Resend(RESEND_KEY);
  console.log("Setting up segments in Resend…");
  let segIds: SegmentIds;
  try {
    segIds = {
      users:      await ensureSegment(r, "users",      process.env.RESEND_SEGMENT_USERS_ID),
      waitlist:   await ensureSegment(r, "waitlist",   process.env.RESEND_SEGMENT_WAITLIST_ID),
      supporters: await ensureSegment(r, "supporters", process.env.RESEND_SEGMENT_SUPPORTERS_ID),
    };
  } catch (err) {
    console.error("Segment setup failed:", err);
    process.exit(1);
  }

  // 5. Import contacts
  console.log(`\nImporting ${contacts.length} contacts…`);
  let imported = 0, errors = 0;

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    if (!c.email) { counts.invalid++; continue; }

    const segments: { id: string }[] = [];
    if (c.inList5 || (!c.inList5 && !c.inList8)) segments.push({ id: segIds.users });
    if (c.inList8)   segments.push({ id: segIds.waitlist });
    if (c.supporter) segments.push({ id: segIds.supporters });

    const properties: Record<string, string | number | null> = {
      supporter: c.supporter ? 1 : 0,
    };
    if (c.waitlistDate) properties.waitlist_date = c.waitlistDate;

    const payload = {
      email:        c.email,
      unsubscribed: c.unsubscribed,
      ...(c.firstName ? { firstName: c.firstName } : {}),
      properties,
      segments,
    };

    const { error } = await r.contacts.create(payload);
    if (error) {
      console.error(`  ERROR ${c.email}: ${error.message}`);
      errors++;
    } else {
      imported++;
    }

    if ((i + 1) % 100 === 0) process.stdout.write(`\r  ${i + 1} / ${contacts.length}`);
    await sleep(RATE_MS);
  }
  console.log(`\r  ${contacts.length} / ${contacts.length}`);

  // 6. Summary
  console.log("\n=== Import complete ===");
  console.log(`  ${"Total read:".padEnd(26)} ${pad(contacts.length)}`);
  console.log(`  ${"Imported / upserted:".padEnd(26)} ${pad(imported)}`);
  console.log(`  ${"Errors:".padEnd(26)} ${pad(errors)}`);
  console.log();
  console.log("By segment:");
  console.log(`  ${"→ users:".padEnd(26)} ${pad(counts.users)}`);
  console.log(`  ${"→ waitlist:".padEnd(26)} ${pad(counts.waitlist)}`);
  console.log(`  ${"→ supporters:".padEnd(26)} ${pad(counts.supporters)}`);
  console.log();
  console.log("By subscription status:");
  console.log(`  ${"Active:".padEnd(26)} ${pad(counts.active)}`);
  console.log(`  ${"Unsubscribed:".padEnd(26)} ${pad(counts.unsubscribed)}`);

  console.log("\n── Vercel env vars to add ──────────────────────────────────────");
  console.log(`  RESEND_SEGMENT_USERS_ID      = ${segIds.users}`);
  console.log(`  RESEND_SEGMENT_WAITLIST_ID   = ${segIds.waitlist}`);
  console.log(`  RESEND_SEGMENT_SUPPORTERS_ID = ${segIds.supporters}`);
  console.log("  Remove: RESEND_AUDIENCE_ID   (no longer needed)");
  console.log("────────────────────────────────────────────────────────────────");
}

main().catch(err => { console.error(err); process.exit(1); });
