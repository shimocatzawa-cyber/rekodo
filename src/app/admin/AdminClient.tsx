"use client";

import { useEffect, useMemo, useState } from "react";
import UserRow, { isBlocked, type AdminUser } from "./UserRow";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const INK    = "#0d0d0d";

type SortKey =
  | "username" | "email" | "location" | "archetype" | "record_count"
  | "lists_created" | "playlists_generated" | "digs_count"
  | "subscription_spend" | "donation_total" | "connected" | "discogs_username"
  | "subscription_tier" | "joined" | "last_active" | "status";

type ConnectionKey = keyof AdminUser["connections"];

const ALL_COLUMNS: { label: string; key: SortKey | null; optional?: boolean }[] = [
  { label: "Username",         key: "username" },
  { label: "Email",            key: "email" },
  { label: "Location",         key: "location" },
  { label: "Archetype",        key: "archetype" },
  { label: "Collection",       key: "record_count" },
  { label: "Lists",            key: "lists_created" },
  { label: "Playlists",        key: "playlists_generated" },
  { label: "Digs",             key: "digs_count" },
  { label: "Sub. spend",       key: "subscription_spend", optional: true },
  { label: "Donated",          key: "donation_total",     optional: true },
  { label: "Connected",        key: "connected" },
  { label: "Discogs username", key: "discogs_username",   optional: true },
  { label: "Tier",             key: "subscription_tier" },
  { label: "Joined",           key: "joined" },
  { label: "Last active",      key: "last_active" },
  { label: "Status",           key: "status" },
  { label: "",                 key: null },
];

const SORT_STORAGE_KEY = "rekodo-admin-sort";

function readStoredSort(): { key: SortKey | null; dir: "asc" | "desc" } {
  if (typeof window === "undefined") return { key: null, dir: "asc" };
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return { key: null, dir: "asc" };
    const parsed = JSON.parse(raw) as { key: SortKey | null; dir: "asc" | "desc" };
    return { key: parsed.key ?? null, dir: parsed.dir ?? "asc" };
  } catch {
    return { key: null, dir: "asc" };
  }
}

function isSupporterTier(tier: string | null): boolean {
  return ["plus", "premium", "supporter"].includes(tier ?? "");
}

function getSortValue(u: AdminUser, key: SortKey): string | number {
  switch (key) {
    case "username":            return (u.username ?? u.display_name ?? "").toLowerCase();
    case "email":                return u.email.toLowerCase();
    case "location":             return `${u.city ?? ""} ${u.country ?? ""}`.trim().toLowerCase();
    case "archetype":            return (u.archetype ?? "").toLowerCase();
    case "record_count":         return u.record_count;
    case "lists_created":        return u.lists_created;
    case "playlists_generated":  return u.playlists_generated;
    case "digs_count":           return u.digs_count;
    case "subscription_spend":   return u.subscription_spend?.cents ?? 0;
    case "donation_total":       return u.donation_total?.cents ?? 0;
    case "connected":            return Object.values(u.connections).filter(Boolean).length;
    case "discogs_username":     return (u.discogs_username ?? "").toLowerCase();
    case "subscription_tier":    return u.subscription_tier ?? "";
    case "joined":                return new Date(u.created_at).getTime();
    case "last_active":          return new Date(u.last_active_at ?? u.last_sign_in_at ?? 0).getTime();
    case "status":               return isBlocked(u.banned_until) ? 1 : 0;
  }
}

