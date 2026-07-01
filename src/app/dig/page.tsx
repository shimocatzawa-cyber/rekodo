import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DigClient from "@/components/dig/DigClient";

export const metadata: Metadata = {
  title: "Dig",
  description: "AI-powered record recommendations based on your collection and taste profile.",
  robots: { index: false, follow: false },
};

export default async function DigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const rawUsername  = profile?.username ?? null;
  const username     = (rawUsername && rawUsername !== autoGen)
    ? rawUsername
    : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;

  // Collection count
  const { count: collectionCount } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Quiz profile (active, non-archived) — for users with no collection yet
  let hasQuizProfile = false;
  if ((collectionCount ?? 0) === 0) {
    const { data: quizRow } = await (supabase as any)
      .from("user_quiz_profile")
      .select("id")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .maybeSingle() as { data: { id: string } | null };
    hasQuizProfile = !!quizRow;
  }

  // Top 5 lists count
  const { data: listsRaw } = await supabase
    .from("lists")
    .select("id, list_type")
    .eq("user_id", user.id);

  const listsCount = (listsRaw ?? []).filter(
    (l) => !l.list_type || l.list_type === "top5"
  ).length;

  // Distinct styles + explore picks — powers Style Dig tab and pre-computes
  // the first Inside Collection load so it's instant (no API call needed).
  const { data: styleLinks } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  const styleRecordIds = (styleLinks ?? []).map((l) => l.record_id);

  type ExploreRec = { id: string; artist: string; album: string; year: number | null; genre: string | null; styles: string[] | null };
  const explorePool: ExploreRec[] = [];
  const styleSet = new Set<string>();

  if (styleRecordIds.length > 0) {
    const batches = await Promise.all(
      Array.from({ length: Math.ceil(styleRecordIds.length / 400) }, (_, i) =>
        supabase
          .from("records")
          .select("id, artist, album, year, genre, styles")
          .in("id", styleRecordIds.slice(i * 400, (i + 1) * 400))
      )
    );
    for (const { data: rows } of batches) {
      for (const r of rows ?? []) {
        explorePool.push(r as ExploreRec);
        for (const s of r.styles ?? []) if (s) styleSet.add(s);
      }
    }
  }

  const availableStyles = [...styleSet].sort();

  // Pick 3 records from diverse artists for the first Inside Collection load.
  // No history exclusion here (no DB call needed) — Dig Again hits the API.
  function serverPickExplore(records: ExploreRec[], count: number): ExploreRec[] {
    const out = [...records];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    const picked: ExploreRec[] = [];
    const seen = new Set<string>();
    for (const r of out) {
      if (picked.length >= count) break;
      const key = r.artist.toLowerCase().trim();
      if (seen.has(key)) continue;
      picked.push(r);
      seen.add(key);
    }
    return picked;
  }

  type InitialPick = { artist: string; album: string; year: number | null; reason: string; bandcamp_search_url: string; spotify_search_url: string; apple_music_search_url: string };
  const initialExplorePicks: InitialPick[] | undefined = explorePool.length >= 3
    ? serverPickExplore(explorePool, 3).map(r => {
        const q = encodeURIComponent(`${r.artist} ${r.album}`);
        const parts = [r.genre, r.year?.toString()].filter(Boolean);
        return {
          artist: r.artist,
          album:  r.album,
          year:   r.year ?? null,
          reason: parts.length ? parts.join(" · ") : "In your collection",
          bandcamp_search_url:    `https://bandcamp.com/search?q=${q}`,
          spotify_search_url:     `https://open.spotify.com/search/${q}`,
          apple_music_search_url: `https://music.apple.com/search?term=${q}`,
        };
      })
    : undefined;

  return (
    <DigClient
      userId={user.id}
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      collectionCount={collectionCount ?? 0}
      listsCount={listsCount}
      availableStyles={availableStyles}
      hasQuizProfile={hasQuizProfile}
      initialExplorePicks={initialExplorePicks}
    />
  );
}
