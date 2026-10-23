/**
 * Local integration test: our update → create-if-not-found pattern must not
 * overwrite unsubscribed: true on an existing contact.
 *
 * Background: contacts.create resets unsubscribed to false when the field is
 * omitted (confirmed empirically — Resend treats omission as false, not "keep").
 * Our signup and waitlist routes therefore use contacts.update first; only if
 * the contact doesn't exist do they call contacts.create with explicit
 * unsubscribed: false.
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

  // ── Step 2: simulate our signup/waitlist path (update → skip create) ──────
  console.log("2. Calling contacts.update (our pattern for existing contacts)");
  const { error: updateErr } = await r.contacts.update({ email: EMAIL });
  if (updateErr?.name === "not_found") {
    console.error("   FAIL — update returned not_found; contact wasn't created in step 1");
    passed = false;
  } else if (updateErr) {
    console.error("   FAIL — update returned:", updateErr.message);
    passed = false;
  } else {
    console.log("   OK — update succeeded, contacts.create was NOT called");
  }

  // ── Step 3: fetch and assert unsubscribed is unchanged ────────────────────
  console.log("3. Fetching contact to check unsubscribed status");
  const { data: contact, error: e3 } = await r.contacts.get({ email: EMAIL });
  if (e3 || !contact) {
    console.error("   FAIL — get returned:", e3?.message ?? "no data");
    passed = false;
  } else if (contact.unsubscribed !== true) {
    console.error(`   FAIL — expected unsubscribed: true, got: ${contact.unsubscribed}`);
    passed = false;
  } else {
    console.log("   PASS — unsubscribed is still true after update");
  }

  // ── Step 4: also confirm that contacts.create without unsubscribed resets ─
  // (documents the Resend API behaviour that motivated this pattern)
  console.log("4. Confirming contacts.create without unsubscribed resets it to false (known Resend behaviour)");
  const { error: e4 } = await r.contacts.create({ email: EMAIL });
  if (e4) {
    console.error("   FAIL — create returned:", e4.message);
    passed = false;
  } else {
    const { data: after, error: e4g } = await r.contacts.get({ email: EMAIL });
    if (e4g || !after) {
      console.error("   FAIL — get after create returned:", e4g?.message ?? "no data");
      passed = false;
    } else if (after.unsubscribed !== false) {
      console.log(`   NOTE — contacts.create kept unsubscribed: ${after.unsubscribed} (Resend behaviour may have changed)`);
    } else {
      console.log("   CONFIRMED — contacts.create reset unsubscribed to false (this is why we use update first)");
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("5. Removing test contact");
  const { error: e5 } = await r.contacts.remove({ email: EMAIL });
  if (e5) console.warn("   Warning — cleanup failed:", e5.message);
  else    console.log("   OK");

  if (!passed) { console.log("\nResult: FAIL"); process.exit(1); }
  console.log("\nResult: PASS");
}

run().catch(err => { console.error(err); process.exit(1); });
