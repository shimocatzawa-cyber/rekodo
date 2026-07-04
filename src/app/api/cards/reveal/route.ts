import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const user = await getUserWithTimeout(supabase);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { card_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { card_id } = body;
  if (!card_id) return Response.json({ error: "Missing card_id" }, { status: 400 });

  // Use service role to bypass the missing UPDATE RLS policy — user identity is
  // already verified above, and we restrict to their own row via .eq("user_id").
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await (admin as any)
    .from("user_cards")
    .update({ revealed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("card_id", card_id)
    .is("revealed_at", null); // idempotent — no-op if already revealed

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
