"use client";

import { useState, useTransition } from "react";
import { updateUserAdmin, blockUser } from "./actions";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";
const INK    = "#0d0d0d";
const RED    = "#cc2200";

export interface AdminUser {
  id: string;
  username: string | null;
  email: string;
  subscription_tier: string | null;
  role: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  record_count: number;
}

function TierPill({ tier }: { tier: string | null }) {
  const t = tier ?? "free";
  const style: React.CSSProperties =
    t === "premium"
      ? { background: ORANGE, color: "#fff" }
      : t === "plus"
      ? { background: "#fde8d8", color: ORANGE }
      : { background: "#f0f0f0", color: MUTED };
  return (
    <span style={{
      ...style,
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
      textTransform: "uppercase", padding: "3px 8px",
      display: "inline-block",
    }}>
      {t}
    </span>
  );
}

function isBlocked(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function UserRow({ user }: { user: AdminUser }) {
  const [open,        setOpen]       = useState(false);
  const [tier,        setTier]       = useState(user.subscription_tier ?? "free");
  const [role,        setRole]       = useState(user.role ?? "user");
  const [error,       setError]      = useState<string | null>(null);
  const [savePending, startSave]     = useTransition();
  const [blockPend,   startBlock]    = useTransition();

  const blocked = isBlocked(user.banned_until);

  function handleCancel() {
    setTier(user.subscription_tier ?? "free");
    setRole(user.role ?? "user");
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

  function handleBlock() {
    setError(null);
    startBlock(async () => {
      const result = await blockUser(user.id, !blocked);
      if (!result.success) setError(result.error ?? "Failed");
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
          ) : (
            <span style={{ color: MUTED, fontFamily: MONO, fontSize: "11px" }}>—</span>
          )}
          {user.role === "admin" && (
            <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", color: ORANGE, marginLeft: "8px", textTransform: "uppercase" }}>
              admin
            </span>
          )}
        </td>

        <td style={{ ...cellSt, color: MUTED }}>{user.email || "—"}</td>

        <td style={{ ...cellSt, color: MUTED, textAlign: "right" as const }}>
          {user.record_count > 0 ? user.record_count.toLocaleString() : "—"}
        </td>

        <td style={cellSt}>
          <TierPill tier={user.subscription_tier} />
        </td>

        <td style={{ ...cellSt, color: MUTED, whiteSpace: "nowrap" as const }}>
          {formatDate(user.last_sign_in_at)}
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
          <td colSpan={7} style={{ padding: "16px 16px 20px", borderBottom: `1px solid ${RULE}`, background: "#fafaf8" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "24px", flexWrap: "wrap" }}>

              <div>
                <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "6px" }}>
                  Subscription tier
                </label>
                <select value={tier} onChange={e => setTier(e.target.value)} style={selectSt}>
                  <option value="free">Free</option>
                  <option value="plus">Plus</option>
                  <option value="premium">Premium</option>
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
                  {savePending ? "Saving…" : "Save"}
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

              {/* Block / unblock — separated visually */}
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

              {error && (
                <p style={{ fontFamily: MONO, fontSize: "10px", color: RED, margin: 0, width: "100%" }}>
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
