import { createClient as createServiceClient } from "@supabase/supabase-js";
import AdminClient from "./AdminClient";
import type { AdminUser } from "./UserRow";
import { ARCHETYPES } from "@/lib/archetypes/archetypeConfig";

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

// Paginates past PostgREST's default 1000-row cap — same approach as the
// user_records count loop below, reused for the connection-status tables.
async function fetchPaged(
  adminDb: ReturnType<typeof getAdminDb>,
  table: string,
  columns: string,
  filter?: { column: string; value: string }
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 5000) {
    let query = adminDb.from(table).select(columns).range(from, from + 4999);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data } = await query;
    if (!data?.length) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < 5000) break;
  }
  return rows;
}

export default async function AdminPage() {
  const adminDb = getAdminDb();

  // Fetch profiles and auth users — explicit limit avoids Supabase's default 1000-row cap
  const [profilesResult, usersResult, wantlistRows, bandcampRows, discogsRows, archetypeRows] = await Promise.all([
    adminDb
      .from("profiles")
      .select("id, username, display_name, subscription_tier, role, created_at, last_synced_at, city, country, is_donor, spotify_connected")
      .limit(5000),
    adminDb.auth.admin.listUsers({ perPage: 1000 }),
    fetchPaged(adminDb, "wantlist", "user_id"),
    fetchPaged(adminDb, "digital_imports", "user_id", { column: "source", value: "bandcamp" }),
    fetchPaged(adminDb, "discogs_tokens", "user_id"),
    fetchPaged(adminDb, "archetype_cache", "user_id, primary_archetype"),
  ]);

  if (profilesResult.error) {
    console.error("[admin] profiles query failed:", profilesResult.error.message);
  }

  const profiles  = profilesResult.data ?? [];
  const authUsers = usersResult.data?.users ?? [];

  const profileById = new Map(profiles.map(p => [p.id, p]));

  const wantlistIds  = new Set(wantlistRows.map(r => r.user_id as string));
  const bandcampIds  = new Set(bandcampRows.map(r => r.user_id as string));
  const discogsIds   = new Set(discogsRows.map(r => r.user_id as string));
  const archetypeMap = new Map(archetypeRows.map(r => [r.user_id as string, r.primary_archetype as string | null]));

  // Paginate user_records — default PostgREST cap is 1000 which undercounts large collections
  const recordCountMap = new Map<string, number>();
  for (let from = 0; ; from += 5000) {
    const { data } = await adminDb
      .from("user_records")
      .select("user_id")
      .range(from, from + 4999);
    if (!data?.length) break;
    for (const r of data) {
      recordCountMap.set(r.user_id, (recordCountMap.get(r.user_id) ?? 0) + 1);
    }
    if (data.length < 5000) break;
  }

  // Build user list from auth (source of truth — includes everyone)
  const users: AdminUser[] = authUsers.map(u => {
    const p = profileById.get(u.id);
    const recordCount  = recordCountMap.get(u.id) ?? 0;
    const archetypeId  = archetypeMap.get(u.id) ?? null;
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
      banned_until:      u.banned_until ?? null,
      record_count:      recordCount,
      city:              p?.city ?? null,
      country:           p?.country ?? null,
      is_donor:          p?.is_donor ?? false,
      archetype:         archetypeId ? (ARCHETYPES[archetypeId]?.name ?? null) : null,
      connections: {
        collection: recordCount > 0,
        wantlist:   wantlistIds.has(u.id),
        discogs:    discogsIds.has(u.id),
        spotify:    p?.spotify_connected ?? false,
        bandcamp:   bandcampIds.has(u.id),
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

      {/* Stats bar */}
      <div style={{ borderBottom: `1px solid ${RULE}`, display: "flex" }}>
        {[
          { label: "Total users", value: total },
          { label: "Supporters",  value: supporters },
          { label: "Free",        value: free },
          { label: "Donors",      value: donors },
        ].map(({ label, value }, i) => (
          <div key={label} style={{
            flex: 1, padding: "28px 32px",
            borderLeft: i > 0 ? `1px solid ${RULE}` : "none",
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

      {/* User table */}
      <AdminClient users={users} />

    </div>
  );
}
