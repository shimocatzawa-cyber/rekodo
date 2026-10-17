"use client";

import { useState, useEffect } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

interface TurntablePost {
  id: string;
  published_at: string;
  artist: string;
  album: string;
  cover_url: string | null;
  body: string;
  status: "draft" | "published";
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ─── Inline new-entry form ────────────────────────────────────────────────────

interface NewEntryFormProps {
  onSaved: (post: TurntablePost) => void;
}

function NewEntryForm({ onSaved }: NewEntryFormProps) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);
  const [form, setForm] = useState({
    artist: "", album: "", cover_url: "", body: "",
    published_at: new Date().toISOString().slice(0, 10),
    status: "published" as "draft" | "published",
  });

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { post?: TurntablePost; error?: string };
      if (!res.ok || !data.post) { setErr(data.error ?? "Save failed"); return; }
      onSaved(data.post);
      setForm({ artist: "", album: "", cover_url: "", body: "", published_at: new Date().toISOString().slice(0, 10), status: "published" });
      setOpen(false);
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em",
          textTransform: "uppercase", color: ORANGE, background: "none",
          border: `1px solid ${ORANGE}`, padding: "8px 16px",
          cursor: "pointer", marginBottom: 40,
        }}
      >
        + New Entry
      </button>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontFamily: MONO, fontSize: "12px", color: INK,
    border: `1px solid ${RULE}`, padding: "9px 12px",
    outline: "none", background: "#ffffff", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: MONO, fontSize: "9px",
    letterSpacing: "0.14em", textTransform: "uppercase",
    color: "#aaaaaa", marginBottom: 6,
  };

  return (
    <div style={{ border: `1px solid ${RULE}`, padding: 28, marginBottom: 40, background: "#fafaf8" }}>
      <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, margin: "0 0 24px" }}>
        New Entry
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Artist</label>
          <input value={form.artist} onChange={e => set("artist", e.target.value)} style={inputStyle} placeholder="e.g. Mulatu Astatke" />
        </div>
        <div>
          <label style={labelStyle}>Album</label>
          <input value={form.album} onChange={e => set("album", e.target.value)} style={inputStyle} placeholder="e.g. Ethio Jazz" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Cover Image URL <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
          <input value={form.cover_url} onChange={e => set("cover_url", e.target.value)} style={inputStyle} placeholder="https://…" />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={form.published_at} onChange={e => set("published_at", e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Entry</label>
        <textarea
          value={form.body}
          onChange={e => set("body", e.target.value)}
          rows={7}
          placeholder="What are you hearing? What makes this record worth writing about?"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.75 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span
            onClick={() => set("status", form.status === "published" ? "draft" : "published")}
            style={{
              width: 32, height: 18, borderRadius: 9, position: "relative", display: "inline-block",
              background: form.status === "published" ? ORANGE : RULE, transition: "background 0.15s", cursor: "pointer",
            }}
          >
            <span style={{
              position: "absolute", top: 3, left: form.status === "published" ? 16 : 3,
              width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
            }} />
          </span>
          <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: form.status === "published" ? ORANGE : "#aaaaaa" }}>
            {form.status === "published" ? "Published" : "Draft"}
          </span>
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => { setOpen(false); setErr(null); }}
            style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "8px 16px", cursor: "pointer", color: "#888888" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.artist.trim() || !form.album.trim()}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
              background: saving || !form.artist.trim() || !form.album.trim() ? "#cccccc" : INK,
              color: "#ffffff", border: "none", padding: "8px 20px",
              cursor: saving || !form.artist.trim() || !form.album.trim() ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {err && <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: "12px 0 0" }}>{err}</p>}
    </div>
  );
}

// ─── Individual entry with inline edit/delete for admins ─────────────────────

interface TurntableEntryProps {
  post: TurntablePost;
  isFirst: boolean;
  isAdmin: boolean;
  onUpdated: (post: TurntablePost) => void;
  onDeleted: (id: string) => void;
}

