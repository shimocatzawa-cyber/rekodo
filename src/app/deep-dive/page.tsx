import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import DeepDiveClient, { type ArtistData } from "@/components/deep-dive/DeepDiveClient";
import BandcampSection from "@/components/deep-dive/BandcampSection";

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

  const artists: ArtistData[] = [...artistMap.entries()]
    .map(([name, { count, records }]) => ({
      name,
      count,
      records: records.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Fetch last Bandcamp import stats
  const { data: importRows } = await supabase
    .from("digital_imports")
    .select("is_duplicate, imported_at")
    .eq("user_id", user.id)
    .eq("source", "bandcamp");

  const lastSyncTotal      = importRows?.length ?? 0;
  const lastSyncDuplicates = importRows?.filter(r => r.is_duplicate).length ?? 0;
  const lastSyncDate       = importRows && importRows.length > 0
    ? importRows.reduce((max, r) => r.imported_at > max ? r.imported_at : max, importRows[0].imported_at)
    : null;

  return (
    <>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <div style={{ display: "none" }} className="dd-bandcamp-mobile-hide">
        <style>{`@media (min-width: 768px) { .dd-bandcamp-mobile-hide { display: block !important; } }`}</style>
        <BandcampSection
          userId={user.id}
          bandcampUsername={bandcampUsername}
          lastSyncTotal={lastSyncTotal}
          lastSyncDuplicates={lastSyncDuplicates}
          lastSyncDate={lastSyncDate}
        />
      </div>
      <DeepDiveClient artists={artists} />
    </>
  );
}
