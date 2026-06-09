import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import DeepDiveDirectory, { type ArtistEntry } from "@/components/deep-dive/DeepDiveDirectory";

export const dynamic = "force-dynamic";

export default async function DeepDivePage() {
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

  const autoGen     = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw         = profile?.username ?? null;
  const username    = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl   = profile?.avatar_url ?? null;

  // Fetch all record IDs for this user
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

  // Fetch artist names for all records (batched)
  const artistCounts = new Map<string, number>();
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("artist")
      .in("id", recordIds.slice(i, i + BATCH));
    for (const r of data ?? []) {
      if (r.artist) {
        artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
      }
    }
  }

  const artists: ArtistEntry[] = [...artistCounts.entries()]
    .map(([artist, count]) => ({ artist, count }))
    .sort((a, b) => b.count - a.count || a.artist.localeCompare(b.artist));

  return (
    <>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <DeepDiveDirectory
        artists={artists}
        username={username}
        displayLabel={displayLabel}
        avatarUrl={avatarUrl}
      />
    </>
  );
}
