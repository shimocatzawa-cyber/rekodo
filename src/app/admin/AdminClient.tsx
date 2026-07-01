"use client";

import { useEffect, useMemo, useState } from "react";
import UserRow, { isBlocked, type AdminUser } from "./UserRow";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const INK    = "#0d0d0d";

type AdminTab = "users" | "countries" | "features";

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
    case "email":               return u.email.toLowerCase();
    case "location":            return `${u.city ?? ""} ${u.country ?? ""}`.trim().toLowerCase();
    case "archetype":           return (u.archetype ?? "").toLowerCase();
    case "record_count":        return u.record_count;
    case "lists_created":       return u.lists_created;
    case "playlists_generated": return u.playlists_generated;
    case "digs_count":          return u.digs_count;
    case "subscription_spend":  return u.subscription_spend?.cents ?? 0;
    case "donation_total":      return u.donation_total?.cents ?? 0;
    case "connected":           return Object.values(u.connections).filter(Boolean).length;
    case "discogs_username":    return (u.discogs_username ?? "").toLowerCase();
    case "subscription_tier":   return u.subscription_tier ?? "";
    case "joined":              return new Date(u.created_at).getTime();
    case "last_active":         return new Date(u.last_active_at ?? u.last_sign_in_at ?? 0).getTime();
    case "status":              return isBlocked(u.banned_until) ? 1 : 0;
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
    "Lists", "Playlists", "Digs", "Sub. spend", "Donated",
    "Connected", "Discogs username", "Tier", "Joined", "Last active", "Status",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const u of users) {
    const location  = `${u.city ?? ""} ${u.country ?? ""}`.trim();
    const connected = (Object.entries(u.connections) as [ConnectionKey, boolean][])
      .filter(([, on]) => on).map(([k]) => k).join("; ");
    const row = [
      u.username ?? u.display_name ?? "",
      u.email, location,
      u.archetype ?? "",
      String(u.record_count), String(u.lists_created),
      String(u.playlists_generated), String(u.digs_count),
      csvAmount(u.subscription_spend), csvAmount(u.donation_total),
      connected, u.discogs_username ?? "",
      isSupporterTier(u.subscription_tier) ? "Supporter" : "Free",
      u.created_at, u.last_active_at ?? u.last_sign_in_at ?? "",
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

function countryFlag(country: string): string {
  if (country.length !== 2 || !/^[A-Za-z]{2}$/.test(country)) return "";
  const OFFSET = 127397;
  return String.fromCodePoint(
    country.toUpperCase().charCodeAt(0) + OFFSET,
    country.toUpperCase().charCodeAt(1) + OFFSET,
  );
}

const selectSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "11px", color: INK,
  background: "transparent", border: `1px solid ${RULE}`,
  padding: "6px 8px", outline: "none", cursor: "pointer",
};

const btnSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
  textTransform: "uppercase", color: INK,
  background: "transparent", border: `1px solid ${RULE}`,
  padding: "7px 12px", cursor: "pointer",
};

