"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  vinyl_photo_url: string | null;
  body: string;
  status: "draft" | "published";
  vinyl_color: string | null;
  side: string | null;
  track_time: string | null;
  favourite_track: string | null;
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

// ─── Photo uploader ───────────────────────────────────────────────────────────

function PhotoUploader({
  label,
  hint,
  type,
  currentUrl,
  onUploaded,
  square = false,
}: {
  label: string;
  hint?: string;
  type: "artwork" | "vinyl";
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  square?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState<string | null>(currentUrl);
  const [err,       setErr]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(null); setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    try {
      const res  = await fetch("/api/turntable/photo", { method: "POST", body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setErr(data.error ?? "Upload failed"); return; }
      setPreview(data.url);
      onUploaded(data.url);
    } catch { setErr("Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <div>
      <label style={labelStyle}>
        {label}
        {hint && <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}> — {hint}</span>}
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Preview */}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={label}
            style={{
              width: square ? 80 : 64,
              height: square ? 80 : 64,
              objectFit: "cover",
              display: "block",
              border: `1px solid ${RULE}`,
              borderRadius: type === "vinyl" ? "50%" : 0,
              flexShrink: 0,
            }}
          />
        )}
        <div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
              background: uploading ? "#f0f0f0" : INK,
              color: uploading ? "#aaaaaa" : "#ffffff",
              border: "none", padding: "9px 16px", cursor: uploading ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {uploading ? "Uploading…" : preview ? "Replace Photo" : "Upload Photo"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {err && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "6px 0 0" }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusToggle({ status, onChange }: { status: "draft" | "published"; onChange: (s: "draft" | "published") => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <span
        onClick={() => onChange(status === "published" ? "draft" : "published")}
        style={{ width: 32, height: 18, borderRadius: 9, position: "relative", display: "inline-block", background: status === "published" ? INK : RULE, transition: "background 0.15s", cursor: "pointer" }}
      >
        <span style={{ position: "absolute", top: 3, left: status === "published" ? 16 : 3, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </span>
      <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: status === "published" ? INK : "#aaaaaa" }}>
        {status === "published" ? "Published" : "Draft"}
      </span>
    </label>
  );
}

// ─── Shared text field grid ───────────────────────────────────────────────────

function CoreFields({
  artist, setArtist, album, setAlbum,
  year, setYear, label, setLabel, genre, setGenre,
  side, setSide, trackTime, setTrackTime,
  bandcampUrl, setBandcampUrl,
}: {
  artist: string; setArtist: (v: string) => void;
  album: string; setAlbum: (v: string) => void;
  year: string; setYear: (v: string) => void;
  label: string; setLabel: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  side: string; setSide: (v: string) => void;
  trackTime: string; setTrackTime: (v: string) => void;
  bandcampUrl: string; setBandcampUrl: (v: string) => void;
}) {
  return (
    <>
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
    </>
  );
}

// ─── New entry form ───────────────────────────────────────────────────────────

interface NewEntryFormProps { open: boolean; onClose: () => void; onSaved: (post: TurntablePost) => void }

function NewEntryForm({ open, onClose, onSaved }: NewEntryFormProps) {
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [artist,      setArtist]      = useState("");
  const [album,       setAlbum]       = useState("");
  const [year,        setYear]        = useState("");
  const [label,       setLabel]       = useState("");
  const [genre,       setGenre]       = useState("");
  const [bandcampUrl, setBandcampUrl] = useState("");
  const [body,        setBody]        = useState("");
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [status,      setStatus]      = useState<"draft" | "published">("published");
  const [side,        setSide]        = useState("");
  const [trackTime,   setTrackTime]   = useState("");
  const [coverUrl,       setCoverUrl]       = useState<string | null>(null);
  const [vinylUrl,       setVinylUrl]       = useState<string | null>(null);
  const [favouriteTrack, setFavouriteTrack] = useState("");

  function reset() {
    setArtist(""); setAlbum(""); setYear(""); setLabel(""); setGenre("");
    setBandcampUrl(""); setBody(""); setSide(""); setTrackTime(""); setFavouriteTrack("");
    setDate(new Date().toISOString().slice(0, 10)); setStatus("published");
    setCoverUrl(null); setVinylUrl(null);
  }

  async function submit() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist, album, year, label, genre, bandcamp_url: bandcampUrl,
          cover_url: coverUrl, vinyl_photo_url: vinylUrl, body,
          published_at: date, status, side, track_time: trackTime,
          favourite_track: favouriteTrack,
        }),
      });
      const data = await res.json() as { post?: TurntablePost; error?: string };
      if (!res.ok || !data.post) { setErr(data.error ?? "Save failed"); return; }
      onSaved(data.post);
      reset();
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

      <CoreFields
        artist={artist} setArtist={setArtist}
        album={album} setAlbum={setAlbum}
        year={year} setYear={setYear}
        label={label} setLabel={setLabel}
        genre={genre} setGenre={setGenre}
        side={side} setSide={setSide}
        trackTime={trackTime} setTrackTime={setTrackTime}
        bandcampUrl={bandcampUrl} setBandcampUrl={setBandcampUrl}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 16 }}>
        <PhotoUploader label="Artwork Photo" hint="your shot of the cover" type="artwork" currentUrl={coverUrl} onUploaded={setCoverUrl} square />
        <PhotoUploader label="Vinyl Photo" hint="your shot of the record" type="vinyl" currentUrl={vinylUrl} onUploaded={setVinylUrl} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "calc(50% - 8px)" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Favourite Track <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
        <input value={favouriteTrack} onChange={e => setFavouriteTrack(e.target.value)} style={inputStyle} placeholder="e.g. God in California" />
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
          <button onClick={() => { onClose(); setErr(null); reset(); }} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "8px 16px", cursor: "pointer", color: "#888888" }}>
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

