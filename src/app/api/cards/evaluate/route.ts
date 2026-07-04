import { createClient } from "@/lib/supabase/server";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const user = await getUserWithTimeout(supabase);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/evaluate-user-cards`;
  try {
    await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ user_id: user.id }),
    });
  } catch {
    // Non-critical — never surface evaluation failures to the caller
  }

  return Response.json({ ok: true });
}