function csvEscape(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

function csvAmount(v: { cents: number; currency: string } | null): string {
  return v ? `${(v.cents / 100).toFixed(2)} ${v.currency.toUpperCase()}` : "";
}

function buildCSV(users: AdminUser[]): string {
  const headers = [
    "Username", "Email", "Location", "Archetype", "Collection",
    "Lists", "Playlists", "Digs",
    "Sub. spend", "Donated", "Connected", "Discogs username",
    "Tier", "Joined", "Last active", "Status",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const u of users) {
    const location  = `${u.city ?? ""} ${u.country ?? ""}`.trim();
    const connected = (Object.entries(u.connections) as [ConnectionKey, boolean][])
      .filter(([, on]) => on).map(([k]) => k).join("; ");
    const row = [
      u.username ?? u.display_name ?? "",
      u.email,
      location,
      u.archetype ?? "",
      String(u.record_count),
      String(u.lists_created),
      String(u.playlists_generated),
      String(u.digs_count),
      csvAmount(u.subscription_spend),
      csvAmount(u.donation_total),
      connected,
      u.discogs_username ?? "",
      isSupporterTier(u.subscription_tier) ? "Supporter" : "Free",
      u.created_at,
      u.last_active_at ?? u.last_sign_in_at ?? "",
      isBlocked(u.banned_until) ? "Blocked" : "Active",
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function downloadCSV(users: AdminUser[]) {
  const blob = new Blob([buildCSV(users)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rekodo-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const selectSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "11px", color: INK,
  background: "transparent", border: `1px solid ${RULE}`,
  padding: "6px 8px", outline: "none", cursor: "pointer",
};

const buttonSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
  textTransform: "uppercase", color: INK,
  background: "transparent", border: `1px solid ${RULE}`,
  padding: "7px 12px", cursor: "pointer",
};

export default function AdminClient({ users }: { users: AdminUser[] }) {
  const [query, setQuery]                 = useState("");
  const [tierFilter, setTierFilter]       = useState<"all" | "free" | "supporter">("all");
  const [statusFilter, setStatusFilter]   = useState<"all" | "active" | "blocked">("all");
  const [connFilter, setConnFilter]       = useState<"all" | ConnectionKey>("all");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(() => readStoredSort().key);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => readStoredSort().dir);

  // Persist sort choice across sessions
  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key: sortKey, dir: sortDir }));
    } catch {
      // ignore unavailable storage
    }
  }, [sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => {
      if (q && !(u.username ?? "").toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      if (tierFilter !== "all" && isSupporterTier(u.subscription_tier) !== (tierFilter === "supporter")) {
        return false;
      }
      if (statusFilter !== "all" && isBlocked(u.banned_until) !== (statusFilter === "blocked")) {
        return false;
      }
      if (connFilter !== "all" && !u.connections[connFilter]) {
        return false;
      }
      return true;
    });
  }, [users, query, tierFilter, statusFilter, connFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const columns = useMemo(
    () => ALL_COLUMNS.filter(c => showAllColumns || !c.optional),
    [showAllColumns]
  );

  return (
    <div style={{ padding: "40px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
          Users
        </p>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search username or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              fontFamily: MONO, fontSize: "11px", color: INK,
              background: "transparent", border: `1px solid ${RULE}`,
              padding: "6px 12px", outline: "none", width: "220px",
            }}
          />

          <select value={tierFilter} onChange={e => setTierFilter(e.target.value as typeof tierFilter)} style={selectSt}>
            <option value="all">All tiers</option>
            <option value="free">Free</option>
            <option value="supporter">Supporter</option>
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={selectSt}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          <select value={connFilter} onChange={e => setConnFilter(e.target.value as typeof connFilter)} style={selectSt}>
            <option value="all">All connections</option>
            <option value="discogs">Discogs</option>
            <option value="collection">Collection</option>
            <option value="wantlist">Wantlist</option>
            <option value="spotify">Spotify</option>
            <option value="bandcamp">Bandcamp</option>
          </select>

          <button onClick={() => setShowAllColumns(s => !s)} style={{ ...buttonSt, color: showAllColumns ? ORANGE : INK, borderColor: showAllColumns ? ORANGE : RULE }}>
            {showAllColumns ? "Hide extra columns" : "Show all columns"}
          </button>

          <button onClick={() => downloadCSV(sorted)} style={buttonSt}>
            Export CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map(({ label, key }) => (
                <th
                  key={label || "actions"}
                  onClick={key ? () => handleSort(key) : undefined}
                  style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
                    textTransform: "uppercase", color: ORANGE,
                    textAlign: "left", padding: "0 16px 12px",
                    borderBottom: `1px solid ${RULE}`,
                    whiteSpace: "nowrap",
                    cursor: key ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {label}
                  {key && (
                    <span style={{ marginLeft: "4px", color: sortKey === key ? ORANGE : RULE }}>
                      {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(user => (
              <UserRow key={user.id} user={user} showFinancial={showAllColumns} columnCount={columns.length} />
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "24px 16px" }}>
            No users match the current search/filters.
          </p>
        )}
      </div>
    </div>
  );
}
