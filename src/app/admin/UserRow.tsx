"use client";

import { useState, useTransition } from "react";
import { updateUserAdmin, updateUserIdentity, blockUser, setTestAccount, deleteUserAdmin } from "./actions";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";
const INK    = "#0d0d0d";
const RED    = "#cc2200";

export interface AdminUser {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string;
  subscription_tier: string | null;
  role: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_synced_at: string | null;
  last_active_at: string | null;
  banned_until: string | null;
  record_count: number;
  city: string | null;
  country: string | null;
  is_donor: boolean;
  is_test: boolean;
  archetype: string | null;
  discogs_username: string | null;
  subscription_spend: { cents: number; currency: string } | null;
  donation_total: { cents: number; currency: string } | null;
  lists_created: number;
  playlists_generated: number;
  digs_count: number;
  top_sections: { section: string; count: number }[];
  connections: {
    collection: boolean;
    wantlist: boolean;
    discogs: boolean;
    spotify: boolean;
    bandcamp: boolean;
  };
}

function formatAmount(cents: number, currency: string): string {
  const sym = currency === "gbp" ? "£" : currency === "eur" ? "€" : currency === "aud" ? "A$" : "$";
  return `${sym}${(cents / 100).toFixed(2)}`;
}

function formatLocation(city: string | null, country: string | null): string {
  if (city && country) return `${city}, ${country}`;
  return city ?? country ?? "—";
}

function ConnectionBadges({ connections }: { connections: AdminUser["connections"] }) {
  const items: { key: keyof AdminUser["connections"]; label: string; initial: string }[] = [
    { key: "discogs",    label: "Discogs",    initial: "D" },
    { key: "collection", label: "Collection", initial: "C" },
    { key: "wantlist",   label: "Wantlist",   initial: "W" },
    { key: "spotify",    label: "Spotify",    initial: "S" },
    { key: "bandcamp",   label: "Bandcamp",   initial: "B" },
  ];
  return (
    <div style={{ display: "flex", gap: "3px" }}>
      {items.map(({ key, label, initial }) => {
        const on = connections[key];
        return (
          <span
            key={key}
            title={`${label}: ${on ? "connected" : "not connected"}`}
            style={{
              fontFamily: MONO, fontSize: "9px", fontWeight: 700,
              width: "16px", height: "16px", lineHeight: "16px",
              textAlign: "center", borderRadius: "2px",
              border: `1px solid ${on ? ORANGE : RULE}`,
              color: on ? ORANGE : MUTED,
              background: "transparent",
            }}
          >
            {initial}
          </span>
        );
      })}
    </div>
  );
}

function TierPill({ tier }: { tier: string | null }) {
  const t = tier ?? "free";
  const isSupporter = t === "premium" || t === "plus" || t === "supporter";
  const style: React.CSSProperties = isSupporter
    ? { background: ORANGE, color: "#fff" }
    : { background: "#f0f0f0", color: MUTED };
  return (
    <span style={{
      ...style,
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
      textTransform: "uppercase", padding: "3px 8px",
      display: "inline-block",
    }}>
      {isSupporter ? "Supporter" : "Free"}
    </span>
  );
}

