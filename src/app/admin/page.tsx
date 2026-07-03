import AdminClient from "./AdminClient";
import { getAdminDb, enrichProfiles, PROFILE_COLUMNS, ADMIN_PAGE_SIZE } from "./lib";
import { ARCHETYPES } from "@/lib/archetypes/archetypeConfig";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const adminDb = getAdminDb();

  const TZ = "Australia/Sydney";
  const toSydneyDate = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date(iso));

  // Fetch from 8 days ago UTC so we never miss a signup that falls on "today"
  // in Sydney but yesterday in UTC.
  const sevenDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersResult,
    supportersResult,
    donorsResult,
    totalRecordsResult,
    profilesResult,
    pageViewSectionsResult,
    digUsersResult,
    countryResult,
    shareCardResult,
    archetypeResult,
    recentSignupsResult,
  ] = await Promise.all([
    adminDb.from("profiles").select("*", { count: "exact", head: true }),
    adminDb.from("profiles").select("*", { count: "exact", head: true }).in("subscription_tier", ["plus", "premium", "supporter"]),
    adminDb.from("profiles").select("*", { count: "exact", head: true }).eq("is_donor", true),
    adminDb.from("user_records").select("*", { count: "estimated", head: true }),
    adminDb.from("profiles").select(PROFILE_COLUMNS).order("last_active_at", { ascending: false, nullsFirst: false }).limit(ADMIN_PAGE_SIZE),
    // Unique users per section — all-time, no date cap
    adminDb.from("page_views").select("user_id, section").limit(100000),
    // Dig unique users from the reliable API-level table (page_views misses this)
    adminDb.from("dig_daily_count").select("user_id").limit(10000),
    adminDb.from("profiles").select("country"),
    adminDb.from("page_views").select("path").eq("section", "Share Card").limit(5000),
    adminDb.from("archetype_cache").select("primary_archetype").limit(10000),
    adminDb.from("profiles").select("created_at").gte("created_at", sevenDaysAgo),
  ]);

  const total        = totalUsersResult.count ?? 0;
  const supporters   = supportersResult.count ?? 0;
  const donors       = donorsResult.count ?? 0;
  const totalRecords = totalRecordsResult.count ?? 0;

  const users = await enrichProfiles(adminDb, profilesResult.data ?? []);

  // Count unique users per section (so a single power-user doesn't inflate a section)
  const sectionUsers = new Map<string, Set<string>>();
  for (const row of pageViewSectionsResult.data ?? []) {
    if (row.section === "Share Card") continue;
    const section = row.section as string;
    const uid     = row.user_id as string;
    if (!sectionUsers.has(section)) sectionUsers.set(section, new Set());
    sectionUsers.get(section)!.add(uid);
  }

  // Inject Dig from dig_daily_count — more reliable than page_views for this feature
  const digUsers = new Set((digUsersResult.data ?? []).map(r => r.user_id as string));
  if (digUsers.size > 0) {
    // Use the larger of the two sources (page_views might have some Dig entries too)
    const pvDigSize = sectionUsers.get("Dig")?.size ?? 0;
    if (digUsers.size > pvDigSize) sectionUsers.set("Dig", digUsers);
  }

  const featurePopularity = [...sectionUsers.entries()]
    .map(([section, users]) => [section, users.size] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  // Share card breakdown: path is "/share-card/{type}/{action}"
  const shareCardCounts = new Map<string, { download: number; copy: number }>();
  for (const row of (shareCardResult.data ?? [])) {
    const parts = (row.path as string).split("/");
    const rawType = parts[2] ?? "unknown";
    const action  = parts[3] as "download" | "copy" | undefined;
    const label   = rawType.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    const entry   = shareCardCounts.get(label) ?? { download: 0, copy: 0 };
    if (action === "download") entry.download++;
    else if (action === "copy") entry.copy++;
    shareCardCounts.set(label, entry);
  }
  const shareCardData = [...shareCardCounts.entries()]
    .map(([cardType, counts]) => ({ cardType, ...counts, total: counts.download + counts.copy }))
    .sort((a, b) => b.total - a.total);

  const countryCounts = new Map<string, number>();
  for (const row of countryResult.data ?? []) {
    const c = (row.country as string | null)?.trim() || "Unknown";
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const countryData = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count }));

  const archetypeCounts = new Map<string, number>();
  for (const row of archetypeResult.data ?? []) {
    const id = row.primary_archetype as string | null;
    if (!id) continue;
    archetypeCounts.set(id, (archetypeCounts.get(id) ?? 0) + 1);
  }
  const archetypeBreakdown: [string, number][] = [...archetypeCounts.entries()]
    .map(([id, count]) => [ARCHETYPES[id]?.name ?? id, count] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  // Build signups-per-day for the past 7 days in Sydney time
  const dayCountMap = new Map<string, number>();
  for (const row of recentSignupsResult.data ?? []) {
    const day = toSydneyDate(row.created_at as string);
    dayCountMap.set(day, (dayCountMap.get(day) ?? 0) + 1);
  }
  const todaySydney = toSydneyDate(new Date().toISOString());
  const signupsPerDay: { date: string; count: number }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date(todaySydney + "T00:00:00+10:00").getTime() + (i - 6) * 24 * 60 * 60 * 1000);
    const date = toSydneyDate(d.toISOString());
    return { date, count: dayCountMap.get(date) ?? 0 };
  });

  return (
    <AdminClient
      users={users}
      total={total}
      supporters={supporters}
      donors={donors}
      totalRecords={totalRecords}
      featurePopularity={featurePopularity}
      countryData={countryData}
      shareCardData={shareCardData}
      archetypeBreakdown={archetypeBreakdown}
      signupsPerDay={signupsPerDay}
    />
  );
}
