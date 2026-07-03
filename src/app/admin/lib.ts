import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ARCHETYPES } from "@/lib/archetypes/archetypeConfig";
import type { AdminUser } from "./UserRow";

export type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  subscription_tier: string | null;
  role: string | null;
  created_at: string;
  last_synced_at: string | null;
  last_active_at: string | null;
  city: string | null;
  country: string | null;
  is_donor: boolean;
  is_supporter: boolean;
  is_test: boolean;
  spotify_connected: boolean;
  bandcamp_username: string | null;
  referral_source: string | null;
};

export const PROFILE_COLUMNS =
  "id, username, display_name, subscription_tier, role, created_at, last_synced_at, last_active_at, city, country, is_donor, is_supporter, is_test, spotify_connected, bandcamp_username, referral_source";

export const ADMIN_PAGE_SIZE = 20;

export function getAdminDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isWantlistSlug(slug: string): boolean {
  return slug === "wantlist" || slug === "want-to-buy";
}

// Fetch auth + all associated table data for a given set of profiles,
// filtered to those user IDs only. Much faster than fetching everything.
export async function enrichProfiles(
  adminDb: ReturnType<typeof getAdminDb>,
  profiles: ProfileRow[]
): Promise<AdminUser[]> {
  if (profiles.length === 0) return [];
  const userIds = profiles.map(p => p.id);

  const [
    authResults,
    listResult,
    discogsResult,
    archetypeResult,
    paymentResult,
    pageViewResult,
    digResult,
    recordCounts,
  ] = await Promise.all([
    // Auth data: one getUserById per user (parallel, no bulk API available)
    Promise.all(userIds.map(id => adminDb.auth.admin.getUserById(id))),
    adminDb.from("lists").select("user_id, list_type, slug").in("user_id", userIds),
    adminDb.from("discogs_tokens").select("user_id, discogs_username").in("user_id", userIds),
    adminDb.from("archetype_cache").select("user_id, primary_archetype").in("user_id", userIds),
    adminDb.from("payments").select("user_id, type, amount_cents, currency").in("user_id", userIds),
    // page_views: limit per-user subset to a reasonable bound for top-sections display
    adminDb.from("page_views").select("user_id, section").in("user_id", userIds).limit(2000),
    adminDb.from("dig_daily_count").select("user_id, count").in("user_id", userIds),
    // Sum copies per user — paginate with .range() to bypass the PostgREST
    // max_rows cap (1000). .limit(N > 1000) is silently capped server-side.
    Promise.all(
      userIds.map(async id => {
        let total = 0;
        const PAGE = 1000;
        for (let page = 0; ; page++) {
          const { data } = await adminDb
            .from("user_records")
            .select("copies")
            .eq("user_id", id)
            .range(page * PAGE, (page + 1) * PAGE - 1);
          if (!data || data.length === 0) break;
          total += (data as { copies: number }[]).reduce((s, x) => s + (x.copies ?? 1), 0);
          if (data.length < PAGE) break;
        }
        return { id, count: total };
      })
    ),
  ]);

  const authMap = new Map(
    authResults
      .filter(r => r.data?.user)
      .map(r => [r.data!.user!.id, r.data!.user!])
  );

  const listRows      = listResult.data      ?? [];
  const discogsRows   = discogsResult.data   ?? [];
  const archetypeRows = archetypeResult.data ?? [];
  const paymentRows   = paymentResult.data   ?? [];
  const pageViewRows  = pageViewResult.data  ?? [];
  const digRows       = digResult.data       ?? [];

  const wantlistIds        = new Set(listRows.filter(r => isWantlistSlug(r.slug as string)).map(r => r.user_id as string));
  const discogsIds         = new Set(discogsRows.map(r => r.user_id as string));
  const discogsUsernameMap = new Map(discogsRows.map(r => [r.user_id as string, r.discogs_username as string | null]));
  const archetypeMap       = new Map(archetypeRows.map(r => [r.user_id as string, r.primary_archetype as string | null]));
  const recordCountMap     = new Map(recordCounts.map(r => [r.id, r.count]));

  const listsCreatedMap      = new Map<string, number>();
  const playlistsGeneratedMap = new Map<string, number>();
  for (const row of listRows) {
    const uid      = row.user_id as string;
    const listType = (row.list_type as string | null) ?? "top5";
    const slug     = row.slug as string;
    if (listType === "top5") {
      listsCreatedMap.set(uid, (listsCreatedMap.get(uid) ?? 0) + 1);
    } else if (listType === "personal" && !isWantlistSlug(slug)) {
      playlistsGeneratedMap.set(uid, (playlistsGeneratedMap.get(uid) ?? 0) + 1);
    }
  }

  const digCountMap = new Map<string, number>();
  for (const row of digRows) {
    const uid = row.user_id as string;
    digCountMap.set(uid, (digCountMap.get(uid) ?? 0) + (row.count as number));
  }

  const subSpendMap = new Map<string, { cents: number; currency: string }>();
  const donationMap = new Map<string, { cents: number; currency: string }>();
  for (const row of paymentRows) {
    const uid   = row.user_id as string;
    const cents = row.amount_cents as number;
    const cur   = (row.currency as string) ?? "usd";
    if (row.type === "subscription") {
      const prev = subSpendMap.get(uid) ?? { cents: 0, currency: cur };
      subSpendMap.set(uid, { cents: prev.cents + cents, currency: cur });
    } else if (row.type === "donation") {
      const prev = donationMap.get(uid) ?? { cents: 0, currency: cur };
      donationMap.set(uid, { cents: prev.cents + cents, currency: cur });
    }
  }

  const userSectionCounts = new Map<string, Map<string, number>>();
  for (const row of pageViewRows) {
    const uid     = row.user_id as string;
    const section = row.section as string;
    const userMap = userSectionCounts.get(uid) ?? new Map<string, number>();
    userMap.set(section, (userMap.get(section) ?? 0) + 1);
    userSectionCounts.set(uid, userMap);
  }

  return profiles.map(p => {
    const u           = authMap.get(p.id);
    const recordCount = recordCountMap.get(p.id) ?? 0;
    const archetypeId = archetypeMap.get(p.id) ?? null;
    return {
      id:                   p.id,
      username:             p.username,
      display_name:         p.display_name,
      email:                u?.email ?? "",
      subscription_tier:    p.subscription_tier,
      role:                 p.role,
      created_at:           p.created_at,
      last_sign_in_at:      u?.last_sign_in_at ?? null,
      last_synced_at:       p.last_synced_at,
      last_active_at:       p.last_active_at,
      banned_until:         u?.banned_until ?? null,
      record_count:         recordCount,
      city:                 p.city,
      country:              p.country,
      is_donor:             p.is_donor,
      is_supporter:         p.is_supporter,
      is_test:              p.is_test,
      archetype:            archetypeId ? (ARCHETYPES[archetypeId]?.name ?? null) : null,
      discogs_username:     discogsUsernameMap.get(p.id) ?? null,
      subscription_spend:   subSpendMap.get(p.id) ?? null,
      donation_total:       donationMap.get(p.id) ?? null,
      lists_created:        listsCreatedMap.get(p.id) ?? 0,
      playlists_generated:  playlistsGeneratedMap.get(p.id) ?? 0,
      digs_count:           digCountMap.get(p.id) ?? 0,
      top_sections:         [...(userSectionCounts.get(p.id) ?? new Map<string, number>()).entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([section, count]) => ({ section, count })),
      referral_source: p.referral_source,
      connections: {
        collection: recordCount > 0,
        wantlist:   wantlistIds.has(p.id),
        discogs:    discogsIds.has(p.id),
        spotify:    p.spotify_connected,
        bandcamp:   !!p.bandcamp_username,
      },
    } satisfies AdminUser;
  });
}
