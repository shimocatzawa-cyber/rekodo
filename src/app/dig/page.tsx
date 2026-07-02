import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DigClient from "@/components/dig/DigClient";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

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

  // Distinct styles + explore picks — powers Style Dig tab and pre-computes
  // the first Inside Collection load so it's instant (no API call needed).
  // Also provides copies for an accurate collection total.
  const { data: styleLinks } = await supabase
    .from("user_records")
    .select("record_id, copies")
    .eq("user_id", user.id)
    .limit(5000);

  const styleRecordIds = (styleLinks ?? []).map((l: { record_id: string }) => l.record_id);
  const collectionCount = (styleLinks ?? []).reduce((s: number, l: { copies: number }) => s + (l.copies ?? 1), 0);

  // Quiz profile (active, non-archived) — for users with no collection yet
  let hasQuizProfile = false;
  if (styleRecordIds.length === 0) {
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

  type ExploreRec = { id: string; artist: string; album: string; year: number | null; genre: string | null; styles: string[] | null; label: string | null; format: string | null; country: string | null; producers: string[] | null };
  const explorePool: ExploreRec[] = [];
  const styleSet = new Set<string>();

  if (styleRecordIds.length > 0) {
    const batches = await Promise.all(
      Array.from({ length: Math.ceil(styleRecordIds.length / 400) }, (_, i) =>
        supabase
          .from("records")
          .select("id, artist, album, year, genre, styles, label, format, country, producers")
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

  // Fetch recent explore-mode history so the first Inside Collection load
  // doesn't re-show records the user has already seen in a previous session.
  // Scoped to explore only (discover/style rows aren't relevant here).
  const { data: exploreHistoryRows } = await (supabase as any)
    .from("dig_history")
    .select("artist, album")
    .eq("user_id", user.id)
    .eq("mode", "explore")
    .order("created_at", { ascending: false })
    .limit(100) as { data: Array<{ artist: string; album: string }> | null };

  const recentExploreKeys = new Set(
    (exploreHistoryRows ?? []).map(
      (r: { artist: string; album: string }) =>
        `${r.artist.toLowerCase()}||${r.album.toLowerCase()}`
    )
  );

  // Fresh pool for server-side picks: exclude recently shown records.
  // Fall back to full explorePool if history covers too much of the collection.
  const freshExplorePool = explorePool.filter(
    r => !recentExploreKeys.has(`${r.artist.toLowerCase()}||${r.album.toLowerCase()}`)
  );
  const serverPickPool = freshExplorePool.length >= 3 ? freshExplorePool : explorePool;

  // Pick 3 records with artist + genre diversity. Two-pass: strict diversity first,
  // then relax genre constraint so the slot is always filled.
  function serverPickExplore(records: ExploreRec[], count: number): ExploreRec[] {
    const out = [...records];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    const picked: ExploreRec[]   = [];
    const seenArtists            = new Set<string>();
    const seenGenres             = new Set<string>();
    // First pass: diverse artists + genres
    for (const r of out) {
      if (picked.length >= count) break;
      const ak = r.artist.toLowerCase().trim();
      const gk = (r.genre ?? "").toLowerCase();
      if (seenArtists.has(ak)) continue;
      if (gk && seenGenres.has(gk)) continue;
      picked.push(r);
      seenArtists.add(ak);
      if (gk) seenGenres.add(gk);
    }
    // Second pass: fill remaining, relax genre constraint
    for (const r of out) {
      if (picked.length >= count) break;
      const ak = r.artist.toLowerCase().trim();
      if (seenArtists.has(ak) || picked.some(p => p.artist === r.artist && p.album === r.album)) continue;
      picked.push(r);
      seenArtists.add(ak);
    }
    return picked;
  }

  type InitialPick = { artist: string; album: string; year: number | null; reason: string; label: string | null; format: string | null; country: string | null; genre: string | null; styles: string[] | null; producers: string[] | null; bandcamp_search_url: string; spotify_search_url: string; apple_music_search_url: string };
  const initialExplorePicks: InitialPick[] | undefined = serverPickPool.length >= 3
    ? serverPickExplore(serverPickPool, 3).map(r => {
        const q = encodeURIComponent(`${r.artist} ${r.album}`);
        return {
          artist:    r.artist,
          album:     r.album,
          year:      r.year ?? null,
          reason:    "In your collection",
          label:     r.label    ?? null,
          format:    r.format   ?? null,
          country:   r.country  ?? null,
          genre:     r.genre    ?? null,
          styles:    r.styles   ?? null,
          producers: r.producers ?? null,
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
