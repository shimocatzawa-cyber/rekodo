"use client";

import { useState, useTransition } from "react";
import { updateUserAdmin } from "./actions";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";
const INK    = "#0d0d0d";

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  subscription_tier: string | null;
  role: string | null;
  created_at: string;
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
      textTransform: "uppercase", padding: "3px 8px", borderRadius: "2px",
      display: "inline-block",
    }}>
      {t}
    </span>
  );
}

export default function UserRow({ user }: { user: AdminUser }) {
  const [open,    setOpen]    = useState(false);
  const [tier,    setTier]    = useState(user.subscription_tier ?? "free");
  const [role,    setRole]    = useState(user.role ?? "user");
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startSave]  = useTransition();

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
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? "Save failed");
      }
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
      <tr>
        <td style={{ ...cellSt, fontFamily: "var(--font-editorial)", fontSize: "14px" }}>
          {user.username}
        </td>
        <td style={cellSt}>{user.email}</td>
        <td style={{ ...cellSt }}>
          <TierPill tier={user.subscription_tier} />
        </td>
        <td style={{ ...cellSt, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.1em", color: user.role === "admin" ? ORANGE : MUTED }}>
          {user.role ?? "user"}
        </td>
        <td style={{ ...cellSt, color: MUTED }}>
          {new Date(user.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
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
          <td colSpan={6} style={{ padding: "16px 16px 20px", borderBottom: `1px solid ${RULE}`, background: "#fafaf8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
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

              <div style={{ display: "flex", gap: "12px", alignItems: "center", paddingTop: "18px" }}>
                <button
                  onClick={handleSave}
                  disabled={pending}
                  style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "#fff",
                    background: pending ? "rgba(204,85,0,0.5)" : ORANGE,
                    border: "none", cursor: pending ? "default" : "pointer",
                    padding: "8px 16px",
                  }}
                >
                  {pending ? "Saving…" : "Save"}
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

              {error && (
                <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc2200", margin: 0 }}>
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
