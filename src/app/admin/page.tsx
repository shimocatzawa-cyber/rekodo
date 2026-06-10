import { createClient as createServiceClient } from "@supabase/supabase-js";
import UserRow, { type AdminUser } from "./UserRow";

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

  const [profilesResult, usersResult] = await Promise.all([
    adminDb
      .from("profiles")
      .select("id, username, display_name, subscription_tier, role, created_at")
      .order("created_at", { ascending: false }),
    adminDb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const profiles = profilesResult.data ?? [];
  const authUsers = usersResult.data?.users ?? [];

  const emailById = new Map(authUsers.map(u => [u.id, u.email ?? ""]));

  const users: AdminUser[] = profiles.map(p => ({
    id:                p.id,
    username:          p.username,
    email:             emailById.get(p.id) ?? "",
    subscription_tier: p.subscription_tier,
    role:              p.role,
    created_at:        p.created_at,
  }));

  const total    = users.length;
  const plus      = users.filter(u => u.subscription_tier === "plus").length;
  const premium   = users.filter(u => u.subscription_tier === "premium").length;
  const free      = users.filter(u => !u.subscription_tier || u.subscription_tier === "free").length;

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
          { label: "Total users",        value: total },
          { label: "Plus",               value: plus },
          { label: "Premium",            value: premium },
          { label: "Free",               value: free },
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
      <div style={{ padding: "40px 48px" }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px 0" }}>
          Users
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Username", "Email", "Tier", "Role", "Joined", ""].map(col => (
                  <th key={col} style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
                    textTransform: "uppercase", color: ORANGE,
                    textAlign: "left", padding: "0 16px 12px",
                    borderBottom: `1px solid ${RULE}`,
                    whiteSpace: "nowrap",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
