"use client";

import { useState, useEffect, useCallback } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
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

// ─── Discogs cover lookup ─────────────────────────────────────────────────────

function useCoverLookup(artist: string, album: string) {
  const [url,     setUrl]     = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [tried,   setTried]   = useState(false);

  const lookup = useCallback(async () => {
    if (!artist.trim() || !album.trim()) return;
    setLooking(true); setTried(false);
    try {
      const res = await fetch(
        `/api/turntable/cover?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`
      );
      const data = await res.json() as { url: string | null };
      setUrl(data.url ?? null);
    } catch { setUrl(null); }
    finally { setLooking(false); setTried(true); }
  }, [artist, album]);

  return { url, setUrl, looking, tried, lookup };
}

// ─── Shared form fields ───────────────────────────────────────────────────────

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

// ─── New-entry form ───────────────────────────────────────────────────────────

interface NewEntryFormProps { onSaved: (post: TurntablePost) => void }

function NewEntryForm({ onSaved }: NewEntryFormProps) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);
  const [artist, setArtist] = useState("");
  const [album,  setAlbum]  = useState("");
  const [body,   setBody]   = useState("");
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"draft" | "published">("published");

  const cover = useCoverLookup(artist, album);

  async function submit() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist, album, cover_url: cover.url, body, published_at: date, status }),
      });
      const data = await res.json() as { post?: TurntablePost; error?: string };
      if (!res.ok || !data.post) { setErr(data.error ?? "Save failed"); return; }
      onSaved(data.post);
      setArtist(""); setAlbum(""); setBody(""); cover.setUrl(null);
      setDate(new Date().toISOString().slice(0, 10)); setStatus("published");
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
          textTransform: "uppercase", color: INK, background: "none",
          border: `1px solid ${RULE}`, padding: "8px 16px",
          cursor: "pointer", marginBottom: 40,
        }}
      >
        + New Entry
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${RULE}`, padding: 28, marginBottom: 40, background: "#fafaf8" }}>
      <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: INK, margin: "0 0 24px" }}>
        New Entry
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Artist</label>
          <input value={artist} onChange={e => setArtist(e.target.value)} style={inputStyle} placeholder="e.g. Mulatu Astatke" />
        </div>
        <div>
          <label style={labelStyle}>Album</label>
          <input value={album} onChange={e => setAlbum(e.target.value)} style={inputStyle} placeholder="e.g. Ethio Jazz" />
        </div>
      </div>

      {/* Cover lookup */}
      <div style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Cover Art</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={cover.lookup}
              disabled={cover.looking || !artist.trim() || !album.trim()}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                background: cover.looking || !artist.trim() || !album.trim() ? "#f0f0f0" : INK,
                color: cover.looking || !artist.trim() || !album.trim() ? "#aaaaaa" : "#ffffff",
                border: "none", padding: "9px 16px", cursor: cover.looking || !artist.trim() || !album.trim() ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cover.looking ? "Looking up…" : "Find on Discogs"}
            </button>
            {cover.tried && !cover.url && (
              <span style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", alignSelf: "center" }}>No cover found</span>
            )}
          </div>
        </div>
        {cover.url && (
          <div style={{ flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/image-proxy?url=${encodeURIComponent(cover.url)}`} alt="cover preview"
              style={{ width: 64, height: 64, objectFit: "cover", display: "block", border: `1px solid ${RULE}` }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "calc(50% - 8px)" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Entry</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          rows={7}
          placeholder="What are you hearing? What makes this record worth writing about?"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.75 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span
            onClick={() => setStatus(s => s === "published" ? "draft" : "published")}
            style={{
              width: 32, height: 18, borderRadius: 9, position: "relative", display: "inline-block",
              background: status === "published" ? INK : RULE, transition: "background 0.15s", cursor: "pointer",
            }}
          >
            <span style={{
              position: "absolute", top: 3, left: status === "published" ? 16 : 3,
              width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
            }} />
          </span>
          <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: status === "published" ? INK : "#aaaaaa" }}>
            {status === "published" ? "Published" : "Draft"}
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
            disabled={saving || !artist.trim() || !album.trim()}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
              background: saving || !artist.trim() || !album.trim() ? "#cccccc" : INK,
              color: "#ffffff", border: "none", padding: "8px 20px",
              cursor: saving || !artist.trim() || !album.trim() ? "default" : "pointer",
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

