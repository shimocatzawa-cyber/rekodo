import { createClient } from "@/lib/supabase/server";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_GAP_MS = 90_000; // picks > 90s apart = separate sessions

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  const { data: rows } = await (supabase as any)
    .from("dig_history")
    .select("artist, album, mode, reason, created_at")
    .eq("user_id", user.id)
    .neq("mode", "explore")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200) as { data: Array<{ artist: string; album: string; mode: string; reason: string | null; created_at: string }> | null };

  type Session = { id: string; date: string; mode: string; recs: Array<{ artist: string; album: string; reason: string | null }> };
  const sessions: Session[] = [];

  for (const row of rows ?? []) {
    const rowTime = new Date(row.created_at).getTime();
    const last = sessions[sessions.length - 1];
    const lastTime = last ? new Date(last.date).getTime() : null;
    if (!last || lastTime === null || lastTime - rowTime > SESSION_GAP_MS) {
      sessions.push({ id: row.created_at, date: row.created_at, mode: row.mode, recs: [] });
    }
    sessions[sessions.length - 1].recs.push({ artist: row.artist, album: row.album, reason: row.reason });
  }

  return Response.json({ sessions });
}
