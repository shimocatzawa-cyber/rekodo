"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const SUBTLE = "#888888";
const BORDER = "#e8e8e0";
const LIGHT  = "#f7f5f0";

// ── Types ─────────────────────────────────────────────────────────────────────

type GigArtist = { id: string; artist_name: string; is_headliner: boolean };
type GigSong   = { id: string; position: number; song_title: string; set_label: string };
type Gig = {
  id: string; date: string; venue: string | null; city: string | null;
  country: string | null; journal_entry: string | null; rating: number | null;
  setlist_fm_id: string | null; setlist_source: "setlist_fm" | "manual" | "none";
  photo_1_url: string | null; photo_2_url: string | null; poster_url: string | null;
  artists: GigArtist[]; songs: GigSong[];
};
type SetlistResult = {
  id: string; artistName: string; venueName: string; city: string;
  country: string; eventDate: string; url: string;
  songs: { title: string; setLabel: string }[];
};
type FormArtist = { name: string; is_headliner: boolean };
type FormState = {
  date: string; artists: FormArtist[]; venue: string; city: string; country: string;
  journal: string; rating: number;
  songs: { title: string; setLabel: string }[];
  setlistSource: "setlist_fm" | "manual" | "none";
  setlistFmId: string;
  photo1: string | null; photo2: string | null; poster: string | null;
};

const EMPTY_FORM: FormState = {
  date: "", artists: [{ name: "", is_headliner: true }],
  venue: "", city: "", country: "", journal: "", rating: 0,
  songs: [], setlistSource: "none", setlistFmId: "",
  photo1: null, photo2: null, poster: null,
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function parseDateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    day:   dt.toLocaleDateString("en-GB", { day: "numeric" }),
    month: dt.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    year:  String(y),
  };
}

function groupByYear(gigs: Gig[]): [string, Gig[]][] {
  const map = new Map<string, Gig[]>();
  for (const g of gigs) {
    const y = g.date.slice(0, 4);
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(g);
  }
  return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
}

// ── Rating dots ───────────────────────────────────────────────────────────────

function RatingDots({ value, onChange, size = 10 }: {
  value: number; onChange?: (v: number) => void; size?: number;
}) {
  return (
    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n} type="button"
          onClick={() => onChange?.(value === n ? 0 : n)}
          style={{
            width: size, height: size, borderRadius: "50%", padding: 0,
            background: n <= value ? ORANGE : "transparent",
            border: `1.5px solid ${n <= value ? ORANGE : "#cccccc"}`,
            cursor: onChange ? "pointer" : "default", flexShrink: 0,
          }}
          aria-label={`${n} of 5`}
        />
      ))}
    </div>
  );
}

// ── Photo slot ────────────────────────────────────────────────────────────────

function PhotoSlot({ label, url, disabled, uploading, onUpload, onRemove }: {
  label: string; url: string | null; disabled: boolean;
  uploading: boolean; onUpload: (f: File) => void; onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ flex: "1 1 90px", minWidth: 0 }}>
      <div
        onClick={() => !url && !disabled && !uploading && inputRef.current?.click()}
        style={{
          height: 88, border: `1.5px dashed ${disabled ? "#eeeeee" : url ? "transparent" : BORDER}`,
          background: url ? "transparent" : LIGHT, cursor: disabled || url ? "default" : "pointer",
          position: "relative", overflow: "hidden", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {!disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(); }}
                style={{
                  position: "absolute", top: 4, right: 4,
                  background: "rgba(0,0,0,0.55)", color: "#fff",
                  border: "none", borderRadius: "50%", width: 18, height: 18,
                  cursor: "pointer", fontSize: "9px", lineHeight: "18px", padding: 0,
                }}
              >✕</button>
            )}
          </>
        ) : uploading ? (
          <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>Uploading…</span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: "8px", color: disabled ? "#dddddd" : "#c0c0c0", textAlign: "center", padding: "0 6px" }}>
            {label}
          </span>
        )}
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── Gig card ──────────────────────────────────────────────────────────────────