// ─── Entry with inline edit ───────────────────────────────────────────────────

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
  const [artist, setArtist] = useState(post.artist);
  const [album,  setAlbum]  = useState(post.album);
  const [body,   setBody]   = useState(post.body);
  const [date,   setDate]   = useState(post.published_at);
  const [status, setStatus] = useState<"draft" | "published">(post.status);

  const cover = useCoverLookup(artist, album);

  useEffect(() => {
    if (editing) cover.setUrl(post.cover_url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const displayCover = editing ? cover.url : post.cover_url;
  const coverSrc = displayCover
    ? (displayCover.startsWith("/") ? displayCover : `/api/image-proxy?url=${encodeURIComponent(displayCover)}`)
    : null;

  async function save() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id, artist, album, cover_url: cover.url, body, published_at: date, status }),
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
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id }),
      });
      onDeleted(post.id);
    } catch { setDeleting(false); }
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
            <img src={coverSrc} alt={`${post.artist} — ${post.album}`}
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span style={{ fontFamily: MONO, fontSize: "10px", color: "#bbbbbb", textAlign: "center", padding: "0 12px" }}>
              {post.artist}
            </span>
          )}
        </div>
      </div>

      {/* Text / edit form */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0, fontWeight: 400 }}>
            {formatDate(post.published_at)}
            {post.status === "draft" && (
              <span style={{ marginLeft: 10, color: "#aaaaaa" }}>· Draft</span>
            )}
          </p>
          {isAdmin && !editing && (
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <button onClick={() => setEditing(true)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "4px 10px", cursor: "pointer", color: "#888888" }}>
                Edit
              </button>
              <button onClick={del} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid #f0d0d0", padding: "4px 10px", cursor: "pointer", color: "#cc3300" }}>
                Delete
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div style={{ border: `1px solid ${RULE}`, padding: 20, background: "#fafaf8" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Artist</label>
                <input value={artist} onChange={e => setArtist(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Album</label>
                <input value={album} onChange={e => setAlbum(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Cover Art</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={cover.lookup}
                    disabled={cover.looking || !artist.trim() || !album.trim()}
                    style={{
                      fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                      background: cover.looking || !artist.trim() || !album.trim() ? "#f0f0f0" : INK,
                      color: cover.looking || !artist.trim() || !album.trim() ? "#aaaaaa" : "#ffffff",
                      border: "none", padding: "9px 16px", cursor: cover.looking || !artist.trim() || !album.trim() ? "default" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cover.looking ? "Looking up…" : "Find on Discogs"}
                  </button>
                  {cover.tried && !cover.url && (
                    <span style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", alignSelf: "center" }}>No cover found</span>
                  )}
                </div>
              </div>
              {cover.url && (
                <div style={{ flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/image-proxy?url=${encodeURIComponent(cover.url)}`} alt="cover preview"
                    style={{ width: 64, height: 64, objectFit: "cover", display: "block", border: `1px solid ${RULE}` }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "calc(50% - 8px)" }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Entry</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.75 }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <span
                  onClick={() => setStatus(s => s === "published" ? "draft" : "published")}
                  style={{
                    width: 32, height: 18, borderRadius: 9, position: "relative", display: "inline-block",
                    background: status === "published" ? INK : RULE, transition: "background 0.15s", cursor: "pointer",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: status === "published" ? 16 : 3,
                    width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                  }} />
                </span>
                <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: status === "published" ? INK : "#aaaaaa" }}>
                  {status === "published" ? "Published" : "Draft"}
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
        ) : (
          <>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 600, color: INK, margin: "0 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {post.artist}
            </h2>
            <p style={{ fontFamily: MONO, fontSize: "12px", color: "#888888", margin: "0 0 20px", fontWeight: 400, letterSpacing: "0.02em" }}>
              {post.album}
            </p>
            <div>
              {post.body.split("\n\n").map((para, i) => (
                <p key={i} style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 1.85, color: INK, margin: i > 0 ? "16px 0 0" : 0, fontWeight: 400 }}>
                  {para}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props { isAdmin: boolean }

export default function TurntableView({ isAdmin }: Props) {
  const [posts,   setPosts]   = useState<TurntablePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(isAdmin ? "/api/turntable?all=1" : "/api/turntable")
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
