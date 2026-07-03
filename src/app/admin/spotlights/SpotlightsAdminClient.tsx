"use client";

import { useState } from "react";
import { createSpotlight, updateSpotlight, deleteSpotlight, type SpotlightPayload } from "./actions";
import type { Spotlight } from "@/lib/spotlights/types";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0d0d0d";

const EMPTY: SpotlightPayload = {
  type: "artist",
  month: "",
  status: "draft",
  name: "",
  discogs_id: "",
  subtitle: "",
  meta: "{}",
  bio: "[]",
  releases: "[]",
  collector_notes: "[]",
  neighbors: "[]",
  rekoodos_pick: "",
};

const META_PLACEHOLDERS: Record<string, string> = {
  artist: `{"label_affiliation": "Sacred Bones Records", "location": "Oakland, CA", "active_period": "2020–present"}`,
  label:  `{"founded": "2001", "location": "Seattle, WA", "website": "lightintheattic.net"}`,
};

const RELEASES_PLACEHOLDER = `[{"year": "2026", "title": "Album Title", "label": "Label Name", "note": "Description.", "badge": null}]`;
const NOTES_PLACEHOLDER    = `[{"title": "Note title", "body": "Note body."}]`;
const NEIGHBORS_PLACEHOLDER = `[{"tag": "Sonic neighbour", "artist": "Artist Name", "album": "Album (Year)", "reason": "Why."}]`;
const BIO_PLACEHOLDER      = `["First paragraph.", "Second paragraph."]`;

function statusBadge(status: string) {
  const colors: Record<string, string> = { active: "#22c55e", archived: "#aaaaaa", draft: "#f59e0b" };
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
      color: colors[status] ?? INK, border: `1px solid ${colors[status] ?? RULE}`,
      padding: "2px 6px",
    }}>
      {status}
    </span>
  );
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

interface FormProps {
  initial?: Spotlight;
  onDone: () => void;
}

