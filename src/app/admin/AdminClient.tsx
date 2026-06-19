"use client";

import { useState } from "react";
import UserRow, { type AdminUser } from "./UserRow";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const INK    = "#0d0d0d";

export default function AdminClient({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? users.filter(u =>
        (u.username ?? "").toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
      )
    : users;

  return (
    <div style={{ padding: "40px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
          Users
        </p>
        <input
          type="text"
          placeholder="Search username or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: "11px", color: INK,
            background: "transparent", border: `1px solid ${RULE}`,
            padding: "6px 12px", outline: "none", width: "260px",
          }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Username", "Email", "Location", "Archetype", "Collection", "Sub. spend", "Donated", "Connected", "Discogs username", "Tier", "Last active", "Status", ""].map(col => (
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
            {filtered.map(user => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: MUTED, padding: "24px 16px" }}>
            No users match &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
