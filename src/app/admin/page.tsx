import { createClient as createServiceClient, type User } from "@supabase/supabase-js";
import AdminClient from "./AdminClient";
import type { AdminUser } from "./UserRow";
import { ARCHETYPES } from "@/lib/archetypes/archetypeConfig";

type ProfileRow = {
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
  spotify_connected: boolean;
  bandcamp_username: string | null;
};

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const INK    = "#0d0d0d";

function getAdminDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Paginates past PostgREST's 1000-row hard cap. Batch size must be ≤ 1000 —
// requesting more returns exactly 1000, causing the loop to break too early.
async function fetchPaged(
  adminDb: ReturnType<typeof getAdminDb>,
  table: string,
  columns: string,
  filter?: { column: string; value: string }
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const BATCH = 1000;
  for (let from = 0; ; from += BATCH) {
    let query = adminDb.from(table).select(columns).range(from, from + BATCH - 1);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data } = await query;
    if (!data?.length) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < BATCH) break;
  }
  return rows;
}

// auth.admin.listUsers has its own page/perPage cap — must be paginated separately from fetchPaged.
async function fetchAllAuthUsers(adminDb: ReturnType<typeof getAdminDb>): Promise<User[]> {
  const users: User[] = [];
  const PER_PAGE = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await adminDb.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) {
      console.error("[admin] listUsers query failed:", error.message);
      break;
    }
    if (!data.users.length) break;
    users.push(...data.users);
    if (data.users.length < PER_PAGE) break;
  }
  return users;
}

