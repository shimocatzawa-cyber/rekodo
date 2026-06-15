import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import DeepDiveClient, { type ArtistData } from "@/components/deep-dive/DeepDiveClient";

export const metadata: Metadata = {
  title: "Deep Dive",
  description: "Explore artist discographies through your collection.",
  robots: { index: false, follow: false },
};

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
    .maybeSingle();

  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw          = profile?.username ?? null;
  const username     = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;

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

  // Fetch all Bandcamp imports (artist + album + duplicate flag)
  type BcImport = { artist: string; album: string; is_duplicate: boolean };
  const { data: bcImports } = await supabase
    .from("digital_imports")
    .select("artist, album, is_duplicate")
    .eq("user_id", user.id)
    .eq("source", "bandcamp");

  const bcArtists = new Set(
    (bcImports ?? []).map((r: BcImport) => r.artist.toLowerCase().trim())
  );

  // Group records by artist (physical collection)
  const artistMap = new Map<string, { count: number; records: { album: string; year: number | null; cover_url: string | null; source?: string }[] }>();
  for (const link of allLinks) {
    const r = recordsMap.get(link.record_id);
    if (!r?.artist) continue;
    const entry = artistMap.get(r.artist) ?? { count: 0, records: [] };
    entry.count++;
    entry.records.push({ album: r.album, year: r.year ?? null, cover_url: r.cover_url ?? null });
    artistMap.set(r.artist, entry);
  }

  // Add Bandcamp-only artists (not duplicated in physical collection)
  const bcOnlyMap = new Map<string, string[]>();
  for (const bc of (bcImports ?? []) as BcImport[]) {
    if (!bc.is_duplicate) {
      const albums = bcOnlyMap.get(bc.artist) ?? [];
      albums.push(bc.album);
      bcOnlyMap.set(bc.artist, albums);
    }
  }
  for (const [artist, albums] of bcOnlyMap.entries()) {
    if (!artistMap.has(artist)) {
      artistMap.set(artist, {
        count: albums.length,
        records: albums.map(album => ({ album, year: null, cover_url: null, source: "bandcamp" as const })),
      });
    }
  }

  const wantlistCountMap = new Map<string, number>();
  const wantlistCaseMap = new Map<string, string>();
  type WlRecord = { album: string; year: number | null; cover_url: string | null };
  const wantlistRecordsMap = new Map<string, WlRecord[]>();

  function addWantlistItem(name: string | null | undefined, rec?: WlRecord) {
    const key = (name ?? "").toLowerCase().trim();
    if (!key) return;
    wantlistCountMap.set(key, (wantlistCountMap.get(key) ?? 0) + 1);
    if (!wantlistCaseMap.has(key)) wantlistCaseMap.set(key, name!);
    if (rec) {
      const list = wantlistRecordsMap.get(key) ?? [];
      list.push(rec);
      wantlistRecordsMap.set(key, list);
    }
  }

  // Source 1: wantlist table (populated by Discogs OAuth sync)
  const { data: discogsWantlist } = await supabase
    .from("wantlist")
    .select("artist, title, released, cover_image_url")
    .eq("user_id", user.id);
  for (const row of discogsWantlist ?? []) {
    addWantlistItem(row.artist, {
      album: row.title ?? "",
      year: row.released ?? null,
      cover_url: row.cover_image_url ?? null,
    });
  }

  // Source 2 & 3: lists/list_items (CSV import + Dig-added items)
  const { data: wantlistListRow } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .in("slug", ["wantlist", "want-to-buy"])
    .limit(1)
    .maybeSingle();

  const wantlistListId = wantlistListRow?.id ?? null;

  if (wantlistListId) {
    const { data: listItems } = await supabase
      .from("list_items")
      .select("song_artist, song_album, song_year, song_cover_url, record_id")
      .eq("list_id", wantlistListId);

    const linkedRecordIds: string[] = [];
    for (const item of listItems ?? []) {
      if (item.song_artist) {
        addWantlistItem(item.song_artist as string, {
          album: (item.song_album as string | null) ?? "",
          year: (item.song_year as number | null) ?? null,
          cover_url: (item.song_cover_url as string | null) ?? null,
        });
      } else if (item.record_id) {
        linkedRecordIds.push(item.record_id as string);
      }
    }

    if (linkedRecordIds.length > 0) {
      const WL_BATCH = 400;
      for (let i = 0; i < linkedRecordIds.length; i += WL_BATCH) {
        const { data: recs } = await supabase
          .from("records")
          .select("artist, album, year, cover_url")
          .in("id", linkedRecordIds.slice(i, i + WL_BATCH));
        for (const r of recs ?? []) {
          addWantlistItem(r.artist, {
            album: r.album ?? "",
            year: r.year ?? null,
            cover_url: r.cover_url ?? null,
          });
        }
      }
    }
  }

  // Collection artists (physical + Bandcamp)
  const collectionArtists: ArtistData[] = [...artistMap.entries()]
    .filter(([name]) => !/^various/i.test(name.trim()))
    .map(([name, { count, records }]) => {
      const key = name.toLowerCase().trim();
      return {
        name,
        count,
        wantlistCount: wantlistCountMap.get(key) ?? 0,
        wantlistRecords: wantlistRecordsMap.get(key) ?? [],
        fromBandcamp: bcArtists.has(key),
        records: records.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
      };
    });

  // Wantlist-only artists (not in physical or Bandcamp collection)
  const collectionNames = new Set(collectionArtists.map((a) => a.name.toLowerCase().trim()));
  const wantlistOnlyArtists: ArtistData[] = [...wantlistCountMap.entries()]
    .filter(([key]) => {
      if (collectionNames.has(key)) return false;
      const name = wantlistCaseMap.get(key) ?? "";
      return name.length > 0 && !/^various/i.test(name.trim());
    })
    .map(([key, count]) => ({
      name: wantlistCaseMap.get(key)!,
      count: 0,
      wantlistCount: count,
      wantlistRecords: wantlistRecordsMap.get(key) ?? [],
      fromBandcamp: false,
      records: [] as ArtistData["records"],
    }));

  const artists: ArtistData[] = [
    ...collectionArtists,
    ...wantlistOnlyArtists,
  ].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <DeepDiveClient
        artists={artists}
        userId={user.id}
        wantlistListId={wantlistListId}
      />
    </>
  );
}
