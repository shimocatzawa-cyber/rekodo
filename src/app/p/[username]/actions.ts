"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateTasteSummary(
  userId: string,
  _starSign = "",
): Promise<{ ok: true; summary: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Not authorized." };

  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", userId);

  if (!links?.length) return { error: "Your collection is empty." };

  type RecordRow = { artist: string; genre: string | null; year: number | null; label: string | null; country: string | null };
  const allRecords: RecordRow[] = [];
  const recordIds = links.map(l => l.record_id);
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("artist, genre, year, label, country")
      .in("id", recordIds.slice(i, i + BATCH));
    if (data) allRecords.push(...(data as RecordRow[]));
  }

  if (allRecords.length < 3) return { error: "Not enough collection data yet." };

  function topN(arr: (string | null)[], n: number): [string, number][] {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  const genres    = topN(allRecords.map(r => r.genre),   5);
  const countries = topN(allRecords.map(r => r.country), 5);
  const labels    = topN(allRecords.map(r => r.label),   5);
  const artists   = topN(allRecords.map(r => r.artist),  5).filter(([, n]) => n >= 2);
  const decades   = topN(
    allRecords.map(r => r.year).filter((y): y is number => y != null)
      .map(y => y < 1960 ? "pre-1960s" : `${Math.floor(y / 10) * 10}s`),
    6,
  );

  const collectionSummary = [
    `Total: ${allRecords.length} records`,
    genres.length    && `Genres: ${genres.map(([g, n]) => `${g} (${n})`).join(", ")}`,
    countries.length && `Countries: ${countries.map(([c, n]) => `${c} (${n})`).join(", ")}`,
    labels.length    && `Labels: ${labels.map(([l, n]) => `${l} (${n})`).join(", ")}`,
    artists.length   && `Artists with multiple records: ${artists.map(([a, n]) => `${a} (${n})`).join(", ")}`,
    decades.length   && `Decades: ${decades.map(([d, n]) => `${d} (${n})`).join(", ")}`,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: "You are rekōdo, a music identity app for serious vinyl collectors. Based on collection data, write a single evocative paragraph (2–3 sentences max) about this collector's musical identity. Be specific — reference actual genres, countries, or eras present in their data. Never use generic language. Begin with 'You' — for example: 'You are drawn to music made in rooms — intimate recordings with audible space.' Return only the paragraph, no quotes or formatting.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: collectionSummary }],
    });

    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    const summary = block.text.trim().replace(/^["']|["']$/g, "");

    await supabase
      .from("profiles")
      .update({ taste_summary: summary, taste_summary_count: allRecords.length })
      .eq("id", userId);

    // Revalidate using the internal /p/ route path (browser still sees /@username)
    const { data: pData } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
    if (pData?.username) revalidatePath(`/p/${pData.username}`);

    return { ok: true, summary };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to generate summary." };
  }
}

export async function setUsername(
  username: string
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    return { error: "3–30 characters, lowercase letters, numbers, and underscores only." };
  }

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .neq("id", user.id)
    .maybeSingle();
  if (taken) return { error: "That username is already taken." };

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username: clean }, { onConflict: "id" });

  if (error) return { error: error.message };

  revalidatePath(`/p/${clean}`);
  redirect(`/@${clean}`); // browser URL stays /@username
}
