import { createClient as createServiceClient } from "@supabase/supabase-js";
import AdminClient from "./AdminClient";
import type { AdminUser } from "./UserRow";

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

export default async function AdminPage() {
  const adminDb = getAdminDb();

  const [profilesResult, usersResult, recordLinksResult] = await Promise.all([
    adminDb
      .from("profiles")
      .select("id, username, display_name, subscription_tier, role, created_at"),
    adminDb.auth.admin.listUsers({ perPage: 1000 }),
    adminDb.from("user_records").select("user_id"),
  ]);

  const profiles   = profilesResult.data ?? [];
  const authUsers  = usersResult.data?.users ?? [];
  const recordLinks = recordLinksResult.data ?? [];

  const profileById = new Map(profiles.map(p => [p.id, p]));

  // Count records per user
  const recordCountMap = new Map<string, number>();
  for (const r of recordLinks) {
    recordCountMap.set(r.user_id, (recordCountMap.get(r.user_id) ?? 0) + 1);
  }

  // Build user list from auth (source of truth — includes everyone)
  const users: AdminUser[] = authUsers.map(u => {
    const p = profileById.get(u.id);
    const bannedUntil = ((u as unknown) as Record<string, unknown>).banned_until as string | null ?? null;
    return {
      id:                u.id,
      username:          p?.username ?? null,
      email:             u.email ?? "",
      subscription_tier: p?.subscription_tier ?? null,
      role:              p?.role ?? null,
      created_at:        p?.created_at ?? u.created_at,
      last_sign_in_at:   u.last_sign_in_at ?? null,
      banned_until:      bannedUntil,
      record_count:      recordCountMap.get(u.id) ?? 0,
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total      = users.length;
  const supporters = users.filter(u => u.subscription_tier && u.subscription_tier !== "free").length;
  const free       = users.filter(u => !u.subscription_tier || u.subscription_tier === "free").length;

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
