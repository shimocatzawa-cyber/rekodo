import AdminClient from "./AdminClient";
import { getAdminDb, enrichProfiles, PROFILE_COLUMNS, ADMIN_PAGE_SIZE } from "./lib";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const adminDb = getAdminDb();

  const [
    totalUsersResult,
    supportersResult,
    donorsResult,
    totalRecordsResult,
    profilesResult,
    pageViewSectionsResult,
    countryResult,
  ] = await Promise.all([
    adminDb.from("profiles").select("*", { count: "exact", head: true }),
    adminDb.from("profiles").select("*", { count: "exact", head: true }).in("subscription_tier", ["plus", "premium", "supporter"]),
    adminDb.from("profiles").select("*", { count: "exact", head: true }).eq("is_donor", true),
    adminDb.from("user_records").select("*", { count: "estimated", head: true }),
    adminDb.from("profiles").select(PROFILE_COLUMNS).order("last_active_at", { ascending: false, nullsFirst: false }).limit(ADMIN_PAGE_SIZE),
    adminDb.from("page_views").select("section").limit(10000),
    adminDb.from("profiles").select("country"),
  ]);

  const total        = totalUsersResult.count ?? 0;
  const supporters   = supportersResult.count ?? 0;
  const donors       = donorsResult.count ?? 0;
  const totalRecords = totalRecordsResult.count ?? 0;

  const users = await enrichProfiles(adminDb, profilesResult.data ?? []);

  const sectionCounts = new Map<string, number>();
  for (const row of pageViewSectionsResult.data ?? []) {
    sectionCounts.set(row.section as string, (sectionCounts.get(row.section as string) ?? 0) + 1);
  }
  const featurePopularity = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1]);

  const countryCounts = new Map<string, number>();
  for (const row of countryResult.data ?? []) {
    const c = (row.country as string | null)?.trim() || "Unknown";
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const countryData = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count }));

  return (
    <AdminClient
      users={users}
      total={total}
      supporters={supporters}
      donors={donors}
      totalRecords={totalRecords}
      featurePopularity={featurePopularity}
      countryData={countryData}
    />
  );
}
