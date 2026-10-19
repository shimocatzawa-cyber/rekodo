/**
 * Local integration test: contacts.create on an existing unsubscribed contact
 * must not change unsubscribed to false.
 *
 * This verifies the invariant our signup and waitlist routes rely on —
 * that omitting `unsubscribed` from a contacts.create call preserves the
 * existing value rather than resetting it.
 *
 * Run:
 *   RESEND_API_KEY=xxx npx ts-node -P tsconfig.scripts.json src/scripts/test-resend-upsert.ts
 */

import { Resend } from "resend";

const EMAIL = `rekodo-test-upsert-${Date.now()}@example.com`;

async function run() {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error("Missing RESEND_API_KEY"); process.exit(1); }
  const r = new Resend(key);

  let passed = true;

  // ── Step 1: create contact with unsubscribed: true ────────────────────────
  console.log(`1. Creating ${EMAIL} with unsubscribed: true`);
  const { error: e1 } = await r.contacts.create({ email: EMAIL, unsubscribed: true });
  if (e1) { console.error("   FAIL — create returned:", e1.message); process.exit(1); }
  console.log("   OK");

  // ── Step 2: upsert with no unsubscribed field (our signup/waitlist path) ──
  console.log("2. Upserting same email without unsubscribed field");
  const { error: e2 } = await r.contacts.create({ email: EMAIL });
  if (e2) { console.error("   FAIL — upsert returned:", e2.message); process.exit(1); }
  console.log("   OK");

  // ── Step 3: fetch and assert ──────────────────────────────────────────────
  console.log("3. Fetching contact to check unsubscribed status");
  const { data: contact, error: e3 } = await r.contacts.get({ email: EMAIL });
  if (e3 || !contact) {
    console.error("   FAIL — get returned:", e3?.message ?? "no data");
    passed = false;
  } else if (contact.unsubscribed !== true) {
    console.error(`   FAIL — expected unsubscribed: true, got: ${contact.unsubscribed}`);
    console.error("   This means contacts.create overwrites unsubscribed when the field is omitted.");
    console.error("   Audit all contacts.create calls and confirm unsubscribed is intentionally absent.");
    passed = false;
  } else {
    console.log(`   PASS — unsubscribed is still true after upsert`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("4. Removing test contact");
  const { error: e4 } = await r.contacts.remove({ email: EMAIL });
  if (e4) console.warn("   Warning — cleanup failed:", e4.message);
  else    console.log("   OK");

  if (!passed) { console.log("\nResult: FAIL"); process.exit(1); }
  console.log("\nResult: PASS");
}

run().catch(err => { console.error(err); process.exit(1); });
