/**
 * One-shot script: add all existing Supabase waitlist contacts to Brevo list 8.
 * Run once after Supabase comes back up:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/migrate-waitlist-to-brevo.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BREVO_LIST_ID = 8;
const BATCH_SIZE    = 150; // Brevo's importContacts limit per request

async function main() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const brevoKey     = process.env.BREVO_API_KEY!;

  if (!supabaseUrl || !serviceKey || !brevoKey) {
    console.error("Missing env vars — ensure .env.local is present with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY");
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Fetch all waitlist rows
  console.log("Fetching waitlist contacts from Supabase...");
  const { data, error } = await sb
    .from("waitlist")
    .select("email, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("No waitlist contacts found.");
    return;
  }

  console.log(`Found ${data.length} waitlist contacts. Syncing to Brevo list ${BREVO_LIST_ID}...`);

  // Batch into groups of BATCH_SIZE
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);

    const contacts = batch.map((row: { email: string; name: string | null; created_at: string }) => ({
      email: row.email,
      attributes: {
        WAITLIST_DATE: row.created_at.slice(0, 10),
        ...(row.name ? { FIRSTNAME: row.name } : {}),
      },
    }));

    const res = await fetch("https://api.brevo.com/v3/contacts/import", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
        contacts,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Batch ${i / BATCH_SIZE + 1} failed (${res.status}):`, body);
    } else {
      console.log(`Batch ${i / BATCH_SIZE + 1} — ${batch.length} contacts imported.`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
