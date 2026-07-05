"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserRow, { isBlocked, type AdminUser } from "./UserRow";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const INK    = "#0d0d0d";

type AdminTab = "users" | "countries" | "features" | "power_users" | "syncs";

type ActiveSyncJob = {
  id: string;
  userId: string;
  username: string;
  status: string;
  phase: string | null;
  progressDone: number | null;
  totalRecords: number | null;
  currentPage: number | null;
  totalPages: number | null;
  startedAt: string;
  updatedAt: string;
  errorMessage: string | null;
};

type SortKey =
  | "username" | "email" | "location" | "archetype" | "record_count"
  | "lists_created" | "playlists_generated" | "digs_count"
  | "subscription_spend" | "donation_total" | "connected" | "discogs_username"
  | "subscription_tier" | "joined" | "last_active" | "status" | "referral_source";

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
  { label: "Source",           key: "referral_source", optional: true },
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
    case "referral_source":     return (u.referral_source ?? "").toLowerCase();
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
    "Connected", "Discogs username", "Tier", "Joined", "Last active", "Status", "Source",
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
      u.referral_source ?? "",
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
  shareCardData,
  archetypeBreakdown,
  signupsPerDay,
  visitsPerDay,
  powerUsers,
  starSignData,
}: {
  users: AdminUser[];
  total: number;
  supporters: number;
  donors: number;
  totalRecords: number;
  featurePopularity: [string, number][];
  countryData: { country: string; count: number }[];
  shareCardData: { cardType: string; download: number; copy: number; total: number }[];
  archetypeBreakdown: [string, number][];
  signupsPerDay: { date: string; count: number }[];
  visitsPerDay: { date: string; count: number }[];
  powerUsers: { user_id: string; username: string | null; display_name: string | null; subscription_tier: string | null; created_at: string; unique_days: number }[];
  starSignData: [string, number][];
}) {
  const [activeTab, setActiveTab]             = useState<AdminTab>("users");
  const [activeSyncs,    setActiveSyncs]    = useState<ActiveSyncJob[]>([]);
  const [syncsLoading,   setSyncsLoading]   = useState(false);
  const [syncsError,     setSyncsError]     = useState<string | null>(null);
  const [backfillStatus, setBackfillStatus]   = useState<string | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [waitlistStatus, setWaitlistStatus]   = useState<string | null>(null);
  const [waitlistRunning, setWaitlistRunning] = useState(false);
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

  // Load active syncs on tab open; manual refresh via button
  const fetchActiveSyncs = useCallback(async () => {
    setSyncsLoading(true);
    try {
      const res = await fetch("/api/admin/active-syncs");
      const data = await res.json() as { jobs?: ActiveSyncJob[]; error?: string };
      if (data.error) setSyncsError(data.error);
      else { setActiveSyncs(data.jobs ?? []); setSyncsError(null); }
    } catch (e) {
      setSyncsError(String(e));
    } finally {
      setSyncsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "syncs") return;
    fetchActiveSyncs();
  }, [activeTab, fetchActiveSyncs]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function runBackfill(force = false) {
    setBackfillRunning(true);
    setBackfillStatus(force ? "Force recomputing all…" : "Starting…");
    let offset = 0;
    let totalProcessed = 0;
    try {
      while (true) {
        const res = await fetch("/api/admin/backfill-archetypes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, ...(force ? { force: true } : {}) }),
        });
        if (!res.ok) { setBackfillStatus(`Error: ${await res.text()}`); break; }
        const data = await res.json() as { processed: number; skipped: number; nextOffset: number; done: boolean; total: number; cachedTotal: number };
        totalProcessed += data.processed;
        offset = data.nextOffset;
        setBackfillStatus(`${offset} / ${data.total} profiles processed${data.done ? "" : "…"}`);
        if (data.done) break;
      }
      setBackfillStatus(`Done — ${totalProcessed} computed this run.`);
    } catch (e) {
      setBackfillStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfillRunning(false);
    }
  }

  async function sendWaitlistInvites() {
    setWaitlistRunning(true);
    setWaitlistStatus("Checking waitlist…");
    try {
      const preview = await fetch("/api/admin/waitlist-invite");
      const previewData = await preview.json() as { count?: number; error?: string };
      if (!preview.ok) { setWaitlistStatus(`Error: ${previewData.error}`); return; }
      setWaitlistStatus(`Sending to ${previewData.count ?? 0} entries…`);
      const res  = await fetch("/api/admin/waitlist-invite", { method: "POST" });
      const data = await res.json() as { sent?: number; skipped?: number; failed?: number; error?: string };
      if (!res.ok) { setWaitlistStatus(`Error: ${data.error}`); return; }
      setWaitlistStatus(`Done — ${data.sent} sent · ${data.skipped} already signed up · ${data.failed} failed`);
    } catch (e) {
      setWaitlistStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWaitlistRunning(false);
    }
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

  const maxCountryCount   = countryData[0]?.count ?? 1;
  const maxFeatureCount   = featurePopularity[0]?.[1] ?? 1;
  const maxArchetypeCount = archetypeBreakdown[0]?.[1] ?? 1;
  const maxStarSignCount  = starSignData[0]?.[1] ?? 1;

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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a
            href="/admin/spotlights"
            style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}
          >
            Spotlights
          </a>
          <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
            Admin
          </span>
        </div>
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
        {(["users", "countries", "features", "power_users", "syncs"] as AdminTab[]).map(tab => {
          const labels: Record<AdminTab, string> = { users: "Users", countries: "Countries", features: "Features", power_users: "Power Users", syncs: "Active Syncs" };
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

          {/* Signups + Visits — last 7 days (Sydney time) */}
          {(() => {
            const BAR_H = 64;
            const BAR_W = 32;
            const GAP   = 10;

            function MiniBarChart({ data, label, barColor }: { data: { date: string; count: number }[]; label: string; barColor: string }) {
              const maxCount = Math.max(...data.map(d => d.count), 1);
              const total7   = data.reduce((s, d) => s + d.count, 0);
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "20px" }}>
                    <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
                      {label}
                    </p>
                    <span style={{ fontFamily: MONO, fontSize: "9px", color: MUTED }}>{total7} total</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: `${GAP}px` }}>
                    {data.map(({ date, count }) => {
                      const barH = count === 0 ? 2 : Math.max(4, Math.round((count / maxCount) * BAR_H));
                      const dayLabel = new Date(date + "T12:00:00+10:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", timeZone: "Australia/Sydney" });
                      return (
                        <div key={date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: `${BAR_W}px` }}>
                          <span style={{ fontFamily: MONO, fontSize: "10px", color: count > 0 ? INK : MUTED }}>{count > 0 ? count : ""}</span>
                          <div style={{ width: `${BAR_W}px`, height: `${barH}px`, background: count > 0 ? barColor : RULE }} />
                          <span style={{ fontFamily: MONO, fontSize: "8px", color: MUTED, textAlign: "center", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>
                            {dayLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div style={{ marginBottom: "36px", paddingBottom: "32px", borderBottom: `1px solid ${RULE}`, display: "flex", gap: "48px", flexWrap: "wrap" }}>
                <MiniBarChart data={signupsPerDay} label="Signups — last 7 days (Sydney)" barColor={ORANGE} />
                <MiniBarChart data={visitsPerDay}  label="Unique visitors — last 7 days (Sydney)" barColor={INK} />
              </div>
            );
          })()}

          {/* Row 1: Feature Popularity + Share Card Exports */}
          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", marginBottom: "36px", paddingBottom: "36px", borderBottom: `1px solid ${RULE}` }}>
            {/* Feature Popularity */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px" }}>
                Feature popularity · unique users
              </p>
              {featurePopularity.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED }}>No page views tracked yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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

            {/* Share Card Exports */}
            <div style={{ flex: "1 1 360px", minWidth: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px" }}>
                Share card exports
              </p>
              {shareCardData.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED }}>No share cards exported yet.</p>
              ) : (
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Card", "Downloads", "Copies", "Total"].map((h, i) => (
                        <th key={h} style={{ ...thSt, paddingLeft: i === 0 ? 0 : "16px", textAlign: i === 0 ? "left" : "right", cursor: "default" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shareCardData.map(({ cardType, download, copy, total: tot }) => (
                      <tr key={cardType} style={{ borderBottom: `1px solid ${RULE}` }}>
                        <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "9px 16px 9px 0" }}>{cardType}</td>
                        <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "9px 16px", textAlign: "right" }}>{download}</td>
                        <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "9px 16px", textAlign: "right" }}>{copy}</td>
                        <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "9px 0 9px 16px", textAlign: "right", fontWeight: 600 }}>{tot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Row 2: Archetypes + Star Signs */}
          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", marginBottom: "36px" }}>
            {/* Archetypes */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
                  Users by archetype
                </p>
                <button
                  onClick={() => runBackfill(false)}
                  disabled={backfillRunning}
                  style={{ ...btnSt, opacity: backfillRunning ? 0.5 : 1, cursor: backfillRunning ? "default" : "pointer" }}
                >
                  {backfillRunning ? "Running…" : "Backfill all"}
                </button>
                <button
                  onClick={() => runBackfill(true)}
                  disabled={backfillRunning}
                  style={{ ...btnSt, opacity: backfillRunning ? 0.5 : 1, cursor: backfillRunning ? "default" : "pointer", marginLeft: "8px" }}
                >
                  Force recompute all
                </button>
                {backfillStatus && (
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>{backfillStatus}</span>
                )}
              </div>
              {archetypeBreakdown.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED }}>No archetypes computed yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {archetypeBreakdown.map(([name, count]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span className="ra-feat-label" style={{ fontFamily: MONO, fontSize: "11px", color: INK, flexShrink: 0 }}>
                        {name}
                      </span>
                      <div style={{ flex: 1, background: "#f0f0ea", height: "8px" }}>
                        <div style={{ width: `${(count / maxArchetypeCount) * 100}%`, height: "100%", background: "#555" }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, width: "48px", textAlign: "right", flexShrink: 0 }}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Star Signs */}
            <div style={{ flex: "1 1 360px", minWidth: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px" }}>
                Users by star sign
              </p>
              {starSignData.length === 0 ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED }}>No star sign data yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {starSignData.map(([sign, count]) => (
                    <div key={sign} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span className="ra-feat-label" style={{ fontFamily: MONO, fontSize: "11px", color: INK, flexShrink: 0 }}>
                        {sign}
                      </span>
                      <div style={{ flex: 1, background: "#f0f0ea", height: "8px" }}>
                        <div style={{ width: `${(count / maxStarSignCount) * 100}%`, height: "100%", background: "#8b5cf6" }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, width: "48px", textAlign: "right", flexShrink: 0 }}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Waitlist invites */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "0 0 16px", flexWrap: "wrap", borderTop: `1px solid ${RULE}`, paddingTop: "36px" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
              Waitlist invites
            </p>
            <button
              onClick={sendWaitlistInvites}
              disabled={waitlistRunning}
              style={{ ...btnSt, opacity: waitlistRunning ? 0.5 : 1, cursor: waitlistRunning ? "default" : "pointer" }}
            >
              {waitlistRunning ? "Sending…" : "Send invites"}
            </button>
            {waitlistStatus && (
              <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>{waitlistStatus}</span>
            )}
          </div>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, margin: "0 0 8px", lineHeight: 1.6 }}>
            Emails everyone on the waitlist who hasn&apos;t already created an account, with a link to /signup. Safe to run multiple times — already signed-up emails are skipped.
          </p>
        </div>
      )}

      {/* ── Power Users tab ── */}
      {activeTab === "power_users" && (
        <div className="ra-content">
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px" }}>
            Top 50 users · unique visit days (all time)
          </p>
          {powerUsers.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED }}>No visit data yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", maxWidth: "680px", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, paddingLeft: 0, width: "40px" }}>#</th>
                    <th style={{ ...thSt }}>Username</th>
                    <th style={{ ...thSt, textAlign: "right" }}>Joined</th>
                    <th style={{ ...thSt, textAlign: "right" }}>Unique days</th>
                    <th style={{ ...thSt, width: "200px" }}></th>
                    <th style={{ ...thSt, textAlign: "right" }}>% daily</th>
                    <th style={{ ...thSt, textAlign: "right", paddingRight: 0 }}>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {powerUsers.map((u, i) => {
                    const maxDays     = powerUsers[0]?.unique_days ?? 1;
                    const handle      = u.username ?? u.display_name ?? u.user_id.slice(0, 8);
                    const isSupporter = ["plus", "premium", "supporter"].includes(u.subscription_tier ?? "");
                    const joinedDate  = new Date(u.created_at);
                    const todayDay   = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
                    const joinedDay  = Date.UTC(joinedDate.getUTCFullYear(), joinedDate.getUTCMonth(), joinedDate.getUTCDate());
                    const daysSinceJoined = Math.max(1, Math.floor((todayDay - joinedDay) / 86_400_000));
                    const dailyUsePct = Math.min(100, Math.round((u.unique_days / daysSinceJoined) * 100));
                    const joinedLabel = joinedDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <tr key={u.user_id} style={{ borderBottom: `1px solid ${RULE}` }}>
                        <td style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, padding: "10px 16px 10px 0", textAlign: "right" }}>
                          {i + 1}
                        </td>
                        <td style={{ fontFamily: MONO, fontSize: "11px", padding: "10px 16px" }}>
                          <a
                            href={`/@${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: ORANGE, textDecoration: "none" }}
                          >
                            @{handle}
                          </a>
                        </td>
                        <td style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {joinedLabel}
                        </td>
                        <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {u.unique_days.toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 16px", width: "200px" }}>
                          <div style={{ background: "#f0f0ea", height: "6px" }}>
                            <div style={{ width: `${(u.unique_days / maxDays) * 100}%`, height: "100%", background: INK }} />
                          </div>
                        </td>
                        <td style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {dailyUsePct}%
                        </td>
                        <td style={{ fontFamily: MONO, fontSize: "10px", color: isSupporter ? ORANGE : MUTED, padding: "10px 0 10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {isSupporter ? "supporter" : "free"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Active Syncs tab ── */}
      {activeTab === "syncs" && (
        <div className="ra-content" style={{ padding: "28px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: 0 }}>
              Discogs Syncs — last 3 hrs
            </p>
            <button
              onClick={fetchActiveSyncs}
              disabled={syncsLoading}
              style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, background: "none", border: `1px solid ${RULE}`, borderRadius: "3px", padding: "3px 10px", cursor: syncsLoading ? "default" : "pointer", opacity: syncsLoading ? 0.5 : 1 }}
            >
              {syncsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {syncsError && (
            <p style={{ fontFamily: MONO, fontSize: "11px", color: "#c00", marginBottom: "16px" }}>{syncsError}</p>
          )}

          {!syncsLoading && activeSyncs.length === 0 && !syncsError && (
            <p style={{ fontFamily: MONO, fontSize: "13px", color: MUTED }}>
              No syncs in the last 3 hours — safe to run the backfill.
            </p>
          )}

          {activeSyncs.length > 0 && (
            <table style={{ width: "100%", maxWidth: "860px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                  {["User", "Status", "Phase", "Progress", "Pages", "Started", "Last update", "Note"].map(h => (
                    <th key={h} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, padding: "0 16px 10px 0", textAlign: "left", fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSyncs.map(job => {
                  const pct = job.totalRecords && job.progressDone != null
                    ? Math.round((job.progressDone / job.totalRecords) * 100)
                    : null;
                  const age = (s: string) => {
                    const diffMs = Date.now() - new Date(s).getTime();
                    const mins = Math.floor(diffMs / 60_000);
                    if (mins < 1) return "just now";
                    if (mins < 60) return `${mins}m ago`;
                    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
                  };
                  return (
                    <tr key={job.id} style={{ borderBottom: `1px solid ${RULE}` }}>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, padding: "10px 16px 10px 0" }}>
                        @{job.username}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: job.status === "processing" ? "#16a34a" : job.status === "failed" ? "#c00" : job.status === "completed" ? MUTED : INK, padding: "10px 16px 10px 0" }}>
                        {job.status}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "10px 16px 10px 0" }}>
                        {job.phase ?? "—"}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: INK, padding: "10px 16px 10px 0" }}>
                        {job.progressDone != null && job.totalRecords != null
                          ? `${job.progressDone.toLocaleString()} / ${job.totalRecords.toLocaleString()}${pct != null ? ` (${pct}%)` : ""}`
                          : "—"}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "10px 16px 10px 0" }}>
                        {job.currentPage != null && job.totalPages != null
                          ? `${job.currentPage} / ${job.totalPages}`
                          : "—"}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "10px 16px 10px 0" }}>
                        {age(job.startedAt)}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "10px 16px 10px 0" }}>
                        {age(job.updatedAt)}
                      </td>
                      <td style={{ fontFamily: MONO, fontSize: "11px", color: "#b45309", padding: "10px 0" }}>
                        {job.errorMessage ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
