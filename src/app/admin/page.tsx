import AdminClient from "./AdminClient";
import { getAdminDb, enrichProfiles, PROFILE_COLUMNS, ADMIN_PAGE_SIZE } from "./lib";

export const dynamic = "force-dynamic";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const INK    = "#0d0d0d";

export default async function AdminPage() {
  const adminDb = getAdminDb();

  // Fast COUNT queries + initial profile page + feature popularity, all in parallel.
  // We no longer paginate every table — each query is bounded.
  const [
    totalUsersResult,
    supportersResult,
    donorsResult,
    totalRecordsResult,
    profilesResult,
    pageViewSectionsResult,
  ] = await Promise.all([
    adminDb.from("profiles").select("*", { count: "exact", head: true }),
    adminDb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("subscription_tier", ["plus", "premium", "supporter"]),
    adminDb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_donor", true),
    adminDb.from("user_records").select("*", { count: "exact", head: true }),
    // First page of users — most recently active first, nulls last
    adminDb
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .order("last_active_at", { ascending: false, nullsFirst: false })
      .limit(ADMIN_PAGE_SIZE),
    // Section popularity — only the section column, bounded to recent activity
    adminDb.from("page_views").select("section").limit(10000),
  ]);

  const total      = totalUsersResult.count ?? 0;
  const supporters = supportersResult.count ?? 0;
  const free       = total - supporters;
  const donors     = donorsResult.count ?? 0;
  const totalRecords = totalRecordsResult.count ?? 0;

  // Enrich the initial user batch (fetches per-user associated data)
  const initialProfiles = profilesResult.data ?? [];
  const users = await enrichProfiles(adminDb, initialProfiles);

  // Feature popularity from a bounded recent sample of page views
  const sectionCounts = new Map<string, number>();
  for (const row of pageViewSectionsResult.data ?? []) {
    sectionCounts.set(row.section as string, (sectionCounts.get(row.section as string) ?? 0) + 1);
  }
  const featurePopularity = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxSectionCount   = featurePopularity[0]?.[1] ?? 0;

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

        {/* Stats (5 items): collection stats left, user counts fill remaining */}
        <div style={{ flex: 1, display: "flex" }}>
          {[
            { label: "Total records", value: totalRecords.toLocaleString() },
            { label: "Total users",   value: total.toLocaleString() },
            { label: "Supporters",    value: supporters.toLocaleString() },
            { label: "Free",          value: free.toLocaleString() },
            { label: "Donors",        value: donors.toLocaleString() },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              flex: 1,
              padding: "28px 20px",
              borderLeft: i > 0 ? `1px solid ${RULE}` : "none",
            }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px 0" }}>
                {label}
              </p>
              <p style={{ fontFamily: SERIF, fontSize: "30px", color: INK, margin: 0, lineHeight: 1 }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Feature popularity — top right */}
        <div style={{ flex: 1, padding: "28px 32px", borderLeft: `1px solid ${RULE}` }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px 0" }}>
            Feature popularity (recent page views)
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
      <AdminClient users={users} total={total} />

    </div>
  );
}