export default async function AdminPage() {
  const adminDb = getAdminDb();

  // Fetch profiles and auth users — paginated past Supabase's 1000-row/page caps
  const [profiles, authUsers, wantlistRows, discogsRows, archetypeRows, paymentRows, pageViewRows] = await Promise.all([
    fetchPaged(
      adminDb,
      "profiles",
      "id, username, display_name, subscription_tier, role, created_at, last_synced_at, last_active_at, city, country, is_donor, spotify_connected, bandcamp_username"
    ),
    fetchAllAuthUsers(adminDb),
    fetchPaged(adminDb, "lists", "user_id", { column: "slug", value: "wantlist" }),
    fetchPaged(adminDb, "discogs_tokens", "user_id, discogs_username"),
    fetchPaged(adminDb, "archetype_cache", "user_id, primary_archetype"),
    fetchPaged(adminDb, "payments", "user_id, type, amount_cents, currency"),
    fetchPaged(adminDb, "page_views", "user_id, section"),
  ]);

  const profileById = new Map(profiles.map(p => [p.id as string, p as unknown as ProfileRow]));

  const wantlistIds  = new Set(wantlistRows.map(r => r.user_id as string));
  const discogsIds   = new Set(discogsRows.map(r => r.user_id as string));
  const discogsUsernameMap = new Map(discogsRows.map(r => [r.user_id as string, r.discogs_username as string | null]));
  const archetypeMap = new Map(archetypeRows.map(r => [r.user_id as string, r.primary_archetype as string | null]));

  // Aggregate payments per user
  const subSpendMap  = new Map<string, { cents: number; currency: string }>();
  const donationMap  = new Map<string, { cents: number; currency: string }>();
  for (const row of paymentRows) {
    const uid  = row.user_id as string;
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

  // Aggregate page views: overall section popularity + each user's top sections
  const sectionCounts = new Map<string, number>();
  const userSectionCounts = new Map<string, Map<string, number>>();
  for (const row of pageViewRows) {
    const uid     = row.user_id as string;
    const section = row.section as string;
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    const userMap = userSectionCounts.get(uid) ?? new Map<string, number>();
    userMap.set(section, (userMap.get(section) ?? 0) + 1);
    userSectionCounts.set(uid, userMap);
  }
  const featurePopularity = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxSectionCount = featurePopularity[0]?.[1] ?? 0;

  // Paginate user_records — batch must be ≤ 1000 to match PostgREST's hard cap
  const recordCountMap = new Map<string, number>();
  const REC_BATCH = 1000;
  for (let from = 0; ; from += REC_BATCH) {
    const { data } = await adminDb
      .from("user_records")
      .select("user_id")
      .range(from, from + REC_BATCH - 1);
    if (!data?.length) break;
    for (const r of data) {
      recordCountMap.set(r.user_id, (recordCountMap.get(r.user_id) ?? 0) + 1);
    }
    if (data.length < REC_BATCH) break;
  }

  // Build user list from auth (source of truth — includes everyone)
  const users: AdminUser[] = authUsers.map(u => {
    const p = profileById.get(u.id);
    const recordCount  = recordCountMap.get(u.id) ?? 0;
    const archetypeId  = archetypeMap.get(u.id) ?? null;
    const subSpend     = subSpendMap.get(u.id) ?? null;
    const donation     = donationMap.get(u.id) ?? null;
    return {
      id:                u.id,
      username:          p?.username ?? null,
      display_name:      p?.display_name ?? null,
      email:             u.email ?? "",
      subscription_tier: p?.subscription_tier ?? null,
      role:              p?.role ?? null,
      created_at:        p?.created_at ?? u.created_at,
      last_sign_in_at:   u.last_sign_in_at ?? null,
      last_synced_at:    p?.last_synced_at ?? null,
      last_active_at:    p?.last_active_at ?? null,
      banned_until:      u.banned_until ?? null,
      record_count:      recordCount,
      city:              p?.city ?? null,
      country:           p?.country ?? null,
      is_donor:          p?.is_donor ?? false,
      archetype:         archetypeId ? (ARCHETYPES[archetypeId]?.name ?? null) : null,
      discogs_username:  discogsUsernameMap.get(u.id) ?? null,
      subscription_spend: subSpend,
      donation_total:     donation,
      top_sections: [...(userSectionCounts.get(u.id) ?? new Map<string, number>()).entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([section, count]) => ({ section, count })),
      connections: {
        collection: recordCount > 0,
        wantlist:   wantlistIds.has(u.id),
        discogs:    discogsIds.has(u.id),
        spotify:    p?.spotify_connected ?? false,
        bandcamp:   !!(p?.bandcamp_username),
      },
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total      = users.length;
  const supporters = users.filter(u => u.subscription_tier && u.subscription_tier !== "free").length;
  const free       = users.filter(u => !u.subscription_tier || u.subscription_tier === "free").length;
  const donors     = users.filter(u => u.is_donor).length;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${RULE}`, padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: ORANGE, lineHeight: 1 }}>
          rekōdo
        </span>
        <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
          Admin
        </span>
      </header>

      {/* Stats grid + feature popularity */}
      <div style={{ borderBottom: `1px solid ${RULE}`, display: "flex" }}>

        {/* Stats (2x2): Total users / Supporters on top, Free / Donors below */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[
            { label: "Total users", value: total },
            { label: "Supporters",  value: supporters },
            { label: "Free",        value: free },
            { label: "Donors",      value: donors },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              padding: "28px 32px",
              borderLeft: i % 2 === 1 ? `1px solid ${RULE}` : "none",
              borderTop:  i >= 2 ? `1px solid ${RULE}` : "none",
            }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px 0" }}>
                {label}
              </p>
              <p style={{ fontFamily: SERIF, fontSize: "36px", color: INK, margin: 0, lineHeight: 1 }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Feature popularity — top right */}
        <div style={{ flex: 1, padding: "28px 32px", borderLeft: `1px solid ${RULE}` }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px 0" }}>
            Feature popularity (all-time page views)
          </p>
          {featurePopularity.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, margin: 0 }}>
              No page views tracked yet — data will appear as users browse.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {featurePopularity.map(([section, count]) => (
                <div key={section} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: INK, width: "100px", flexShrink: 0 }}>
                    {section}
                  </span>
                  <div style={{ flex: 1, background: "#f0f0ea", height: "8px" }}>
                    <div style={{
                      width: `${maxSectionCount ? (count / maxSectionCount) * 100 : 0}%`,
                      height: "100%", background: ORANGE,
                    }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, width: "40px", textAlign: "right" as const, flexShrink: 0 }}>
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User table */}
      <AdminClient users={users} />

    </div>
  );
}