export function isBlocked(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function UserRow({ user, showFinancial, columnCount }: { user: AdminUser; showFinancial: boolean; columnCount: number }) {
  const [open,        setOpen]       = useState(false);
  const initialTier = ["plus", "premium", "supporter"].includes(user.subscription_tier ?? "") ? "supporter" : "free";
  const [tier,        setTier]       = useState(initialTier);
  const [role,        setRole]       = useState(user.role ?? "user");
  const [newUsername, setNewUsername] = useState(user.username ?? "");
  const [newEmail,    setNewEmail]   = useState(user.email ?? "");
  const [error,       setError]      = useState<string | null>(null);
  const [savePending, startSave]     = useTransition();
  const [idPending,   startId]       = useTransition();
  const [blockPend,   startBlock]    = useTransition();
  const [testPend,    startTest]     = useTransition();
  const [deletePend,  startDelete]   = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isTest,      setIsTestState] = useState(user.is_test);

  const blocked = isBlocked(user.banned_until);

  function handleCancel() {
    setTier(initialTier);
    setRole(user.role ?? "user");
    setNewUsername(user.username ?? "");
    setNewEmail(user.email ?? "");
    setError(null);
    setOpen(false);
  }

  function handleSave() {
    setError(null);
    startSave(async () => {
      const result = await updateUserAdmin(user.id, tier, role);
      if (result.success) setOpen(false);
      else setError(result.error ?? "Save failed");
    });
  }

  function handleSaveIdentity() {
    setError(null);
    startId(async () => {
      const result = await updateUserIdentity(user.id, newUsername, newEmail);
      if (!result.success) setError(result.error ?? "Save failed");
    });
  }

  function handleBlock() {
    setError(null);
    startBlock(async () => {
      const result = await blockUser(user.id, !blocked);
      if (!result.success) setError(result.error ?? "Failed");
    });
  }

  function handleToggleTest() {
    setError(null);
    const next = !isTest;
    startTest(async () => {
      const result = await setTestAccount(user.id, next);
      if (result.success) setIsTestState(next);
      else setError(result.error ?? "Failed");
    });
  }

  const cellSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "11px", color: INK,
    padding: "12px 16px", borderBottom: `1px solid ${RULE}`,
    verticalAlign: "middle",
  };

  const selectSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "11px", color: INK,
    background: "transparent", border: `1px solid ${RULE}`,
    padding: "4px 8px", cursor: "pointer", outline: "none",
  };

  const inputSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "11px", color: INK,
    background: "transparent", border: `1px solid ${RULE}`,
    padding: "4px 8px", outline: "none", width: "180px",
  };

  return (
    <>
      <tr style={{ opacity: blocked ? 0.5 : 1 }}>
        {/* Username + profile link */}
        <td style={{ ...cellSt, fontFamily: "var(--font-editorial)", fontSize: "14px" }}>
          {user.username ? (
            <a
              href={`/@${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: INK, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = ORANGE)}
              onMouseLeave={e => (e.currentTarget.style.color = INK)}
            >
              {user.username}
            </a>
          ) : user.display_name ? (
            <span style={{ color: MUTED }}>{user.display_name}</span>
          ) : (
            <span style={{ color: MUTED, fontFamily: MONO, fontSize: "11px" }}>—</span>
          )}
          {user.role === "admin" && (
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", color: ORANGE, marginLeft: "8px", textTransform: "uppercase" }}>
              admin
            </span>
          )}
          {user.is_donor && (
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", color: ORANGE, marginLeft: "8px", textTransform: "uppercase" }}>
              donor
            </span>
          )}
          {isTest && (
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", color: MUTED, marginLeft: "8px", textTransform: "uppercase" }}>
              test
            </span>
          )}
        </td>

        <td style={{ ...cellSt, color: MUTED }}>{user.email || "—"}</td>

        <td style={{ ...cellSt, color: MUTED }}>{formatLocation(user.city, user.country)}</td>

        <td style={{ ...cellSt, color: user.archetype ? INK : MUTED }}>{user.archetype ?? "—"}</td>

        <td style={{ ...cellSt, color: MUTED, textAlign: "right" as const }}>
          {user.record_count > 0 ? user.record_count.toLocaleString() : "—"}
        </td>

        <td style={{ ...cellSt, color: user.lists_created > 0 ? INK : MUTED, textAlign: "right" as const }}>
          {user.lists_created > 0 ? user.lists_created.toLocaleString() : "—"}
        </td>

        <td style={{ ...cellSt, color: user.playlists_generated > 0 ? INK : MUTED, textAlign: "right" as const }}>
          {user.playlists_generated > 0 ? user.playlists_generated.toLocaleString() : "—"}
        </td>

        <td style={{ ...cellSt, color: user.digs_count > 0 ? INK : MUTED, textAlign: "right" as const }}>
          {user.digs_count > 0 ? user.digs_count.toLocaleString() : "—"}
        </td>

        {/* Subscription spend / Donated / Discogs username — hidden by default behind "show all columns" */}
        {showFinancial && (
          <td style={{ ...cellSt, color: user.subscription_spend ? INK : MUTED, textAlign: "right" as const }}>
            {user.subscription_spend
              ? formatAmount(user.subscription_spend.cents, user.subscription_spend.currency)
              : "—"}
          </td>
        )}

        {showFinancial && (
          <td style={{ ...cellSt, color: user.donation_total ? INK : MUTED, textAlign: "right" as const }}>
            {user.donation_total
              ? formatAmount(user.donation_total.cents, user.donation_total.currency)
              : "—"}
          </td>
        )}

        <td style={cellSt}>
          <ConnectionBadges connections={user.connections} />
        </td>

        {showFinancial && (
          <td style={{ ...cellSt, color: user.discogs_username ? INK : MUTED }}>
            {user.discogs_username ?? "—"}
          </td>
        )}

        <td style={cellSt}>
          <TierPill tier={user.subscription_tier} />
        </td>

        <td style={{ ...cellSt, color: MUTED, whiteSpace: "nowrap" as const }}>
          {formatDate(user.created_at)}
        </td>

        <td style={{ ...cellSt, color: MUTED, whiteSpace: "nowrap" as const }}>
          {formatDate(user.last_active_at ?? user.last_sign_in_at)}
        </td>

        <td style={cellSt}>
          {blocked ? (
            <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: RED }}>
              Blocked
            </span>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: MUTED }}>
              Active
            </span>
          )}
        </td>

        <td style={cellSt}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: open ? MUTED : ORANGE,
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={columnCount} style={{ padding: "16px 16px 20px", borderBottom: `1px solid ${RULE}`, background: "#fafaf8" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Row 1: tier + role + save */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "24px", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Subscription tier
                  </label>
                  <select value={tier} onChange={e => setTier(e.target.value)} style={selectSt}>
                    <option value="free">Free</option>
                    <option value="supporter">Supporter</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Role
                  </label>
                  <select value={role} onChange={e => setRole(e.target.value)} style={selectSt}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    onClick={handleSave}
                    disabled={savePending}
                    style={{
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                      textTransform: "uppercase", color: "#fff",
                      background: savePending ? "rgba(204,85,0,0.5)" : ORANGE,
                      border: "none", cursor: savePending ? "default" : "pointer",
                      padding: "8px 16px",
                    }}
                  >
                    {savePending ? "Saving…" : "Save tier"}
                  </button>
                  <button
                    onClick={handleCancel}
                    style={{
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                      textTransform: "uppercase", color: MUTED,
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Block / unblock */}
                <div style={{ marginLeft: "auto" }}>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Account
                  </label>
                  <button
                    onClick={handleBlock}
                    disabled={blockPend}
                    style={{
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: blocked ? ORANGE : "#fff",
                      background: blocked ? "none" : RED,
                      border: blocked ? `1px solid ${ORANGE}` : "none",
                      cursor: blockPend ? "default" : "pointer",
                      opacity: blockPend ? 0.5 : 1,
                      padding: "8px 16px",
                    }}
                  >
                    {blockPend ? "…" : blocked ? "Unblock" : "Block"}
                  </button>
                </div>

                {/* Delete account */}
                <div>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Delete
                  </label>
                  {confirmDelete ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        onClick={() => {
                          startDelete(async () => {
                            const result = await deleteUserAdmin(user.id);
                            if (!result.success) {
                              setError(result.error ?? "Delete failed");
                              setConfirmDelete(false);
                            }
                          });
                        }}
                        disabled={deletePend}
                        style={{
                          fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                          textTransform: "uppercase", color: "#fff",
                          background: deletePend ? "rgba(204,34,0,0.5)" : RED,
                          border: "none", cursor: deletePend ? "default" : "pointer",
                          padding: "8px 16px",
                        }}
                      >
                        {deletePend ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      style={{
                        fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                        textTransform: "uppercase", color: RED,
                        background: "none", border: `1px solid ${RED}`,
                        cursor: "pointer", padding: "8px 16px",
                      }}
                    >
                      Delete user
                    </button>
                  )}
                </div>

                {/* Test account flag — excluded from Community discovery (All Collectors, Top Matches) */}
                <div>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Test account
                  </label>
                  <button
                    onClick={handleToggleTest}
                    disabled={testPend}
                    style={{
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: isTest ? "#fff" : INK,
                      background: isTest ? ORANGE : "none",
                      border: isTest ? "none" : `1px solid ${RULE}`,
                      cursor: testPend ? "default" : "pointer",
                      opacity: testPend ? 0.5 : 1,
                      padding: "8px 16px",
                    }}
                  >
                    {testPend ? "…" : isTest ? "Unmark" : "Mark as test"}
                  </button>
                </div>
              </div>

              {/* Row 2: username + email edit */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "24px", flexWrap: "wrap", paddingTop: "4px", borderTop: `1px solid ${RULE}` }}>
                <div>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    maxLength={30}
                    style={inputSt}
                  />
                </div>

                <div>
                  <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    style={inputSt}
                  />
                </div>

                <button
                  onClick={handleSaveIdentity}
                  disabled={idPending}
                  style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "#fff",
                    background: idPending ? "rgba(204,85,0,0.5)" : ORANGE,
                    border: "none", cursor: idPending ? "default" : "pointer",
                    padding: "8px 16px",
                  }}
                >
                  {idPending ? "Saving…" : "Save identity"}
                </button>
              </div>

              {/* Row 3: feature usage */}
              <div style={{ paddingTop: "4px", borderTop: `1px solid ${RULE}` }}>
                <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "8px" }}>
                  Top sections used
                </label>
                {user.top_sections.length === 0 ? (
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>No activity tracked yet</span>
                ) : (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {user.top_sections.map(({ section, count }) => (
                      <span
                        key={section}
                        style={{
                          fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em",
                          padding: "4px 8px", border: `1px solid ${RULE}`, color: INK,
                        }}
                      >
                        {section} ×{count}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p style={{ fontFamily: MONO, fontSize: "10px", color: RED, margin: 0 }}>
                  {error}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