function TurntableEntry({ post, isFirst, isAdmin, onUpdated, onDeleted }: TurntableEntryProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const [form, setForm] = useState({
    artist: post.artist, album: post.album,
    cover_url: post.cover_url ?? "",
    body: post.body,
    published_at: post.published_at,
    status: post.status,
  });

  const coverSrc = post.cover_url
    ? (post.cover_url.startsWith("/") ? post.cover_url : `/api/image-proxy?url=${encodeURIComponent(post.cover_url)}`)
    : null;

  function setField(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function save() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id, ...form }),
      });
      const data = await res.json() as { post?: TurntablePost; error?: string };
      if (!res.ok || !data.post) { setErr(data.error ?? "Save failed"); return; }
      onUpdated(data.post);
      setEditing(false);
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm(`Delete "${post.artist} — ${post.album}"?`)) return;
    setDeleting(true);
    try {
      await fetch("/api/turntable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id }),
      });
      onDeleted(post.id);
    } catch { setDeleting(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontFamily: MONO, fontSize: "12px", color: INK,
    border: `1px solid ${RULE}`, padding: "8px 12px",
    outline: "none", background: "#ffffff", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: MONO, fontSize: "9px",
    letterSpacing: "0.14em", textTransform: "uppercase",
    color: "#aaaaaa", marginBottom: 5,
  };

  if (editing) {
    return (
      <div style={{ padding: "40px 0", borderTop: isFirst ? "none" : `1px solid ${RULE}` }}>
        <div style={{ border: `1px solid ${RULE}`, padding: 24, background: "#fafaf8" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, margin: "0 0 20px" }}>
            Editing Entry
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Artist</label>
              <input value={form.artist} onChange={e => setField("artist", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Album</label>
              <input value={form.album} onChange={e => setField("album", e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Cover Image URL</label>
              <input value={form.cover_url} onChange={e => setField("cover_url", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.published_at} onChange={e => setField("published_at", e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Entry</label>
            <textarea value={form.body} onChange={e => setField("body", e.target.value)} rows={7} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.75 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span
                onClick={() => setField("status", form.status === "published" ? "draft" : "published")}
                style={{
                  width: 32, height: 18, borderRadius: 9, position: "relative", display: "inline-block",
                  background: form.status === "published" ? ORANGE : RULE, transition: "background 0.15s", cursor: "pointer",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: form.status === "published" ? 16 : 3,
                  width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                }} />
              </span>
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: form.status === "published" ? ORANGE : "#aaaaaa" }}>
                {form.status === "published" ? "Published" : "Draft"}
              </span>
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setEditing(false); setErr(null); }} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "8px 16px", cursor: "pointer", color: "#888888" }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: saving ? "#cccccc" : INK, color: "#ffffff", border: "none", padding: "8px 20px", cursor: saving ? "default" : "pointer" }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          {err && <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: "12px 0 0" }}>{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rk-turntable-entry"
      style={{
        display: "flex", gap: 40, alignItems: "flex-start",
        padding: "48px 0",
        borderTop: isFirst ? "none" : `1px solid ${RULE}`,
        opacity: deleting ? 0.4 : 1, transition: "opacity 0.2s",
      }}
    >
      {/* Album art */}
      <div className="rk-turntable-art" style={{ width: 200, flexShrink: 0 }}>
        <div style={{
          width: 200, height: 200, background: "#f0ede8",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {coverSrc && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc} alt={`${post.artist} — ${post.album}`}
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <span style={{ fontFamily: MONO, fontSize: "10px", color: "#bbbbbb", textAlign: "center", padding: "0 12px" }}>
              {post.artist}
            </span>
          )}
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: 0, fontWeight: 400 }}>
            {formatDate(post.published_at)}
            {post.status === "draft" && (
              <span style={{ marginLeft: 10, color: "#aaaaaa" }}>· Draft</span>
            )}
          </p>
          {isAdmin && (
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <button
                onClick={() => setEditing(true)}
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "4px 10px", cursor: "pointer", color: "#888888" }}
              >
                Edit
              </button>
              <button
                onClick={del}
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid #f0d0d0", padding: "4px 10px", cursor: "pointer", color: "#cc3300" }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <h2 style={{ fontFamily: SERIF, fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 600, color: INK, margin: "0 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {post.artist}
        </h2>
        <p style={{ fontFamily: MONO, fontSize: "12px", color: "#888888", margin: "0 0 24px", fontWeight: 400, letterSpacing: "0.02em" }}>
          {post.album}
        </p>

        <div style={{ height: 1, background: RULE, margin: "0 0 24px" }} />

        <div>
          {post.body.split("\n\n").map((para, i) => (
            <p key={i} style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 1.85, color: INK, margin: i > 0 ? "16px 0 0" : 0, fontWeight: 400 }}>
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props { isAdmin: boolean }

export default function TurntableView({ isAdmin }: Props) {
  const [posts,   setPosts]   = useState<TurntablePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = isAdmin ? "/api/turntable?all=1" : "/api/turntable";
    fetch(url)
      .then(r => r.json())
      .then((data: { posts: TurntablePost[] }) => setPosts(data.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  function onSaved(post: TurntablePost) {
    setPosts(prev => [post, ...prev].sort((a, b) => b.published_at.localeCompare(a.published_at)));
  }
  function onUpdated(post: TurntablePost) {
    setPosts(prev => prev.map(p => p.id === post.id ? post : p));
  }
  function onDeleted(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  if (loading) {
    return (
      <div>
        {[1, 2].map(i => (
          <div key={i} style={{ display: "flex", gap: 40, padding: "48px 0", borderTop: i > 1 ? `1px solid ${RULE}` : "none" }}>
            <div className="nr-shimmer" style={{ width: 200, height: 200, background: "#f0ede8", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="nr-shimmer" style={{ height: 10, background: "#f0ede8", width: 120 }} />
              <div className="nr-shimmer" style={{ height: 28, background: "#f0ede8", width: "50%" }} />
              <div className="nr-shimmer" style={{ height: 12, background: "#f0ede8", width: 180 }} />
              <div style={{ height: 1, background: RULE }} />
              {[1, 2, 3].map(j => (
                <div key={j} className="nr-shimmer" style={{ height: 12, background: "#f0ede8", width: j === 3 ? "60%" : "100%" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const visiblePosts = isAdmin ? posts : posts.filter(p => p.status === "published");

  return (
    <div>
      {isAdmin && <NewEntryForm onSaved={onSaved} />}

      {visiblePosts.length === 0 && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", lineHeight: 1.75, letterSpacing: "0.03em", paddingTop: 8 }}>
          {isAdmin ? "No entries yet — add your first one above." : "No entries yet."}
        </p>
      )}

      {visiblePosts.map((post, i) => (
        <TurntableEntry
          key={post.id} post={post} isFirst={i === 0}
          isAdmin={isAdmin} onUpdated={onUpdated} onDeleted={onDeleted}
        />
      ))}
    </div>
  );
}
