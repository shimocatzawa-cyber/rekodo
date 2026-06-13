"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateTasteSummary(
  userId: string,
  starSign: string,
): Promise<{ ok: true; summary: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Not authorized." };

  const { data: links } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", userId);

  if (!links?.length) return { error: "Your collection is empty." };

  type RecordRow = { artist: string; album: string; genre: string | null; year: number | null; label: string | null; country: string | null };
  const allRecords: RecordRow[] = [];
  const recordIds = links.map(l => l.record_id);
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("artist, album, genre, year, label, country")
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
  const ownedAlbums = allRecords
    .map(r => `${r.artist} — ${r.album}`)
    .slice(0, 80);

  const collectionSummary = [
    `Star sign: ${starSign}`,
    `Total records: ${allRecords.length}`,
    genres.length    && `Genres: ${genres.map(([g, n]) => `${g} (${n})`).join(", ")}`,
    countries.length && `Countries: ${countries.map(([c, n]) => `${c} (${n})`).join(", ")}`,
    labels.length    && `Labels: ${labels.map(([l, n]) => `${l} (${n})`).join(", ")}`,
    artists.length   && `Artists with multiple records: ${artists.map(([a, n]) => `${a} (${n})`).join(", ")}`,
    decades.length   && `Decades: ${decades.map(([d, n]) => `${d} (${n})`).join(", ")}`,
    `Already owned (do NOT recommend any of these): ${ownedAlbums.join("; ")}`,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system: [
        {
          type: "text",
          text: "You are rekōdo, a music recommendation app for serious vinyl collectors. Based on a collector's taste profile and star sign, recommend ONE specific album they don't already own. Respond with a raw JSON object (no markdown, no code block) with exactly three keys: \"artist\" (string), \"album\" (string), \"description\" (one sentence, max 20 words, poetic and specific to their taste and star sign).",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: collectionSummary }],
    });

    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    const raw = block.text.trim().replace(/^```(?:json)?\n?|\n?```$/g, "");
    const parsed = JSON.parse(raw) as { artist: string; album: string; description: string };
    const summary = JSON.stringify({ artist: parsed.artist, album: parsed.album, description: parsed.description });

    await supabase
      .from("profiles")
      .update({ taste_summary: summary, taste_summary_count: allRecords.length })
      .eq("id", userId);

    const { data: pData } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
    if (pData?.username) revalidatePath(`/@${pData.username}`);

    return { ok: true, summary };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to generate recommendation." };
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

  revalidatePath(`/@${clean}`);
  redirect(`/@${clean}`);
}
