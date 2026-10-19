/**
 * Migrate Brevo contacts → Resend audience.
 *
 * Source (pick one):
 *   1. CSV file:    npx ts-node -P tsconfig.scripts.json src/scripts/migrate-brevo-to-resend.ts contacts.csv [--dry-run]
 *   2. Brevo API:   npx ts-node -P tsconfig.scripts.json src/scripts/migrate-brevo-to-resend.ts [--dry-run]
 *
 * Required env:
 *   RESEND_API_KEY       — Resend API key
 *   RESEND_AUDIENCE_ID   — Resend audience UUID to import into
 *
 * Optional env (only needed for Brevo API source):
 *   BREVO_API_KEY
 *
 * Status mapping:
 *   Brevo emailBlacklisted / unsubscribed / hard-bounced → Resend unsubscribed: true
 *   Active contacts                                      → Resend unsubscribed: false
 *
 * Fields preserved:
 *   FIRSTNAME / first_name → first_name
 *   IS_SUPPORTER           → logged in summary (not a Resend field; lives in Supabase profiles)
 *
 * Rate limit: 2 contacts/sec (conservative against Resend's 10/sec limit).
 * Resend upserts by email — running twice is safe (idempotent).
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN      = process.argv.includes("--dry-run");
const CSV_PATH     = process.argv.find(a => !a.startsWith("-") && a.endsWith(".csv"));
const RATE_MS      = 500; // 2 contacts/sec
const RESEND_KEY   = process.env.RESEND_API_KEY;
const AUDIENCE_ID  = process.env.RESEND_AUDIENCE_ID;
const BREVO_KEY    = process.env.BREVO_API_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  email: string;
  firstName?: string;
  unsubscribed: boolean;
  supporter: boolean;
}

interface Stats {
  total:        number;
  imported:     number;
  unsubscribed: number;   // contacts imported with unsubscribed: true
  skipped:      number;   // empty/invalid email
  errors:       number;
  supporters:   number;   // IS_SUPPORTER = true contacts (noted, not synced)
}

// ---------------------------------------------------------------------------
// Brevo API source
// ---------------------------------------------------------------------------

interface BrevoContact {
  email: string;
  emailBlacklisted: boolean;
  attributes?: Record<string, unknown>;
}

async function fetchBrevoContacts(): Promise<Contact[]> {
  if (!BREVO_KEY) throw new Error("BREVO_API_KEY not set and no CSV file provided");

  const contacts: Contact[] = [];
  const limit = 50;
  let offset  = 0;
  let total   = Infinity;

  console.log("Fetching contacts from Brevo API…");

  while (offset < total) {
    const res = await fetch(
      `https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}&sort=asc`,
      { headers: { "api-key": BREVO_KEY } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Brevo API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as { contacts: BrevoContact[]; count: number };
    total = data.count;

    for (const c of data.contacts) {
      if (!c.email) continue;
      contacts.push({
        email:        c.email.toLowerCase().trim(),
        firstName:    (c.attributes?.FIRSTNAME as string | undefined) ?? undefined,
        unsubscribed: c.emailBlacklisted === true,
        supporter:    c.attributes?.IS_SUPPORTER === true,
      });
    }

    console.log(`  fetched ${Math.min(offset + limit, total)}/${total}`);
    offset += limit;

    // Brevo rate limit: 60 req/min — pause briefly between pages
    await sleep(250);
  }

  // Also fetch per-list unsubscribes (list 5 = signups, list 8 = waitlist)
  // and merge them in so list-level unsubs aren't missed.
  const unsubEmails = new Set<string>();
  for (const listId of [5, 8]) {
    let off2 = 0;
    let tot2 = Infinity;
    while (off2 < tot2) {
      const r = await fetch(
        `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/unsubscribed?limit=50&offset=${off2}`,
        { headers: { "api-key": BREVO_KEY } }
      );
      if (!r.ok) break; // list may not exist — skip
      const d = await r.json() as { contacts?: { email?: string }[]; count: number };
      tot2 = d.count ?? 0;
      for (const c of d.contacts ?? []) {
        if (c.email) unsubEmails.add(c.email.toLowerCase().trim());
      }
      off2 += 50;
      await sleep(250);
    }
  }

  // Merge in per-list unsubscribes
  return contacts.map(c => ({
    ...c,
    unsubscribed: c.unsubscribed || unsubEmails.has(c.email),
  }));
}

// ---------------------------------------------------------------------------
// CSV source
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === "," && !inQuote) {
      fields.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map(f => f.trim());
}

async function readCsvContacts(filePath: string): Promise<Contact[]> {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`CSV file not found: ${abs}`);

  const rl = readline.createInterface({ input: fs.createReadStream(abs) });
  const lines: string[] = [];
  for await (const line of rl) lines.push(line);

  if (lines.length < 2) throw new Error("CSV appears empty");

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, "_"));

  // Flexible header mapping
  const col = (candidates: string[]) =>
    candidates.map(c => headers.indexOf(c)).find(i => i >= 0) ?? -1;

  const emailIdx     = col(["email", "e-mail", "email_address"]);
  const firstNameIdx = col(["firstname", "prenom", "prénom", "first_name", "nom"]);
  const statusIdx    = col(["status", "statut", "état", "etat", "email_status"]);
  const blacklistIdx = col(["blacklisted", "blocklisted", "email_blacklisted", "blocked"]);

  if (emailIdx < 0) throw new Error(`No email column found in CSV headers: ${headers.join(", ")}`);

  const contacts: Contact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const email = row[emailIdx]?.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    const firstName = firstNameIdx >= 0 ? (row[firstNameIdx]?.trim() || undefined) : undefined;

    // Determine unsubscribed from status column
    const rawStatus = statusIdx >= 0 ? (row[statusIdx] ?? "").toLowerCase().trim() : "";
    const isUnsub =
      rawStatus.includes("unsub") ||
      rawStatus.includes("désinscrit") ||
      rawStatus.includes("bounce") ||
      rawStatus.includes("rebondi") ||
      rawStatus.includes("block") ||
      rawStatus.includes("bloqué") ||
      rawStatus.includes("hardbounce") ||
      (blacklistIdx >= 0 && ["1", "true", "yes", "oui"].includes((row[blacklistIdx] ?? "").toLowerCase().trim()));

    contacts.push({ email, firstName, unsubscribed: isUnsub, supporter: false });
  }

  console.log(`Parsed ${contacts.length} contacts from ${abs}`);
  return contacts;
}

// ---------------------------------------------------------------------------
// Resend import
// ---------------------------------------------------------------------------

async function upsertResendContact(contact: Contact): Promise<void> {
  const body: Record<string, unknown> = {
    email:        contact.email,
    unsubscribed: contact.unsubscribed,
  };
  if (contact.firstName) body.first_name = contact.firstName;

  const res = await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pad(n: number, w = 6): string {
  return String(n).padStart(w, " ");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!RESEND_KEY)  { console.error("Missing RESEND_API_KEY");   process.exit(1); }
  if (!AUDIENCE_ID) { console.error("Missing RESEND_AUDIENCE_ID"); process.exit(1); }

  if (DRY_RUN) console.log("=== DRY RUN — no contacts will be created in Resend ===\n");

  // Load contacts from source
  const contacts = CSV_PATH
    ? await readCsvContacts(CSV_PATH)
    : await fetchBrevoContacts();

  if (contacts.length === 0) {
    console.log("No contacts found. Exiting.");
    return;
  }

  const stats: Stats = { total: contacts.length, imported: 0, unsubscribed: 0, skipped: 0, errors: 0, supporters: 0 };

  console.log(`\nProcessing ${stats.total} contacts into Resend audience ${AUDIENCE_ID}…`);
  if (DRY_RUN) console.log("(dry-run — showing first 10 contacts only)\n");

  const preview = DRY_RUN ? contacts.slice(0, 10) : contacts;

  for (let i = 0; i < preview.length; i++) {
    const c = preview[i];

    if (!c.email) { stats.skipped++; continue; }
    if (c.supporter) stats.supporters++;

    const label = c.unsubscribed ? "[unsub]" : "[active]";

    if (DRY_RUN) {
      console.log(`  ${String(i + 1).padStart(4)}. ${label.padEnd(9)} ${c.email}${c.firstName ? ` (${c.firstName})` : ""}`);
      if (c.unsubscribed) stats.unsubscribed++;
      stats.imported++;
      continue;
    }

    try {
      await upsertResendContact(c);
      if (c.unsubscribed) stats.unsubscribed++;
      stats.imported++;
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${contacts.length} processed…`);
    } catch (err) {
      console.error(`  ERROR for ${c.email}: ${err instanceof Error ? err.message : String(err)}`);
      stats.errors++;
    }

    await sleep(RATE_MS);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n=== Migration summary ===");
  console.log(`  Total contacts read:   ${pad(stats.total)}`);
  console.log(`  Imported / upserted:   ${pad(stats.imported)}`);
  console.log(`    of which unsubscribed:${pad(stats.unsubscribed)}`);
  console.log(`  Skipped (invalid):     ${pad(stats.skipped)}`);
  console.log(`  Errors:                ${pad(stats.errors)}`);
  if (stats.supporters > 0) {
    console.log(`\n  Note: ${stats.supporters} contacts had IS_SUPPORTER=true in Brevo.`);
    console.log(`  Supporter status lives in Supabase profiles.is_supporter — not synced to Resend.`);
  }
  if (DRY_RUN) {
    console.log("\nDry run complete. Review the output above, then re-run without --dry-run to import.");
  } else {
    console.log("\nImport complete.");
  }
}

main().catch(err => { console.error(err); process.exit(1); });
