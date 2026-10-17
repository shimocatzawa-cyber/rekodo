"use client";

import { useState, useEffect, useCallback } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const VINYL_PRESETS = [
  { label: "Black",  color: "#111111" },
  { label: "White",  color: "#e8e4dc" },
  { label: "Clear",  color: "#9a9990" },
  { label: "Red",    color: "#6b1a1a" },
  { label: "Blue",   color: "#1a2b5a" },
  { label: "Green",  color: "#1a3a1a" },
];

interface TurntablePost {
  id: string;
  published_at: string;
  artist: string;
  album: string;
  year: string | null;
  label: string | null;
  genre: string | null;
  bandcamp_url: string | null;
  cover_url: string | null;
  body: string;
  status: "draft" | "published";
  vinyl_color: string | null;
  side: string | null;
  track_time: string | null;
}

// ─── Vinyl SVG graphics ───────────────────────────────────────────────────────

function parseProgress(trackTime?: string | null): number {
  if (!trackTime) return 0.28;
  const match = trackTime.match(/(\d+):(\d+)\s*\/\s*(\d+):(\d+)/);
  if (!match) return 0.28;
  const [, m1, s1, m2, s2] = match.map(Number);
  const total = m2 * 60 + s2;
  if (!total) return 0.28;
  return Math.min((m1 * 60 + s1) / total, 0.97);
}

function arcEndpoint(cx: number, cy: number, r: number, progress: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function VinylHero({ trackTime }: { trackTime?: string | null }) {
  const progress = parseProgress(trackTime);
  const cx = 45, cy = 45, r = 40;
  const { x: ex, y: ey } = arcEndpoint(cx, cy, r, progress);
  const largeArc = progress > 0.5 ? 1 : 0;
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" fill="none" aria-hidden="true">
      {[40, 35, 30, 25, 20, 14].map(radius => (
        <circle key={radius} cx={cx} cy={cy} r={radius} stroke="#d0cdc8" strokeWidth="0.7" />
      ))}
      <path
        d={`M ${cx},${cy - r} A ${r},${r} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)}`}
        stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3.5" fill={INK} />
    </svg>
  );
}

function VinylDisc({ color = "#111111", size = 64 }: { color?: string; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <circle cx={cx} cy={cy} r={r * 0.76} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r * 0.6}  stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      {/* Label area */}
      <circle cx={cx} cy={cy} r={r * 0.38} fill="rgba(255,255,255,0.11)" />
      {/* Center hole */}
      <circle cx={cx} cy={cy} r={r * 0.08} fill={INK} />
    </svg>
  );
}

// ─── Shared form helpers ──────────────────────────────────────────────────────

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

function VinylColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>Vinyl Colour</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {VINYL_PRESETS.map(p => (
          <button
            key={p.color}
            title={p.label}
            onClick={() => onChange(p.color)}
            style={{
              width: 28, height: 28, borderRadius: "50%", background: p.color,
              border: value === p.color ? `2.5px solid ${INK}` : `1px solid ${RULE}`,
              cursor: "pointer", flexShrink: 0,
            }}
          />
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ width: 28, height: 28, border: `1px solid ${RULE}`, padding: 2, cursor: "pointer", borderRadius: "50%", background: "none" }}
            title="Custom colour"
          />
          <span style={{ fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", letterSpacing: "0.1em" }}>Custom</span>
        </div>
      </div>
    </div>
  );
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

// ─── Cover lookup row (shared between forms) ──────────────────────────────────

function CoverLookupRow({ cover }: { cover: ReturnType<typeof useCoverLookup> }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <label style={labelStyle}>Cover Art</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={cover.lookup}
            disabled={cover.looking}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
              background: cover.looking ? "#f0f0f0" : INK,
              color: cover.looking ? "#aaaaaa" : "#ffffff",
              border: "none", padding: "9px 16px", cursor: cover.looking ? "default" : "pointer",
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
          <img
            src={cover.url.startsWith("/") ? cover.url : `/api/image-proxy?url=${encodeURIComponent(cover.url)}`}
            alt="cover preview"
            style={{ width: 64, height: 64, objectFit: "cover", display: "block", border: `1px solid ${RULE}` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusToggle({ status, onChange }: { status: "draft" | "published"; onChange: (s: "draft" | "published") => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <span
        onClick={() => onChange(status === "published" ? "draft" : "published")}
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
  );
}

// ─── New entry form ───────────────────────────────────────────────────────────

interface NewEntryFormProps { open: boolean; onClose: () => void; onSaved: (post: TurntablePost) => void }

function NewEntryForm({ open, onClose, onSaved }: NewEntryFormProps) {
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);
  const [artist,      setArtist]      = useState("");
  const [album,       setAlbum]       = useState("");
  const [year,        setYear]        = useState("");
  const [label,       setLabel]       = useState("");
  const [genre,       setGenre]       = useState("");
  const [bandcampUrl, setBandcampUrl] = useState("");
  const [body,        setBody]        = useState("");
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [status,      setStatus]      = useState<"draft" | "published">("published");
  const [vinylColor,  setVinylColor]  = useState("#111111");
  const [side,        setSide]        = useState("");
  const [trackTime,   setTrackTime]   = useState("");

  const cover = useCoverLookup(artist, album);

  async function submit() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist, album, year, label, genre, bandcamp_url: bandcampUrl,
          cover_url: cover.url, body, published_at: date, status,
          vinyl_color: vinylColor, side, track_time: trackTime,
        }),
      });
      const data = await res.json() as { post?: TurntablePost; error?: string };
      if (!res.ok || !data.post) { setErr(data.error ?? "Save failed"); return; }
      onSaved(data.post);
      setArtist(""); setAlbum(""); setYear(""); setLabel(""); setGenre("");
      setBandcampUrl(""); setBody(""); cover.setUrl(null); setSide(""); setTrackTime("");
      setDate(new Date().toISOString().slice(0, 10)); setStatus("published"); setVinylColor("#111111");
      onClose();
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  const canSave = !saving && artist.trim() !== "" && album.trim() !== "";

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Year <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
          <input value={year} onChange={e => setYear(e.target.value)} style={inputStyle} placeholder="e.g. 1983" />
        </div>
        <div>
          <label style={labelStyle}>Label <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
          <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} placeholder="e.g. Efficient Space" />
        </div>
        <div>
          <label style={labelStyle}>Genre <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
          <input value={genre} onChange={e => setGenre(e.target.value)} style={inputStyle} placeholder="e.g. Electronic" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Side <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
          <input value={side} onChange={e => setSide(e.target.value)} style={inputStyle} placeholder="e.g. SIDE A / 01" />
        </div>
        <div>
          <label style={labelStyle}>Track Time <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
          <input value={trackTime} onChange={e => setTrackTime(e.target.value)} style={inputStyle} placeholder="e.g. 1:24 / 3:56" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Bandcamp URL <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
        <input value={bandcampUrl} onChange={e => setBandcampUrl(e.target.value)} style={inputStyle} placeholder="https://artist.bandcamp.com/album/..." />
      </div>

      <div style={{ marginBottom: 16 }}><CoverLookupRow cover={cover} /></div>

      <div style={{ marginBottom: 16 }}>
        <VinylColorPicker value={vinylColor} onChange={setVinylColor} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "calc(50% - 8px)" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Listening Note</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)} rows={7}
          placeholder="What are you hearing? What makes this record worth writing about?"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.75 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <StatusToggle status={status} onChange={setStatus} />
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { onClose(); setErr(null); }} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "8px 16px", cursor: "pointer", color: "#888888" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!canSave} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: canSave ? INK : "#cccccc", color: "#ffffff", border: "none", padding: "8px 20px", cursor: canSave ? "pointer" : "default" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {err && <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: "12px 0 0" }}>{err}</p>}
    </div>
  );
}

// ─── Inline edit form (shared by hero + list entries) ─────────────────────────

interface InlineEditFormProps {
  post: TurntablePost;
  onSave: (post: TurntablePost) => void;
  onCancel: () => void;
  onDeleted: (id: string) => void;
}