export default function AdminClient({
  users: initialUsers,
  total,
  supporters,
  donors,
  totalRecords,
  featurePopularity,
  countryData,
}: {
  users: AdminUser[];
  total: number;
  supporters: number;
  donors: number;
  totalRecords: number;
  featurePopularity: [string, number][];
  countryData: { country: string; count: number }[];
}) {
  const [activeTab, setActiveTab]         = useState<AdminTab>("users");
  const [allUsers, setAllUsers]           = useState<AdminUser[]>(initialUsers);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [query, setQuery]                 = useState("");
  const [tierFilter, setTierFilter]       = useState<"all" | "free" | "supporter">("all");
  const [statusFilter, setStatusFilter]   = useState<"all" | "active" | "blocked">("all");
  const [connFilter, setConnFilter]       = useState<"all" | ConnectionKey>("all");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [sortKey, setSortKey]             = useState<SortKey | null>(() => readStoredSort().key);
  const [sortDir, setSortDir]             = useState<"asc" | "desc">(() => readStoredSort().dir);
  const [countrySortKey, setCountrySortKey] = useState<"country" | "count">("count");
  const [countrySortDir, setCountrySortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key: sortKey, dir: sortDir })); }
    catch { /* ignore */ }
  }, [sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleCountrySort(key: "country" | "count") {
    if (key === countrySortKey) setCountrySortDir(d => d === "asc" ? "desc" : "asc");
    else { setCountrySortKey(key); setCountrySortDir(key === "count" ? "desc" : "asc"); }
  }

  async function loadMore() {
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/users?offset=${allUsers.length}`);
      if (!res.ok) throw new Error(await res.text());
      const { users: next } = await res.json() as { users: AdminUser[] };
      setAllUsers(prev => {
        const seen = new Set(prev.map(u => u.id));
        return [...prev, ...next.filter(u => !seen.has(u.id))];
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load more users");
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadAll() {
    setLoadingMore(true);
    setLoadError(null);
    try {
      const batchSize  = 100;
      const remaining  = total - allUsers.length;
      if (remaining <= 0) return;
      const baseOffset = allUsers.length;
      const batchCount = Math.ceil(remaining / batchSize);
      const results = await Promise.all(
        Array.from({ length: batchCount }, (_, i) =>
          fetch(`/api/admin/users?offset=${baseOffset + i * batchSize}&limit=${batchSize}`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
            .then(d => (d as { users: AdminUser[] }).users)
        )
      );
      setAllUsers(prev => {
        const seen   = new Set(prev.map(u => u.id));
        const merged = [...prev];
        for (const batch of results) {
          for (const u of batch) {
            if (!seen.has(u.id)) { merged.push(u); seen.add(u.id); }
          }
        }
        return merged;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load all users");
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = allUsers.length < total;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers.filter(u => {
      if (q && !(u.username ?? "").toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (tierFilter !== "all" && isSupporterTier(u.subscription_tier) !== (tierFilter === "supporter")) return false;
      if (statusFilter !== "all" && isBlocked(u.banned_until) !== (statusFilter === "blocked")) return false;
      if (connFilter !== "all" && !u.connections[connFilter]) return false;
      return true;
    });
  }, [allUsers, query, tierFilter, statusFilter, connFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const sortedCountries = useMemo(() => {
    const dir = countrySortDir === "asc" ? 1 : -1;
    return [...countryData].sort((a, b) =>
      countrySortKey === "country"
        ? a.country.localeCompare(b.country) * dir
        : (a.count - b.count) * dir
    );
  }, [countryData, countrySortKey, countrySortDir]);

  const maxCountryCount = countryData[0]?.count ?? 1;
  const maxFeatureCount = featurePopularity[0]?.[1] ?? 1;

  const columns = useMemo(
    () => ALL_COLUMNS.filter(c => showAllColumns || !c.optional),
    [showAllColumns]
  );

  const thSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
    textTransform: "uppercase", color: ORANGE,
    textAlign: "left", padding: "0 16px 12px",
    borderBottom: `1px solid ${RULE}`,
    whiteSpace: "nowrap", userSelect: "none",
  };

  const supporterPct = total > 0 ? Math.round(supporters / total * 100) : 0;
  const recordsLabel = totalRecords >= 1e6
    ? `${(totalRecords / 1e6).toFixed(1)}m`
    : totalRecords >= 1000 ? `${Math.round(totalRecords / 1000)}k`
    : totalRecords.toLocaleString();

  const stats = [
    { label: "Users",      value: total.toLocaleString() },
    { label: "Supporters", value: `${supporters.toLocaleString()} · ${supporterPct}%` },
    { label: "Free",       value: (total - supporters).toLocaleString() },
    { label: "Records",    value: recordsLabel },
    { label: "Donors",     value: donors.toLocaleString() },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <style>{`
        .ra-header  { padding: 20px 48px; }
        .ra-stat    { flex: 1; padding: 14px 20px; }
        .ra-tabs    { padding: 0 40px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .ra-content { padding: 28px 40px; }
        .ra-controls { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
        .ra-filters  { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        @media (max-width: 640px) {
          .ra-header  { padding: 14px 16px; }
          .ra-stats   { flex-wrap: wrap; }
          .ra-stat    { flex: 0 0 50%; padding: 12px 14px; border-top: 1px solid ${RULE}; }
          .ra-stat:nth-child(odd)  { border-left: none !important; }
          .ra-stat:nth-child(even) { border-left: 1px solid ${RULE} !important; }
          .ra-stat:nth-child(1), .ra-stat:nth-child(2) { border-top: none; }
          .ra-tabs    { padding: 0 16px; }
          .ra-content { padding: 16px; }
          .ra-controls { flex-direction: column; align-items: flex-start; }
          .ra-filters  { width: 100%; }
        .ra-feat-label { width: 140px; }
        @media (max-width: 480px) {
          .ra-feat-label { width: 90px; font-size: 10px; }
        }
        }
      `}</style>

      {/* Header */}
      <header className="ra-header" style={{
        borderBottom: `1px solid ${RULE}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: ORANGE, lineHeight: 1 }}>
          rekōdo
        </span>
        <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
          Admin
        </span>
      </header>

      {/* Compact stats strip */}
      <div className="ra-stats" style={{ borderBottom: `1px solid ${RULE}`, display: "flex" }}>
        {stats.map(({ label, value }, i) => (
          <div key={label} className="ra-stat" style={{ borderLeft: i > 0 ? `1px solid ${RULE}` : "none" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: "0 0 5px" }}>
              {label}
            </p>
            <p style={{ fontFamily: SERIF, fontSize: "22px", color: INK, margin: 0, lineHeight: 1 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="ra-tabs" style={{ borderBottom: `1px solid ${RULE}`, display: "flex" }}>
        {(["users", "countries", "features"] as AdminTab[]).map(tab => {
          const labels: Record<AdminTab, string> = { users: "Users", countries: "Countries", features: "Features" };
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
                textTransform: "uppercase", color: active ? INK : MUTED,
                background: "none", border: "none",
                borderBottom: active ? `2px solid ${INK}` : "2px solid transparent",
                padding: "13px 0", marginRight: "28px", cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Users tab ── */}
      {activeTab === "users" && (
        <div className="ra-content">
          <div className="ra-controls">
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE }}>
                {allUsers.length < total
                  ? `${allUsers.length.toLocaleString()} of ${total.toLocaleString()} loaded`
                  : `${total.toLocaleString()} users`}
              </span>
              {allUsers.length < total && !loadingMore && (
                <span style={{ fontFamily: MONO, fontSize: "9px", color: MUTED }}>
                  — sort applies to loaded rows only
                </span>
              )}
            </div>
            <div className="ra-filters">
              <input
                type="text"
                placeholder="Search username or email…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  fontFamily: MONO, fontSize: "11px", color: INK,
                  background: "transparent", border: `1px solid ${RULE}`,
                  padding: "6px 12px", outline: "none",
                  width: "clamp(160px, 100%, 220px)",
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
              <button
                onClick={() => setShowAllColumns(s => !s)}
                style={{ ...btnSt, color: showAllColumns ? ORANGE : INK, borderColor: showAllColumns ? ORANGE : RULE }}
              >
                {showAllColumns ? "Hide extras" : "Show all columns"}
              </button>
              <button onClick={() => downloadCSV(sorted)} style={btnSt}>
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
                      style={{ ...thSt, cursor: key ? "pointer" : "default" }}
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
              <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "24px 0" }}>
                No users match the current filters.
              </p>
            )}

            {hasMore && (
              <div style={{ padding: "20px 0", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{ ...btnSt, opacity: loadingMore ? 0.5 : 1, cursor: loadingMore ? "default" : "pointer" }}
                >
                  {loadingMore ? "Loading…" : "Load 20 more"}
                </button>
                <button
                  onClick={loadAll}
                  disabled={loadingMore}
                  style={{ ...btnSt, color: ORANGE, borderColor: ORANGE, opacity: loadingMore ? 0.5 : 1, cursor: loadingMore ? "default" : "pointer" }}
                >
                  {loadingMore ? "Loading…" : `Load all (${(total - allUsers.length).toLocaleString()} remaining)`}
                </button>
                {loadError && (
                  <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc2200", margin: 0 }}>
                    {loadError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Countries tab ── */}
      {activeTab === "countries" && (
        <div className="ra-content">
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, marginBottom: "20px", margin: "0 0 20px" }}>
            {countryData.length} countries · {total.toLocaleString()} users
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", maxWidth: "680px", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    onClick={() => handleCountrySort("country")}
                    style={{ ...thSt, cursor: "pointer", paddingLeft: 0 }}
                  >
                    Country
                    <span style={{ marginLeft: "4px", color: countrySortKey === "country" ? ORANGE : RULE }}>
                      {countrySortKey === "country" ? (countrySortDir === "asc" ? "▲" : "▼") : "▲"}
                    </span>
                  </th>
                  <th
                    onClick={() => handleCountrySort("count")}
                    style={{ ...thSt, cursor: "pointer", textAlign: "right" }}
                  >
                    Users
                    <span style={{ marginLeft: "4px", color: countrySortKey === "count" ? ORANGE : RULE }}>
                      {countrySortKey === "count" ? (countrySortDir === "asc" ? "▲" : "▼") : "▼"}
                    </span>
                  </th>
                  <th style={{ ...thSt, cursor: "default", width: "200px" }}></th>
                  <th style={{ ...thSt, cursor: "default", textAlign: "right", paddingRight: 0 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {sortedCountries.map(({ country, count }) => {
                  const flag = countryFlag(country);
                  const pct  = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <tr key={country} style={{ borderBottom: `1px solid ${RULE}` }}>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "10px 16px 10px 0", whiteSpace: "nowrap" }}>
                        {flag && <span style={{ marginRight: "8px" }}>{flag}</span>}
                        {country}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {count.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 16px", width: "200px" }}>
                        <div style={{ background: "#f0f0ea", height: "6px" }}>
                          <div style={{ width: `${(count / maxCountryCount) * 100}%`, height: "100%", background: ORANGE }} />
                        </div>
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, padding: "10px 0 10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Features tab ── */}
      {activeTab === "features" && (
        <div className="ra-content">
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px" }}>
            Feature popularity · recent page views
          </p>
          {featurePopularity.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED }}>
              No page views tracked yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "560px" }}>
              {featurePopularity.map(([section, count]) => (
                <div key={section} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span className="ra-feat-label" style={{ fontFamily: MONO, fontSize: "11px", color: INK, flexShrink: 0 }}>
                    {section}
                  </span>
                  <div style={{ flex: 1, background: "#f0f0ea", height: "8px" }}>
                    <div style={{ width: `${(count / maxFeatureCount) * 100}%`, height: "100%", background: ORANGE }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, width: "48px", textAlign: "right", flexShrink: 0 }}>
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