// ─── Inline edit form ─────────────────────────────────────────────────────────

interface InlineEditFormProps {
  post: TurntablePost;
  onSave: (post: TurntablePost) => void;
  onCancel: () => void;
  onDeleted: (id: string) => void;
}

function InlineEditForm({ post, onSave, onCancel, onDeleted }: InlineEditFormProps) {
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [artist,      setArtist]      = useState(post.artist);
  const [album,       setAlbum]       = useState(post.album);
  const [year,        setYear]        = useState(post.year         ?? "");
  const [label,       setLabel]       = useState(post.label        ?? "");
  const [genre,       setGenre]       = useState(post.genre        ?? "");
  const [bandcampUrl, setBandcampUrl] = useState(post.bandcamp_url ?? "");
  const [body,        setBody]        = useState(post.body);
  const [date,        setDate]        = useState(post.published_at);
  const [status,      setStatus]      = useState<"draft" | "published">(post.status);
  const [side,        setSide]        = useState(post.side         ?? "");
  const [trackTime,   setTrackTime]   = useState(post.track_time   ?? "");
  const [coverUrl,       setCoverUrl]       = useState<string | null>(post.cover_url);
  const [vinylUrl,       setVinylUrl]       = useState<string | null>(post.vinyl_photo_url);
  const [favouriteTrack, setFavouriteTrack] = useState(post.favourite_track ?? "");

  async function save() {
    setErr(null); setSaving(true);
    try {
      const res = await fetch("/api/turntable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id, artist, album, year, label, genre, bandcamp_url: bandcampUrl,
          cover_url: coverUrl, vinyl_photo_url: vinylUrl, body,
          published_at: date, status, side, track_time: trackTime,
          favourite_track: favouriteTrack,
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
      <CoreFields
        artist={artist} setArtist={setArtist}
        album={album} setAlbum={setAlbum}
        year={year} setYear={setYear}
        label={label} setLabel={setLabel}
        genre={genre} setGenre={setGenre}
        side={side} setSide={setSide}
        trackTime={trackTime} setTrackTime={setTrackTime}
        bandcampUrl={bandcampUrl} setBandcampUrl={setBandcampUrl}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 16 }}>
        <PhotoUploader label="Artwork Photo" type="artwork" currentUrl={coverUrl} onUploaded={setCoverUrl} square />
        <PhotoUploader label="Vinyl Photo" type="vinyl" currentUrl={vinylUrl} onUploaded={setVinylUrl} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "calc(50% - 8px)" }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Favourite Track <span style={{ color: "#d0d0d0", textTransform: "none", letterSpacing: 0 }}>— optional</span></label>
        <input value={favouriteTrack} onChange={e => setFavouriteTrack(e.target.value)} style={inputStyle} placeholder="e.g. God in California" />
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
  const [artFailed,   setArtFailed]   = useState(false);
  const [vinylFailed, setVinylFailed] = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [swapped,     setSwapped]     = useState(false); // false = artwork large, true = vinyl large

  const coverSrc = post.cover_url ?? null;
  const vinylSrc = post.vinyl_photo_url ?? null;
  const canSwap  = !!coverSrc && !!vinylSrc;
  const metaParts = [post.label, post.year, post.genre].filter(Boolean).join(" · ");

  // Which image is currently large vs thumbnail
  const largeSrc    = swapped ? vinylSrc  : (coverSrc ?? vinylSrc);
  const thumbSrc    = canSwap ? (swapped ? coverSrc : vinylSrc) : null;
  const largeAlt    = swapped ? "vinyl"   : `${post.artist} — ${post.album}`;
  const thumbAlt    = swapped ? `${post.artist} — ${post.album}` : "vinyl";
  const largeFailed = swapped ? vinylFailed : artFailed;
  const onLargeErr  = swapped ? () => setVinylFailed(true) : () => setArtFailed(true);

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
    <div className="rk-turntable-hero" style={{ display: "flex", gap: 40, alignItems: "stretch" }}>
      {/* Left — large photo (swappable) */}
      <div className="rk-turntable-hero-art" style={{ width: 400, flexShrink: 0 }}>
        <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#f0ede8", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {largeSrc && !largeFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={largeSrc} alt={largeAlt} onError={onLargeErr}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span style={{ fontFamily: MONO, fontSize: "11px", color: "#bbbbbb", textAlign: "center", padding: "0 16px" }}>
              {post.artist}
            </span>
          )}
        </div>
      </div>

      {/* Right — full-height flex column, top content at top, vinyl+notes at bottom */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Edit button — absolutely positioned, doesn't push artist name down */}
        {isAdmin && (
          <button onClick={() => setEditing(true)} style={{ position: "absolute", top: 0, right: 0, fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: `1px solid ${RULE}`, padding: "4px 10px", cursor: "pointer", color: "#888888", zIndex: 1 }}>
            Edit
          </button>
        )}

        {/* Top section */}
        <div>
          {post.side && (
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px" }}>
              {post.side}
            </p>
          )}

          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(28px, 3.2vw, 44px)", fontWeight: 600, color: INK, margin: "0 0 4px", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            {post.artist}
          </h2>

          <p style={{ fontFamily: SERIF, fontSize: "clamp(17px, 2vw, 24px)", fontStyle: "italic", color: INK, margin: "0 0 12px", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {post.album}
          </p>

          {metaParts && (
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#888888", margin: 0 }}>
              {metaParts}
            </p>
          )}

          {post.bandcamp_url && (
            <a href={post.bandcamp_url} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none", borderBottom: `1px solid ${INK}`, paddingBottom: 1, display: "inline-block", marginTop: 8 }}>
              Bandcamp ↗
            </a>
          )}

          {/* Favourite track + listening note flow naturally after Bandcamp */}
          {post.favourite_track && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 6px" }}>
                Favourite Track
              </p>
              <p style={{ fontFamily: SERIF, fontSize: "clamp(12px, 1.2vw, 14px)", color: INK, margin: 0, lineHeight: 1.3 }}>
                {post.favourite_track}
              </p>
            </div>
          )}

          {post.body && (
            <div style={{ marginTop: post.favourite_track ? 16 : 20 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 8px" }}>
                Listening Note
              </p>
              {post.body.split("\n\n").map((para, i) => (
                <p key={i} style={{ fontFamily: SERIF, fontSize: "clamp(11px, 1.1vw, 13px)", fontStyle: "italic", lineHeight: 1.65, color: INK, margin: i > 0 ? "8px 0 0" : 0 }}>
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Vinyl thumbnail alone — pinned to bottom-left of frame */}
        {thumbSrc && (
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbSrc}
              alt={thumbAlt}
              onClick={() => setSwapped(s => !s)}
              style={{ width: 88, height: 88, objectFit: "cover", display: "block", cursor: "pointer", opacity: 0.75, transition: "opacity 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "0.75"; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History list entry ───────────────────────────────────────────────────────

function ListEntry({ post, isAdmin, onUpdated, onDeleted }: EntryProps) {
  const [artFailed,   setArtFailed]   = useState(false);
  const [vinylFailed, setVinylFailed] = useState(false);
  const [editing,     setEditing]     = useState(false);

  const metaParts = [post.label, post.year, post.genre].filter(Boolean).join(" · ");
  const coverSrc  = post.cover_url ?? null;
  const vinylSrc  = post.vinyl_photo_url ?? null;

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
      {/* Artwork thumbnail */}
      <div className="rk-turntable-list-thumb" style={{ width: 100, height: 100, flexShrink: 0, background: "#f0ede8", overflow: "hidden" }}>
        {coverSrc && !artFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt={`${post.artist} — ${post.album}`} onError={() => setArtFailed(true)}
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

      {/* Vinyl photo (circular crop) */}
      <div className="rk-turntable-vinyl" style={{ flexShrink: 0, width: 64, height: 64 }}>
        {vinylSrc && !vinylFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vinylSrc} alt="vinyl" onError={() => setVinylFailed(true)}
            style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block" }} />
        ) : (
          // SVG fallback disc
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="31" fill={post.vinyl_color ?? "#111111"} />
            <circle cx="32" cy="32" r="12" fill="rgba(255,255,255,0.11)" />
            <circle cx="32" cy="32" r="2.5" fill={INK} />
          </svg>
        )}
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
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${RULE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

      {isAdmin && <NewEntryForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={onSaved} />}

      {heroPost ? (
        <HeroEntry post={heroPost} isAdmin={isAdmin} onUpdated={onUpdated} onDeleted={onDeleted} />
      ) : (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", lineHeight: 1.75, letterSpacing: "0.03em" }}>
          {isAdmin ? "No entries yet — add your first one above." : "No entries yet."}
        </p>
      )}

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