function InlineEditForm({ post, onSave, onCancel, onDeleted }: InlineEditFormProps) {
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [artist,      setArtist]      = useState(post.artist);
  const [album,       setAlbum]       = useState(post.album);
  const [year,        setYear]        = useState(post.year         ?? "");
  const [label,       setLabel]       = useState(post.label        ?? "");
  const [genre,       setGenre]       = useState(post.genre        ?? "");
  const [bandcampUrl, setBandcampUrl] = useState(post.bandcamp_url ?? "");
  const [body,        setBody]        = useState(post.body);
  const [date,        setDate]        = useState(post.published_at);
  const [status,      setStatus]      = useState<"draft" | "published">(post.status);
  const [vinylColor,  setVinylColor]  = useState(post.vinyl_color ?? "#111111");
  const [side,        setSide]        = useState(post.side         ?? "");
  const [trackTime,   setTrackTime]   = useState(post.track_time   ?? "");

  const cover = useCoverLookup(artist, album);
  // initialise cover url from saved value
  useEffect(() => { cover.setUrl(post.cover_url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id, artist, album, year, label, genre, bandcamp_url: bandcampUrl,
          cover_url: cover.url, body, published_at: date, status,
          vinyl_color: vinylColor, side, track_time: trackTime,
        }),
      });
      const data = await res.json() as { post?: TurntablePost; error?: string };
      if (!res.ok || !data.post) { setErr(data.error ?? "Save failed"); return; }
      onSave(data.post);
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
    <div style={{ border: `1px solid ${RULE}`, padding: 20, background: "#fafaf8", opacity: deleting ? 0.4 : 1 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Year</label>
          <input value={year} onChange={e => setYear(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Label</label>
          <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Genre</label>
          <input value={genre} onChange={e => setGenre(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Side</label>
          <input value={side} onChange={e => setSide(e.target.value)} style={inputStyle} placeholder="e.g. SIDE A / 01" />
        </div>
        <div>
          <label style={labelStyle}>Track Time</label>
          <input value={trackTime} onChange={e => setTrackTime(e.target.value)} style={inputStyle} placeholder="e.g. 1:24 / 3:56" />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Bandcamp URL</label>
        <input value={bandcampUrl} onChange={e => setBandcampUrl(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 14 }}><CoverLookupRow cover={cover} /></div>
      <div style={{ marginBottom: 14 }}>
        <VinylColorPicker value={vinylColor} onChange={setVinylColor} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "calc(50% - 8px)" }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Listening Note</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.75 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <StatusToggle status={status} onChange={setStatus} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={del} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid #f0d0d0", padding: "8px 14px", cursor: "pointer", color: "#cc3300" }}>
            Delete
          </button>
          <button onClick={onCancel} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "8px 16px", cursor: "pointer", color: "#888888" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: saving ? "#cccccc" : INK, color: "#ffffff", border: "none", padding: "8px 20px", cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {err && <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: "12px 0 0" }}>{err}</p>}
    </div>
  );
}

// ─── Hero entry — NOW SPINNING ────────────────────────────────────────────────

interface EntryProps {
  post: TurntablePost;
  isAdmin: boolean;
  onUpdated: (post: TurntablePost) => void;
  onDeleted: (id: string) => void;
}

function HeroEntry({ post, isAdmin, onUpdated, onDeleted }: EntryProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [editing,   setEditing]   = useState(false);

  const coverSrc = post.cover_url
    ? (post.cover_url.startsWith("/") ? post.cover_url : `/api/image-proxy?url=${encodeURIComponent(post.cover_url)}`)
    : null;

  const metaParts = [post.label, post.year, post.genre].filter(Boolean).join(" · ");

  if (editing) {
    return (
      <InlineEditForm
        post={post}
        onSave={p => { onUpdated(p); setEditing(false); }}
        onCancel={() => setEditing(false)}
        onDeleted={onDeleted}
      />
    );
  }

  return (
    <>
      <div className="rk-turntable-hero" style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {/* Left — large album art */}
        <div className="rk-turntable-hero-art" style={{ width: 400, flexShrink: 0 }}>
          <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#f0ede8", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {coverSrc && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt={`${post.artist} — ${post.album}`} onError={() => setImgFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <span style={{ fontFamily: MONO, fontSize: "11px", color: "#bbbbbb", textAlign: "center", padding: "0 16px" }}>
                {post.artist}
              </span>
            )}
          </div>
        </div>

        {/* Right — content */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          {isAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={() => setEditing(true)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "4px 10px", cursor: "pointer", color: "#888888" }}>
                Edit
              </button>
            </div>
          )}

          {/* Side label */}
          {post.side && (
            <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 12px" }}>
              {post.side}
            </p>
          )}

          {/* Artist */}
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(36px, 4vw, 54px)", fontWeight: 600, color: INK, margin: "0 0 6px", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            {post.artist}
          </h2>

          {/* Album */}
          <p style={{ fontFamily: SERIF, fontSize: "clamp(20px, 2.5vw, 28px)", fontStyle: "italic", color: INK, margin: "0 0 14px", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {post.album}
          </p>

          {/* Metadata */}
          {metaParts && (
            <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#888888", margin: 0 }}>
              {metaParts}
            </p>
          )}

          {post.bandcamp_url && (
            <a href={post.bandcamp_url} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none", borderBottom: `1px solid ${INK}`, paddingBottom: 1, display: "inline-block", marginTop: 10 }}>
              Bandcamp ↗
            </a>
          )}

          {/* Separator */}
          <div style={{ height: 1, background: RULE, margin: "20px 0" }} />

          {/* Vinyl + Now Playing */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <VinylHero trackTime={post.track_time} />
            <div style={{ width: 1, height: 56, background: RULE, flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 5px" }}>
                Now Playing
              </p>
              {post.side && (
                <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: INK, margin: "0 0 8px" }}>
                  {post.side}
                </p>
              )}
              <div style={{ width: 24, height: 1.5, background: ORANGE, margin: "0 0 8px" }} />
              {post.track_time && (
                <p style={{ fontFamily: MONO, fontSize: "12px", color: INK, margin: 0 }}>
                  {post.track_time}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Listening note — full width */}
      {post.body && (
        <div style={{ marginTop: 36, maxWidth: 640 }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 14px" }}>
            Listening Note
          </p>
          {post.body.split("\n\n").map((para, i) => (
            <p key={i} style={{ fontFamily: SERIF, fontSize: "clamp(17px, 1.8vw, 20px)", fontStyle: "italic", lineHeight: 1.65, color: INK, margin: i > 0 ? "16px 0 0" : 0 }}>
              {para}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ─── History list entry ───────────────────────────────────────────────────────

function ListEntry({ post, isAdmin, onUpdated, onDeleted }: EntryProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [editing,   setEditing]   = useState(false);

  const coverSrc = post.cover_url
    ? (post.cover_url.startsWith("/") ? post.cover_url : `/api/image-proxy?url=${encodeURIComponent(post.cover_url)}`)
    : null;

  const metaParts = [post.label, post.year, post.genre].filter(Boolean).join(" · ");

  if (editing) {
    return (
      <div style={{ borderTop: `1px solid ${RULE}`, padding: "20px 0" }}>
        <InlineEditForm
          post={post}
          onSave={p => { onUpdated(p); setEditing(false); }}
          onCancel={() => setEditing(false)}
          onDeleted={onDeleted}
        />
      </div>
    );
  }

  return (
    <div className="rk-turntable-list-row" style={{ display: "flex", alignItems: "center", gap: 20, padding: "22px 0", borderTop: `1px solid ${RULE}` }}>
      {/* Thumbnail */}
      <div className="rk-turntable-list-thumb" style={{ width: 100, height: 100, flexShrink: 0, background: "#f0ede8", overflow: "hidden" }}>
        {coverSrc && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt={`${post.artist} — ${post.album}`} onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "9px", color: "#bbbbbb", textAlign: "center", padding: "0 8px" }}>
              {post.artist}
            </span>
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 5px" }}>
          {formatDate(post.published_at)}
          {post.status === "draft" && <span style={{ marginLeft: 8, color: "#cccccc" }}>· Draft</span>}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "clamp(18px, 2vw, 22px)", fontWeight: 600, color: INK, margin: "0 0 2px", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {post.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "clamp(13px, 1.4vw, 15px)", fontStyle: "italic", color: INK, margin: "0 0 5px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {post.album}
        </p>
        {metaParts && (
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#888888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {metaParts}
          </p>
        )}
      </div>

      {/* Vinyl disc */}
      <div className="rk-turntable-vinyl" style={{ flexShrink: 0 }}>
        <VinylDisc color={post.vinyl_color ?? "#111111"} size={64} />
      </div>

      {/* Side + time */}
      <div className="rk-turntable-timing" style={{ flexShrink: 0, minWidth: 88 }}>
        {post.side && (
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, margin: "0 0 4px" }}>
            {post.side}
          </p>
        )}
        {post.track_time && (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: 0 }}>
            {post.track_time}
          </p>
        )}
      </div>

      {/* Play button (decorative) + admin edit */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${RULE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden="true">
            <path d="M0.5 0.5L8.5 5.5L0.5 10.5V0.5Z" fill={INK} />
          </svg>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing(true)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "4px 8px", cursor: "pointer", color: "#888888" }}>
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <div className="rk-turntable-hero" style={{ display: "flex", gap: 40, padding: "8px 0 48px" }}>
        <div className="nr-shimmer" style={{ width: 400, aspectRatio: "1 / 1", background: "#f0ede8", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
          <div className="nr-shimmer" style={{ height: 10, background: "#f0ede8", width: 100 }} />
          <div className="nr-shimmer" style={{ height: 48, background: "#f0ede8", width: "70%" }} />
          <div className="nr-shimmer" style={{ height: 26, background: "#f0ede8", width: "50%" }} />
          <div className="nr-shimmer" style={{ height: 10, background: "#f0ede8", width: 200 }} />
        </div>
      </div>
      {[1, 2].map(i => (
        <div key={i} style={{ display: "flex", gap: 20, padding: "22px 0", borderTop: `1px solid ${RULE}` }}>
          <div className="nr-shimmer" style={{ width: 100, height: 100, background: "#f0ede8", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="nr-shimmer" style={{ height: 9, background: "#f0ede8", width: 90 }} />
            <div className="nr-shimmer" style={{ height: 20, background: "#f0ede8", width: "55%" }} />
            <div className="nr-shimmer" style={{ height: 14, background: "#f0ede8", width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props { isAdmin: boolean }

export default function TurntableView({ isAdmin }: Props) {
  const [posts,    setPosts]    = useState<TurntablePost[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [formOpen, setFormOpen] = useState(false);

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

  if (loading) return <Skeleton />;

  const visiblePosts = isAdmin ? posts : posts.filter(p => p.status === "published");
  const heroPost     = visiblePosts[0] ?? null;
  const historyPosts = visiblePosts.slice(1);

  return (
    <div>
      {/* ── NOW SPINNING header ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: INK, margin: 0, fontWeight: 500, borderBottom: `1.5px solid ${ORANGE}`, paddingBottom: 4 }}>
          Now Spinning
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          {heroPost && (
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#888888" }}>
              {formatDate(heroPost.published_at)}
            </span>
          )}
          {isAdmin && !formOpen && (
            <button
              onClick={() => setFormOpen(true)}
              style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: INK, background: "none", border: `1px solid ${INK}`, padding: "7px 16px", cursor: "pointer" }}
            >
              + New Entry
            </button>
          )}
        </div>
      </div>

      {/* ── New entry form ── */}
      {isAdmin && <NewEntryForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={onSaved} />}

      {/* ── Hero entry ── */}
      {heroPost ? (
        <HeroEntry post={heroPost} isAdmin={isAdmin} onUpdated={onUpdated} onDeleted={onDeleted} />
      ) : (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", lineHeight: 1.75, letterSpacing: "0.03em" }}>
          {isAdmin ? "No entries yet — add your first one above." : "No entries yet."}
        </p>
      )}

      {/* ── PREVIOUSLY ON THE TURNTABLE ── */}
      {historyPosts.length > 0 && (
        <div style={{ marginTop: 52 }}>
          <div style={{ height: 1, background: RULE, marginBottom: 52 }} />
          <h2 style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: INK, margin: "0 0 20px", fontWeight: 500, borderBottom: `1.5px solid ${ORANGE}`, paddingBottom: 4, display: "inline-block" }}>
            Previously on the Turntable
          </h2>
          <div>
            {historyPosts.map(post => (
              <ListEntry key={post.id} post={post} isAdmin={isAdmin} onUpdated={onUpdated} onDeleted={onDeleted} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
