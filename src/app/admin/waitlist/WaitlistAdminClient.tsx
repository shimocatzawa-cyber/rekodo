"use client";

import Link from "next/link";

const MONO = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-shippori), Georgia, serif";
const ORANGE = "#CC5500";

interface Entry {
  id: string;
  email: string;
  name: string | null;
  est_collection_size: number | null;
  created_at: string;
}

interface Props {
  entries: Entry[];
}

export default function WaitlistAdminClient({ entries }: Props) {
  function exportCSV() {
    const header = "Email,Name,Est Collection Size,Joined\n";
    const rows = entries
      .map((e) => `${csvEscape(e.email)},${csvEscape(e.name ?? "")},${csvEscape(e.est_collection_size?.toString() ?? "")},${csvEscape(new Date(e.created_at).toISOString())}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waitlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white px-8 md:px-12 py-12">
      {/* Header */}
      <div className="mb-10 flex items-end justify-between">
        <div>
          <Link
            href="/"
            style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, textDecoration: "none" }}
          >
            ō
          </Link>
          <h1
            className="mt-6"
            style={{ fontFamily: SERIF, fontSize: "32px", color: "#0d0d0d", lineHeight: 1.2 }}
          >
            Waitlist
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em", marginTop: "6px" }}>
            {entries.length} {entries.length === 1 ? "person" : "people"} on the list
          </p>
        </div>
        <button
          onClick={exportCSV}
          style={{
            fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#ffffff", background: ORANGE, border: "none", cursor: "pointer", padding: "10px 20px",
          }}
          className="hover:opacity-90 transition-opacity"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <p style={{ fontFamily: MONO, fontSize: "12px", color: "#aaaaaa" }}>No entries yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
                {["Email", "Name", "Est Collection Size", "Joined"].map((col) => (
                  <th
                    key={col}
                    style={{
                      fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "#aaaaaa", textAlign: "left", padding: "0 0 12px 0", paddingRight: "32px",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <td style={{ fontFamily: MONO, fontSize: "13px", color: "#0d0d0d", padding: "14px 32px 14px 0" }}>
                    {entry.email}
                  </td>
                  <td style={{ fontFamily: MONO, fontSize: "13px", color: entry.name ? "#0d0d0d" : "#cccccc", padding: "14px 32px 14px 0" }}>
                    {entry.name ?? "—"}
                  </td>
                  <td style={{ fontFamily: MONO, fontSize: "13px", color: entry.est_collection_size != null ? "#0d0d0d" : "#cccccc", padding: "14px 32px 14px 0" }}>
                    {entry.est_collection_size ?? "—"}
                  </td>
                  <td style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", padding: "14px 0" }}>
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function csvEscape(val: string): string {
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}
