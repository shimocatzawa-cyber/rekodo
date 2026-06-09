import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import ArtistDeepDive, { type ArtistRecord } from "@/components/deep-dive/ArtistDeepDive";

export const dynamic = "force-dynamic";

type Params = Promise<{ artistId: string }>;

export default async function ArtistDeepDivePage({ params }: { params: Params }) {
  const { artistId } = await params;
  const artist = decodeURIComponent(artistId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle() as {
      data: { username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
      error: unknown;
    };

  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw          = profile?.username ?? null;
  const username     = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;

  // Fetch all user_records for this user
  type LinkRow = { record_id: string };
  const allLinks: LinkRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("user_records")
      .select("record_id")
      .eq("user_id", user.id)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allLinks.push(...(data as LinkRow[]));
    if (data.length < PAGE) break;
  }

  const recordIds = allLinks.map((l) => l.record_id);

  // Fetch records for this artist
  const artistRecords: ArtistRecord[] = [];
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, album, year, format")
      .in("id", recordIds.slice(i, i + BATCH))
      .eq("artist", artist);
    for (const r of data ?? []) {
      artistRecords.push({
        id:     r.id,
        album:  r.album,
        year:   r.year ?? null,
        format: r.format ?? null,
      });
    }
  }

  if (artistRecords.length === 0) {
    notFound();
  }

  artistRecords.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  return (
    <>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <ArtistDeepDive artist={artist} records={artistRecords} />
    </>
  );
}
