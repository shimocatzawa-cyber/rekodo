import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import DeepDiveClient, { type ArtistData } from "@/components/deep-dive/DeepDiveClient";

export const dynamic = "force-dynamic";

export default async function DeepDivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, bandcamp_username")
    .eq("id", user.id)
    .maybeSingle();

  const autoGen          = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw              = profile?.username ?? null;
  const username         = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel     = profile?.display_name?.trim() || username;
  const avatarUrl        = profile?.avatar_url ?? null;
  const bandcampUsername = profile?.bandcamp_username ?? null;

  // Fetch all user_record links (paginated)
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

  // Fetch artist + album + year + cover_url for all records (batched)
  type RecordRow = { id: string; artist: string; album: string; year: number | null; cover_url: string | null };
  const recordsMap = new Map<string, RecordRow>();
  const BATCH = 400;
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const { data } = await supabase
      .from("records")
      .select("id, artist, album, year, cover_url")
      .in("id", recordIds.slice(i, i + BATCH));
    for (const r of data ?? []) recordsMap.set(r.id, r as RecordRow);
  }

  // Fetch Bandcamp-imported artist names for badge display
  const { data: bcImports } = await supabase
    .from("digital_imports")
    .select("artist")
    .eq("user_id", user.id)
    .eq("source", "bandcamp");

  const bcArtists = new Set(
    (bcImports ?? []).map((r) => r.artist.toLowerCase().trim())
  );

  // Group records by artist
  const artistMap = new Map<string, { count: number; records: { album: string; year: number | null; cover_url: string | null }[] }>();
  for (const link of allLinks) {
    const r = recordsMap.get(link.record_id);
    if (!r?.artist) continue;
    const entry = artistMap.get(r.artist) ?? { count: 0, records: [] };
    entry.count++;
    entry.records.push({ album: r.album, year: r.year ?? null, cover_url: r.cover_url ?? null });
    artistMap.set(r.artist, entry);
  }

  // Fetch wantlist and build per-artist count map
  const { data: wantlistRows } = await supabase
    .from("wantlist")
    .select("artist")
    .eq("user_id", user.id);

  const wantlistCountMap = new Map<string, number>();
  for (const row of wantlistRows ?? []) {
    const key = (row.artist ?? "").toLowerCase().trim();
    wantlistCountMap.set(key, (wantlistCountMap.get(key) ?? 0) + 1);
  }

  const artists: ArtistData[] = [...artistMap.entries()]
    .filter(([name]) => !/^various/i.test(name.trim()))
    .map(([name, { count, records }]) => ({
      name,
      count,
      wantlistCount: wantlistCountMap.get(name.toLowerCase().trim()) ?? 0,
      fromBandcamp: bcArtists.has(name.toLowerCase().trim()),
      records: records.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Fetch last Bandcamp sync date
  const { data: importRows } = await supabase
    .from("digital_imports")
    .select("imported_at")
    .eq("user_id", user.id)
    .eq("source", "bandcamp")
    .order("imported_at", { ascending: false })
    .limit(1);

  const lastSyncDate = importRows?.[0]?.imported_at ?? null;

  return (
    <>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <DeepDiveClient
        artists={artists}
        userId={user.id}
        bandcampUsername={bandcampUsername}
        lastSyncDate={lastSyncDate}
      />
    </>
  );
}
