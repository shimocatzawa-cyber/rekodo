import { createClient } from "@/lib/supabase/server";
import { sendLoopsEvent } from "@/lib/loops";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const top5_releases  = Array.isArray(body.top5_releases) ? body.top5_releases : [];
  const mood_context   = typeof body.mood_context   === "string" ? body.mood_context   : null;
  const depth_breadth  = typeof body.depth_breadth  === "string" ? body.depth_breadth  : null;

  const { error } = await (supabase as any)
    .from("user_quiz_profile")
    .upsert(
      {
        user_id:       user.id,
        top5_releases,
        mood_context,
        depth_breadth,
        completed_at:  new Date().toISOString(),
        archived_at:   null,
      },
      { onConflict: "user_id" },
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (user.email) {
    sendLoopsEvent(user.email, "quiz_completed").catch(() => {});
  }

  return Response.json({ ok: true });
}
