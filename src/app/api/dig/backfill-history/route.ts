import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OldRec = { artist: string; album: string; reason?: string | null };
type OldSession = { id: string; date: string; mode: string; recs: OldRec[] };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { sessions?: OldSession[] };
  const sessions: OldSession[] = Array.isArray(body.sessions) ? body.sessions : [];
  if (sessions.length === 0) return Response.json({ inserted: 0 });

  // Build rows from old localStorage sessions
  const rows: { user_id: string; mode: string; artist: string; album: string; reason: string | null; created_at: string }[] = [];

  for (const session of sessions) {
    if (!session.date || !Array.isArray(session.recs)) continue;
    const mode = session.mode === "style" ? "style" : "discover";
    for (const rec of session.recs) {
      if (!rec.artist || !rec.album) continue;
      rows.push({
        user_id:    user.id,
        mode,
        artist:     rec.artist,
        album:      rec.album,
        reason:     rec.reason ?? null,
        created_at: session.date,
      });
    }
  }

  if (rows.length === 0) return Response.json({ inserted: 0 });

  // Fetch existing entries to avoid duplicates (match on artist+album+created_at)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("dig_history")
    .select("artist, album, created_at")
    .eq("user_id", user.id);

  const existingKeys = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((existing ?? []) as any[]).map((r: any) => `${r.artist}||${r.album}||${r.created_at}`)
  );

  const toInsert = rows.filter(
    r => !existingKeys.has(`${r.artist}||${r.album}||${r.created_at}`)
  );

  if (toInsert.length === 0) return Response.json({ inserted: 0 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("dig_history").insert(toInsert);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ inserted: toInsert.length });
}