function GigCard({ gig, onEdit, onDelete }: {
  gig: Gig; onEdit: (g: Gig) => void; onDelete: (id: string) => void;
}) {
  const d = parseDateParts(gig.date);
  const headliners = gig.artists.filter(a => a.is_headliner).map(a => a.artist_name);
  const supports   = gig.artists.filter(a => !a.is_headliner).map(a => a.artist_name);
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirming(false); }}
      style={{
        display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`,
        background: hovered ? LIGHT : "#ffffff", transition: "background 0.1s",
        minHeight: 72,
      }}
    >
      {/* Orange left stripe — the timeline thread */}
      <div style={{ width: 3, background: ORANGE, flexShrink: 0, borderRadius: "1px 0 0 1px" }} />

      {/* Photo thumbnail */}
      {gig.photo_1_url && (
        <div style={{ width: 64, height: 64, flexShrink: 0, margin: "14px 14px 14px 10px", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gig.photo_1_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* Date block */}
      <div style={{
        width: 46, flexShrink: 0, padding: "14px 0 14px 12px",
        display: "flex", flexDirection: "column", justifyContent: "flex-start",
      }}>
        <span style={{ fontFamily: SERIF, fontSize: "26px", lineHeight: 1, color: ORANGE, fontWeight: 700 }}>
          {d.day}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.08em", color: SUBTLE, marginTop: 2 }}>
          {d.month}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.05em", color: "#c0c0c0" }}>
          {d.year}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "14px 10px 14px 6px", minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: "16px", color: INK, lineHeight: 1.25, marginBottom: 2 }}>
          {headliners.join(" · ") || "Unknown Artist"}
        </div>
        {supports.length > 0 && (
          <div style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE, letterSpacing: "0.05em", marginBottom: 4 }}>
            w/ {supports.join(", ")}
          </div>
        )}
        {(gig.venue || gig.city) && (
          <div style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
            {[gig.venue, gig.city].filter(Boolean).join(" · ")}
          </div>
        )}
        {!!gig.rating && <RatingDots value={gig.rating} size={8} />}
        {gig.journal_entry && (
          <div style={{
            fontFamily: SERIF, fontSize: "11px", color: SUBTLE, fontStyle: "italic",
            marginTop: 5, lineHeight: 1.45,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            "{gig.journal_entry.slice(0, 160)}{gig.journal_entry.length > 160 ? "…" : ""}"
          </div>
        )}
        {gig.songs.length > 0 && (
          <div style={{ fontFamily: MONO, fontSize: "7px", color: "#c0c0c0", letterSpacing: "0.06em", marginTop: 5 }}>
            {gig.songs.length} songs{gig.setlist_source === "setlist_fm" ? " · setlist.fm" : gig.setlist_source === "manual" ? " · manual setlist" : ""}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div style={{ padding: "14px 14px 14px 0", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", justifyContent: "flex-start" }}>
          <button
            type="button" onClick={() => onEdit(gig)}
            style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "none", color: ORANGE, cursor: "pointer", padding: 0 }}
          >Edit</button>
          {confirming ? (
            <button
              type="button" onClick={() => onDelete(gig.id)}
              style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "none", color: "#cc2200", cursor: "pointer", padding: 0 }}
            >Confirm?</button>
          ) : (
            <button
              type="button" onClick={() => setConfirming(true)}
              style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "none", color: "#cccccc", cursor: "pointer", padding: 0 }}
            >Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GigJournalTab() {
  const [gigs, setGigs]   = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]   = useState<"timeline" | "form">("timeline");

  // Form state
  const [editGig, setEditGig]     = useState<Gig | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Setlist search
  const [setlistSearching, setSetlistSearching] = useState(false);
  const [setlistResults, setSetlistResults]     = useState<SetlistResult[]>([]);
  const [setlistError, setSetlistError]         = useState<string | null>(null);
  const [manualText, setManualText]             = useState("");

  // Photo uploads
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const savedIdRef = useRef<string | null>(null);
  savedIdRef.current = savedId;

  const loadGigs = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/gigs/journal");
    const data = await res.json();
    setGigs(data.gigs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadGigs(); }, [loadGigs]);

  function openNew() {
    setEditGig(null);
    setSavedId(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setSetlistResults([]); setSetlistError(null); setManualText(""); setSaveError(null);
    setView("form");
  }

  function openEdit(gig: Gig) {
    setEditGig(gig);
    setSavedId(gig.id);
    const sorted = [...gig.songs].sort((a, b) => a.position - b.position);
    setForm({
      date:    gig.date,
      artists: gig.artists.length > 0
        ? gig.artists.map(a => ({ name: a.artist_name, is_headliner: a.is_headliner }))
        : [{ name: "", is_headliner: true }],
      venue:   gig.venue   ?? "",
      city:    gig.city    ?? "",
      country: gig.country ?? "",
      journal: gig.journal_entry ?? "",
      rating:  gig.rating ?? 0,
      songs:   sorted.map(s => ({ title: s.song_title, setLabel: s.set_label })),
      setlistSource: gig.setlist_source,
      setlistFmId:   gig.setlist_fm_id ?? "",
      photo1:  gig.photo_1_url,
      photo2:  gig.photo_2_url,
      poster:  gig.poster_url,
    });
    setManualText(sorted.map(s => s.song_title).join("\n"));
    setSetlistResults([]); setSetlistError(null); setSaveError(null);
    setView("form");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/gigs/journal/${id}`, { method: "DELETE" });
    setGigs(g => g.filter(x => x.id !== id));
  }

  // Returns the gigId (new or existing) — does NOT navigate away
  async function saveGig(): Promise<string | null> {
    if (!form.date) { setSaveError("Date is required."); return null; }
    const validArtists = form.artists.filter(a => a.name.trim());
    if (validArtists.length === 0) { setSaveError("At least one artist is required."); return null; }

    setSaving(true); setSaveError(null);

    const body = {
      date:          form.date,
      venue:         form.venue    || null,
      city:          form.city     || null,
      country:       form.country  || null,
      journal_entry: form.journal  || null,
      rating:        form.rating   || null,
      setlist_fm_id: form.setlistFmId || null,
      setlist_source: form.setlistSource,
      photo_1_url:   form.photo1,
      photo_2_url:   form.photo2,
      poster_url:    form.poster,
      artists: validArtists.map(a => ({ name: a.name.trim(), is_headliner: a.is_headliner })),
      songs:   form.songs.filter(s => s.title.trim()),
    };

    const existingId = savedIdRef.current ?? editGig?.id ?? null;
    let gigId = existingId;

    if (!gigId) {
      const res = await fetch("/api/gigs/journal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Save failed"); setSaving(false); return null; }
      gigId = data.id;
      setSavedId(gigId);
    } else {
      const res = await fetch(`/api/gigs/journal/${gigId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed"); setSaving(false); return null; }
    }

    setSaving(false);
    return gigId;
  }

  async function handleSaveAndReturn() {
    const id = await saveGig();
    if (!id) return;
    await loadGigs();
    setView("timeline");
  }

  async function handleSetlistSearch() {
    const artist = form.artists.find(a => a.is_headliner)?.name?.trim() || form.artists[0]?.name?.trim();
    if (!artist || !form.date) { setSetlistError("Enter artist and date first."); return; }
    setSetlistSearching(true); setSetlistError(null); setSetlistResults([]);
    try {
      const res  = await fetch(`/api/gigs/setlist-search?artist=${encodeURIComponent(artist)}&date=${form.date}`);
      const data = await res.json();
      if (!res.ok) { setSetlistError(data.error ?? "Search failed"); return; }
      if (!data.results?.length) { setSetlistError("No setlists found. Try a slightly different artist name."); return; }
      setSetlistResults(data.results);
    } finally {
      setSetlistSearching(false);
    }
  }

  function applySetlist(result: SetlistResult) {
    setForm(f => ({
      ...f,
      setlistFmId:    result.id,
      setlistSource:  "setlist_fm",
      songs:          result.songs,
      venue:          f.venue || result.venueName,
      city:           f.city  || result.city,
    }));
    setSetlistResults([]);
    setManualText(result.songs.map(s => s.title).join("\n"));
  }

  function applyManual() {
    const songs = manualText.split("\n").map(l => l.trim()).filter(Boolean)
      .map(title => ({ title, setLabel: "Main Set" }));
    setForm(f => ({ ...f, songs, setlistSource: songs.length > 0 ? "manual" : "none", setlistFmId: "" }));
  }

  async function uploadPhoto(slot: "photo1" | "photo2" | "poster", file: File) {
    let gigId = savedIdRef.current;
    if (!gigId) {
      gigId = await saveGig();
      if (!gigId) return;
    }
    setUploading(u => ({ ...u, [slot]: true }));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slot", slot);
    const res  = await fetch(`/api/gigs/journal/${gigId}/photo`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.url) {
      const key = slot === "photo1" ? "photo1" : slot === "photo2" ? "photo2" : "poster";
      setForm(f => ({ ...f, [key]: data.url }));
    }
    setUploading(u => ({ ...u, [slot]: false }));
  }

  async function removePhoto(slot: "photo1" | "photo2" | "poster") {
    const gigId = savedIdRef.current;
    if (!gigId) return;
    await fetch(`/api/gigs/journal/${gigId}/photo?slot=${slot}`, { method: "DELETE" });
    const key = slot === "photo1" ? "photo1" : slot === "photo2" ? "photo2" : "poster";
    setForm(f => ({ ...f, [key]: null }));
  }

  // ── Form view ───────────────────────────────────────────────────────────────

  if (view === "form") {
    const photosLocked = !savedId && !editGig;

    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 36 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 400, color: INK, margin: 0 }}>
            {editGig ? "Edit gig" : "Log a gig"}
          </h2>
          <button
            type="button" onClick={() => setView("timeline")}
            style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, background: "none", border: "none", cursor: "pointer" }}
          >← Back</button>
        </div>

        {/* ── Date + Artist(s) ── */}
        <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 148px" }}>
            <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Date *</label>
            <input
              type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "9px 10px", width: "100%", outline: "none", color: INK, background: "#fff" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Artist(s) *</label>
            {form.artists.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder={a.is_headliner ? "Headliner" : "Support act"}
                  value={a.name}
                  onChange={e => setForm(f => {
                    const ar = [...f.artists];
                    ar[i] = { ...ar[i], name: e.target.value };
                    return { ...f, artists: ar };
                  })}
                  style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "9px 10px", flex: 1, outline: "none", color: INK, background: "#fff" }}
                />
                {i > 0 && (
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, artists: f.artists.filter((_, j) => j !== i) }))}
                    style={{ fontFamily: MONO, fontSize: "11px", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                  >✕</button>
                )}
              </div>
            ))}
            <button type="button"
              onClick={() => setForm(f => ({ ...f, artists: [...f.artists, { name: "", is_headliner: false }] }))}
              style={{ fontFamily: MONO, fontSize: "8px", color: ORANGE, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 0", marginTop: 2 }}
            >+ Support act</button>
          </div>
        </div>

        {/* ── Venue + City ── */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Venue</label>
            <input type="text" placeholder="e.g. Sydney Opera House" value={form.venue}
              onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
              style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "9px 10px", width: "100%", outline: "none", color: INK, background: "#fff" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>City</label>
            <input type="text" placeholder="Sydney" value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "9px 10px", width: "100%", outline: "none", color: INK, background: "#fff" }}
            />
          </div>
        </div>

        {/* ── Journal ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>
            Your night
          </label>
          <textarea
            value={form.journal}
            onChange={e => setForm(f => ({ ...f, journal: e.target.value }))}
            placeholder="How was it? What do you remember? What made it special?"
            rows={5}
            style={{
              fontFamily: SERIF, fontSize: "14px", border: `1px solid ${BORDER}`,
              padding: "12px 14px", width: "100%", outline: "none", color: INK,
              background: "#fff", resize: "vertical", lineHeight: 1.65,
            }}
          />
        </div>

        {/* ── Rating ── */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 8 }}>Rating</label>
          <RatingDots value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} size={16} />
        </div>

        {/* ── Photos ── */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>
            Photos
            {photosLocked && (
              <span style={{ color: "#d0d0d0", marginLeft: 8, fontWeight: 400 }}>— save first to unlock</span>
            )}
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {(["photo1", "photo2", "poster"] as const).map((slot, i) => (
              <div key={slot} style={{ flex: 1, minWidth: 0, opacity: photosLocked ? 0.35 : 1 }}>
                <PhotoSlot
                  label={["Photo 1", "Photo 2", "Tour Poster"][i]}
                  url={slot === "photo1" ? form.photo1 : slot === "photo2" ? form.photo2 : form.poster}
                  disabled={photosLocked}
                  uploading={!!uploading[slot]}
                  onUpload={f => uploadPhoto(slot, f)}
                  onRemove={() => removePhoto(slot)}
                />
                <div style={{ fontFamily: MONO, fontSize: "7px", color: "#c8c8c8", textAlign: "center", marginTop: 4, letterSpacing: "0.05em" }}>
                  {["PHOTO 1", "PHOTO 2", "POSTER"][i]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Setlist.fm search ── */}
        <div style={{ marginBottom: 28, borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <label style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE }}>Setlist</label>
            {form.songs.length > 0 && (
              <span style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE }}>
                {form.songs.length} songs · {form.setlistSource === "setlist_fm" ? "setlist.fm" : "manual"}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button
              type="button" onClick={handleSetlistSearch} disabled={setlistSearching}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase",
                border: `1px solid ${BORDER}`, background: "#fff",
                color: setlistSearching ? SUBTLE : ORANGE,
                padding: "8px 14px", cursor: setlistSearching ? "default" : "pointer",
              }}
            >{setlistSearching ? "Searching…" : "Search Setlist.fm →"}</button>
            {setlistError && <span style={{ fontFamily: MONO, fontSize: "8px", color: "#cc2200" }}>{setlistError}</span>}
          </div>

          {/* Search results */}
          {setlistResults.length > 0 && (
            <div style={{ border: `1px solid ${BORDER}`, marginBottom: 12 }}>
              {setlistResults.map(r => (
                <div
                  key={r.id}
                  onClick={() => applySetlist(r)}
                  style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = LIGHT)}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                >
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: INK }}>{r.artistName} — {r.venueName}</div>
                  <div style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE, marginTop: 2 }}>
                    {r.city}{r.country ? `, ${r.country}` : ""} · {r.songs.length} songs · {r.eventDate}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chosen setlist preview */}
          {form.songs.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${BORDER}`, padding: "8px 12px", marginBottom: 12 }}>
              {form.songs.map((s, i) => (
                <div key={i} style={{
                  fontFamily: MONO, fontSize: "9px", color: INK, padding: "3px 0",
                  borderBottom: i < form.songs.length - 1 ? `1px solid #f4f4f0` : "none",
                  display: "flex", gap: 10,
                }}>
                  <span style={{ color: "#cccccc", minWidth: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1 }}>{s.title}</span>
                  {s.setLabel !== "Main Set" && <span style={{ color: SUBTLE }}>{s.setLabel}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Manual setlist */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: "8px", color: "#bbbbbb", marginBottom: 5 }}>
              Or enter manually — one song per line:
            </div>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder={"Creep\nKarma Police\nParanoid Android"}
              rows={3}
              style={{ fontFamily: MONO, fontSize: "10px", border: `1px solid ${BORDER}`, padding: "8px 10px", width: "100%", outline: "none", color: INK, resize: "vertical", background: "#fff" }}
            />
            <button type="button" onClick={applyManual}
              style={{ fontFamily: MONO, fontSize: "8px", color: ORANGE, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 0", marginTop: 2 }}
            >Apply manual setlist</button>
          </div>
        </div>

        {saveError && (
          <div style={{ fontFamily: MONO, fontSize: "9px", color: "#cc2200", marginBottom: 14 }}>{saveError}</div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button" onClick={handleSaveAndReturn} disabled={saving}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase",
              background: ORANGE, color: "#fff", border: "none",
              padding: "11px 28px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >{saving ? "Saving…" : savedId ? "Save changes" : "Save gig"}</button>
          {savedId && !saving && (
            <button type="button" onClick={() => saveGig()}
              style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, background: "none", border: `1px solid ${BORDER}`, padding: "11px 16px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}
            >Save draft</button>
          )}
          <button type="button" onClick={() => setView("timeline")}
            style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >Cancel</button>
        </div>

      </div>
    );
  }

  // ── Timeline view ───────────────────────────────────────────────────────────

  const grouped = groupByYear(gigs);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 400, color: INK, margin: "0 0 4px" }}>
            Gig Journal
          </h2>
          {!loading && gigs.length > 0 && (
            <div style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.05em" }}>
              {gigs.length} {gigs.length === 1 ? "concert" : "concerts"} logged
            </div>
          )}
        </div>
        <button
          type="button" onClick={openNew}
          style={{
            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase",
            color: ORANGE, background: "none", border: `1px solid ${ORANGE}`,
            padding: "8px 14px", cursor: "pointer",
          }}
        >+ Log a gig</button>
      </div>

      {loading && (
        <div style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE }}>Loading…</div>
      )}

      {!loading && gigs.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontFamily: SERIF, fontSize: "20px", color: SUBTLE, marginBottom: 10 }}>
            No gigs logged yet
          </div>
          <div style={{ fontFamily: MONO, fontSize: "9px", color: "#c0c0c0", marginBottom: 28, lineHeight: 1.7 }}>
            Start logging the concerts that shaped your music life.
          </div>
          <button
            type="button" onClick={openNew}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase",
              background: ORANGE, color: "#fff", border: "none", padding: "12px 24px", cursor: "pointer",
            }}
          >Log your first gig →</button>
        </div>
      )}

      {grouped.map(([year, yearGigs]) => (
        <div key={year} style={{ marginBottom: 40 }}>
          <div style={{
            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", color: ORANGE,
            textTransform: "uppercase", marginBottom: 14,
            paddingBottom: 10, borderBottom: `1px solid ${BORDER}`,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>{year}</span>
            <span style={{ color: SUBTLE }}>{yearGigs.length} {yearGigs.length === 1 ? "gig" : "gigs"}</span>
          </div>
          {yearGigs.map(gig => (
            <GigCard key={gig.id} gig={gig} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      ))}
    </div>
  );
}