function SpotlightForm({ initial, onDone }: FormProps) {
  const [form, setForm] = useState<SpotlightPayload>(
    initial
      ? {
          type:            initial.type,
          month:           initial.month,
          status:          initial.status,
          name:            initial.name,
          discogs_id:      initial.discogs_id,
          subtitle:        initial.subtitle,
          meta:            JSON.stringify(initial.meta, null, 2),
          bio:             JSON.stringify(initial.bio, null, 2),
          releases:        JSON.stringify(initial.releases, null, 2),
          collector_notes: JSON.stringify(initial.collector_notes, null, 2),
          neighbors:       JSON.stringify(initial.neighbors, null, 2),
          rekoodos_pick:   initial.rekoodos_pick ?? "",
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function set(key: keyof SpotlightPayload, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = initial
      ? await updateSpotlight(initial.id, form)
      : await createSpotlight(form);
    setSaving(false);
    if (!result.success) { setError(result.error ?? "Unknown error"); return; }
    onDone();
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 11, width: "100%", boxSizing: "border-box",
    border: `1px solid ${RULE}`, padding: "6px 8px", background: "#fff", color: INK,
  };
  const textareaStyle: React.CSSProperties = {
    ...inputStyle, height: 120, resize: "vertical", fontFamily: "monospace",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#888", display: "block", marginBottom: 4,
  };
  const rowStyle: React.CSSProperties = { marginBottom: 16 };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} style={inputStyle} required>
            <option value="artist">Artist</option>
            <option value="label">Label</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Month (YYYY-MM)</label>
          <input value={form.month} onChange={e => set("month", e.target.value)} style={inputStyle} placeholder="2026-08" required />
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Discogs ID</label>
          <input value={form.discogs_id} onChange={e => set("discogs_id", e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Rekōdo&apos;s Pick (title of picked release, or blank)</label>
          <input value={form.rekoodos_pick} onChange={e => set("rekoodos_pick", e.target.value)} style={inputStyle} placeholder="Album Title" />
        </div>
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Subtitle (header tagline)</label>
        <textarea value={form.subtitle} onChange={e => set("subtitle", e.target.value)} style={{ ...textareaStyle, height: 60 }} required />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Meta (JSON)</label>
        <textarea
          value={form.meta}
          onChange={e => set("meta", e.target.value)}
          style={textareaStyle}
          placeholder={META_PLACEHOLDERS[form.type]}
          required
        />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Bio paragraphs (JSON string[])</label>
        <textarea value={form.bio} onChange={e => set("bio", e.target.value)} style={textareaStyle} placeholder={BIO_PLACEHOLDER} required />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Releases (JSON — use &quot;label&quot; for artist, &quot;artist&quot; for label spotlights)</label>
        <textarea value={form.releases} onChange={e => set("releases", e.target.value)} style={{ ...textareaStyle, height: 160 }} placeholder={RELEASES_PLACEHOLDER} required />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Collector Notes (JSON)</label>
        <textarea value={form.collector_notes} onChange={e => set("collector_notes", e.target.value)} style={textareaStyle} placeholder={NOTES_PLACEHOLDER} required />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Neighbors (JSON)</label>
        <textarea value={form.neighbors} onChange={e => set("neighbors", e.target.value)} style={textareaStyle} placeholder={NEIGHBORS_PLACEHOLDER} required />
      </div>

      {error && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: "#ef4444", margin: "0 0 12px" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            background: INK, color: "#fff", border: "none", cursor: saving ? "wait" : "pointer",
            padding: "8px 20px", opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : initial ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onDone}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            background: "none", color: INK, border: `1px solid ${RULE}`, cursor: "pointer",
            padding: "8px 20px",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface Props {
  spotlights: Spotlight[];
}

export default function SpotlightsAdminClient({ spotlights: initial }: Props) {
  const [spotlights, setSpotlights] = useState(initial);
  const [editing, setEditing]       = useState<Spotlight | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this spotlight?")) return;
    setDeletingId(id);
    const result = await deleteSpotlight(id);
    setDeletingId(null);
    if (result.success) setSpotlights(s => s.filter(x => x.id !== id));
    else alert(result.error);
  }

  function handleDone() {
    setEditing(null);
    window.location.reload();
  }

  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: MONO, fontSize: 12, fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
          Spotlights
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing("new")}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
              background: ORANGE, color: "#fff", border: "none", cursor: "pointer", padding: "7px 16px",
            }}
          >
            + New Spotlight
          </button>
        )}
      </div>

      {editing === "new" && (
        <div style={{ marginBottom: 40, paddingBottom: 40, borderBottom: `1px solid ${RULE}` }}>
          <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px" }}>
            New Spotlight
          </p>
          <SpotlightForm onDone={handleDone} />
        </div>
      )}

      {editing && editing !== "new" && (
        <div style={{ marginBottom: 40, paddingBottom: 40, borderBottom: `1px solid ${RULE}` }}>
          <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px" }}>
            Editing — {editing.name}
          </p>
          <SpotlightForm initial={editing} onDone={handleDone} />
        </div>
      )}

      {spotlights.length === 0 ? (
        <p style={{ fontSize: 11, color: "#aaa" }}>No spotlights yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${RULE}` }}>
              {["Month", "Type", "Name", "Status", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaa", fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spotlights.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${RULE}` }}>
                <td style={{ padding: "10px 8px", color: INK }}>{formatMonth(s.month)}</td>
                <td style={{ padding: "10px 8px", color: "#888", textTransform: "capitalize" }}>{s.type}</td>
                <td style={{ padding: "10px 8px", color: INK }}>{s.name}</td>
                <td style={{ padding: "10px 8px" }}>{statusBadge(s.status)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => setEditing(s)}
                    style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", background: "none", border: `1px solid ${RULE}`, cursor: "pointer", padding: "4px 10px", color: INK, marginRight: 6 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", background: "none", border: "1px solid #f9a8a8", cursor: "pointer", padding: "4px 10px", color: "#ef4444", opacity: deletingId === s.id ? 0.5 : 1 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
