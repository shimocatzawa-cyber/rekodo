"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const SUBTLE = "#888888";
const BORDER = "#e8e8e0";
const LIGHT  = "#f5f3ee";

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
    day:   String(d),
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

function groupSongsBySet(songs: GigSong[]) {
  const sorted = [...songs].sort((a, b) => a.position - b.position);
  const sets: { label: string; songs: GigSong[] }[] = [];
  for (const s of sorted) {
    const last = sets[sets.length - 1];
    if (last && last.label === s.set_label) last.songs.push(s);
    else sets.push({ label: s.set_label, songs: [s] });
  }
  return sets;
}

// ── Rating dots ───────────────────────────────────────────────────────────────

function RatingDots({ value, onChange, size = 10 }: {
  value: number; onChange?: (v: number) => void; size?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(value === n ? 0 : n)}
          style={{
            width: size, height: size, borderRadius: "50%", padding: 0, flexShrink: 0,
            background: n <= value ? ORANGE : "transparent",
            border: `1.5px solid ${n <= value ? ORANGE : "#d0d0d0"}`,
            cursor: onChange ? "pointer" : "default",
          }} aria-label={`${n} of 5`}
        />
      ))}
    </div>
  );
}

// ── Photo upload slot ─────────────────────────────────────────────────────────

function PhotoSlot({ label, url, disabled, uploading, onUpload, onRemove, style: extraStyle }: {
  label: string; url: string | null; disabled: boolean;
  uploading: boolean; onUpload: (f: File) => void; onRemove: () => void;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ position: "relative", ...extraStyle }}>
      <div
        onClick={() => !url && !disabled && !uploading && inputRef.current?.click()}
        style={{
          width: "100%", height: "100%",
          border: url ? "none" : `1.5px dashed ${disabled ? "#eeeeee" : BORDER}`,
          background: url ? "transparent" : LIGHT,
          cursor: disabled || url ? "default" : "pointer",
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {!disabled && (
              <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
                style={{
                  position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)",
                  color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20,
                  cursor: "pointer", fontSize: "10px", lineHeight: "20px", padding: 0,
                }}>✕</button>
            )}
          </>
        ) : uploading ? (
          <span style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE }}>Uploading…</span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: "8px", color: disabled ? "#dddddd" : "#c0c0c0", textAlign: "center", padding: "0 8px" }}>{label}</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── Sidebar gig row ───────────────────────────────────────────────────────────

function GigRow({ gig, selected, onClick }: { gig: Gig; selected: boolean; onClick: () => void }) {
  const d = parseDateParts(gig.date);
  const headliner = gig.artists.find(a => a.is_headliner)?.artist_name ?? gig.artists[0]?.artist_name ?? "Unknown";
  const [hovered, setHovered] = useState(false);

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
        cursor: "pointer", borderBottom: `1px solid ${BORDER}`,
        background: selected ? LIGHT : hovered ? "#faf9f6" : "#fff",
        borderLeft: `3px solid ${selected ? ORANGE : "transparent"}`,
        transition: "background 0.1s",
      }}
    >
      <div style={{ flexShrink: 0, width: 30, textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: "20px", lineHeight: 1, color: selected ? ORANGE : INK, fontWeight: 600 }}>{d.day}</div>
        <div style={{ fontFamily: MONO, fontSize: "6.5px", letterSpacing: "0.08em", color: SUBTLE, marginTop: 1 }}>{d.month}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: SERIF, fontSize: "13px", color: selected ? ORANGE : INK,
          lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{headliner}</div>
        {(gig.venue || gig.city) && (
          <div style={{
            fontFamily: MONO, fontSize: "7.5px", color: "#b0b0b0", letterSpacing: "0.04em",
            marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{[gig.venue, gig.city].filter(Boolean).join(" · ")}</div>
        )}
      </div>
      {!!gig.rating && <RatingDots value={gig.rating} size={6} />}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function GigDetail({ gig, onEdit, onDelete }: {
  gig: Gig; onEdit: () => void; onDelete: () => void;
}) {
  const d = parseDateParts(gig.date);
  const headliners = gig.artists.filter(a => a.is_headliner).map(a => a.artist_name);
  const supports   = gig.artists.filter(a => !a.is_headliner).map(a => a.artist_name);
  const sets       = groupSongsBySet(gig.songs);
  const hasPhotos  = gig.photo_1_url || gig.photo_2_url || gig.poster_url;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const location = [gig.venue, gig.city, gig.country].filter(Boolean).join("  ·  ").toUpperCase();

  return (
    <div>

      {/* ── Hero ── */}
      <div style={{ padding: "40px 48px 36px", borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
        <div style={{ position: "absolute", top: 28, right: 40, display: "flex", gap: 12, alignItems: "center" }}>
          <button type="button" onClick={onEdit}
            style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, padding: "5px 12px", cursor: "pointer" }}
          >Edit</button>
          {confirmDelete ? (
            <button type="button" onClick={onDelete}
              style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#cc2200", border: "1px solid #cc2200", padding: "5px 12px", cursor: "pointer" }}
            >Confirm?</button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "5px 0" }}
            >Delete</button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 28 }}>
          {/* Huge date */}
          <div style={{ flexShrink: 0, lineHeight: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: "90px", lineHeight: 0.85, color: ORANGE, fontWeight: 700, letterSpacing: "-0.03em" }}>
              {d.day}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.14em", color: SUBTLE }}>{d.month}</div>
              <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", color: "#c0c0c0" }}>{d.year}</div>
            </div>
          </div>

          {/* Artist / meta */}
          <div style={{ paddingTop: 4, flex: 1 }}>
            <div style={{
              fontFamily: SERIF, fontWeight: 700, letterSpacing: "-0.01em",
              fontSize: "clamp(22px, 3vw, 36px)", lineHeight: 1.05, color: INK, marginBottom: 6,
            }}>
              {headliners.join(" & ") || "Unknown Artist"}
            </div>
            {supports.length > 0 && (
              <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: SUBTLE, marginBottom: 10 }}>
                w/ {supports.join(", ")}
              </div>
            )}
            {location && (
              <div style={{ fontFamily: MONO, fontSize: "8.5px", letterSpacing: "0.12em", color: "#aaaaaa", marginBottom: 14 }}>
                {location}
              </div>
            )}
            {!!gig.rating && <RatingDots value={gig.rating} size={11} />}
          </div>
        </div>
      </div>

      {/* ── Photos ── */}
      {hasPhotos && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", padding: "0", overflow: "hidden" }}>
          {gig.photo_1_url && (
            <div style={{ flex: "0 0 44%", height: 240, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gig.photo_1_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
          {gig.photo_2_url && (
            <div style={{ flex: "0 0 32%", height: 190, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gig.photo_2_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
          {gig.poster_url && (
            <div style={{ flex: 1, height: 260, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gig.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
        </div>
      )}

      {/* ── Body: journal + setlist ── */}
      <div style={{
        display: "flex", gap: 0, alignItems: "flex-start",
        borderTop: hasPhotos ? `1px solid ${BORDER}` : "none",
      }}>

        {/* Journal */}
        {gig.journal_entry && (
          <div style={{
            flex: sets.length > 0 ? "0 0 58%" : 1,
            padding: "36px 40px 48px 48px",
            borderRight: sets.length > 0 ? `1px solid ${BORDER}` : "none",
          }}>
            <div style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#c0c0c0", marginBottom: 16 }}>
              Notes
            </div>
            <div style={{
              fontFamily: SERIF, fontSize: "16px", lineHeight: 1.75, color: INK,
              fontStyle: "italic",
            }}>
              {gig.journal_entry}
            </div>
          </div>
        )}

        {/* Setlist */}
        {sets.length > 0 && (
          <div style={{
            flex: gig.journal_entry ? 1 : "0 0 340px",
            padding: "36px 40px 48px",
            maxWidth: gig.journal_entry ? undefined : 340,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#c0c0c0" }}>
                Setlist
              </span>
              {gig.setlist_fm_id && (
                <a href={`https://www.setlist.fm/setlist/${gig.setlist_fm_id}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: MONO, fontSize: "7.5px", color: "#c0c0c0", letterSpacing: "0.06em", textDecoration: "none" }}>
                  setlist.fm ↗
                </a>
              )}
            </div>
            {sets.map((set, si) => (
              <div key={si} style={{ marginBottom: si < sets.length - 1 ? 20 : 0 }}>
                {set.label !== "Main Set" && (
                  <div style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
                    {set.label}
                  </div>
                )}
                {set.songs.map(s => (
                  <div key={s.id} style={{ display: "flex", gap: 12, padding: "4px 0", borderBottom: `1px solid #f2f1ed`, alignItems: "baseline" }}>
                    <span style={{ fontFamily: MONO, fontSize: "8px", color: "#c8c8c8", minWidth: 20, flexShrink: 0 }}>
                      {String(s.position).padStart(2, "0")}
                    </span>
                    <span style={{ fontFamily: SERIF, fontSize: "13.5px", color: INK, lineHeight: 1.4 }}>{s.song_title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Neither journal nor setlist */}
        {!gig.journal_entry && sets.length === 0 && (
          <div style={{ padding: "32px 48px", fontFamily: MONO, fontSize: "9px", color: "#cccccc" }}>
            No notes or setlist yet.
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 64 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GigJournalTab() {
  const [gigs, setGigs]         = useState<Gig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Gig | null>(null);
  const [view, setView]         = useState<"detail" | "form">("detail");

  const [editGig, setEditGig]     = useState<Gig | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [setlistSearching, setSetlistSearching] = useState(false);
  const [setlistResults, setSetlistResults]     = useState<SetlistResult[]>([]);
  const [setlistError, setSetlistError]         = useState<string | null>(null);
  const [manualText, setManualText]             = useState("");

  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const savedIdRef = useRef<string | null>(null);
  savedIdRef.current = savedId;

  const loadGigs = useCallback(async (selectId?: string) => {
    setLoading(true);
    const res  = await fetch("/api/gigs/journal");
    const data = await res.json();
    const list: Gig[] = data.gigs ?? [];
    setGigs(list);
    setLoading(false);
    if (selectId) {
      setSelected(list.find(g => g.id === selectId) ?? null);
    } else {
      setSelected(prev => prev ? (list.find(g => g.id === prev.id) ?? null) : null);
    }
  }, []);

  useEffect(() => { loadGigs(); }, [loadGigs]);

  function openNew() {
    setEditGig(null); setSavedId(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setSetlistResults([]); setSetlistError(null); setManualText(""); setSaveError(null);
    setView("form");
  }

  function openEdit(gig: Gig) {
    setEditGig(gig); setSavedId(gig.id);
    const sorted = [...gig.songs].sort((a, b) => a.position - b.position);
    setForm({
      date: gig.date,
      artists: gig.artists.length > 0
        ? gig.artists.map(a => ({ name: a.artist_name, is_headliner: a.is_headliner }))
        : [{ name: "", is_headliner: true }],
      venue:   gig.venue   ?? "", city:    gig.city    ?? "", country: gig.country ?? "",
      journal: gig.journal_entry ?? "", rating:  gig.rating  ?? 0,
      songs:   sorted.map(s => ({ title: s.song_title, setLabel: s.set_label })),
      setlistSource: gig.setlist_source, setlistFmId: gig.setlist_fm_id ?? "",
      photo1: gig.photo_1_url, photo2: gig.photo_2_url, poster: gig.poster_url,
    });
    setManualText(sorted.map(s => s.song_title).join("\n"));
    setSetlistResults([]); setSetlistError(null); setSaveError(null);
    setView("form");
  }

  async function handleDelete(gig: Gig) {
    await fetch(`/api/gigs/journal/${gig.id}`, { method: "DELETE" });
    setGigs(g => g.filter(x => x.id !== gig.id));
    setSelected(null);
  }

  async function saveGig(): Promise<string | null> {
    if (!form.date) { setSaveError("Date is required."); return null; }
    const validArtists = form.artists.filter(a => a.name.trim());
    if (!validArtists.length) { setSaveError("At least one artist is required."); return null; }
    setSaving(true); setSaveError(null);

    const body = {
      date: form.date, venue: form.venue || null, city: form.city || null,
      country: form.country || null, journal_entry: form.journal || null,
      rating: form.rating || null, setlist_fm_id: form.setlistFmId || null,
      setlist_source: form.setlistSource,
      photo_1_url: form.photo1, photo_2_url: form.photo2, poster_url: form.poster,
      artists: validArtists.map(a => ({ name: a.name.trim(), is_headliner: a.is_headliner })),
      songs:   form.songs.filter(s => s.title.trim()),
    };

    const existingId = savedIdRef.current ?? editGig?.id ?? null;
    let gigId = existingId;

    if (!gigId) {
      const res  = await fetch("/api/gigs/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d    = await res.json();
      if (!res.ok) { setSaveError(d.error ?? "Save failed"); setSaving(false); return null; }
      gigId = d.id; setSavedId(gigId);
    } else {
      const res = await fetch(`/api/gigs/journal/${gigId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed"); setSaving(false); return null; }
    }

    setSaving(false);
    return gigId;
  }

  async function handleSaveAndReturn() {
    const id = await saveGig();
    if (!id) return;
    await loadGigs(id);
    setView("detail");
  }

  async function handleSetlistSearch() {
    const artist = form.artists.find(a => a.is_headliner)?.name?.trim() || form.artists[0]?.name?.trim();
    if (!artist || !form.date) { setSetlistError("Enter artist and date first."); return; }
    setSetlistSearching(true); setSetlistError(null); setSetlistResults([]);
    try {
      const res  = await fetch(`/api/gigs/setlist-search?artist=${encodeURIComponent(artist)}&date=${form.date}`);
      const data = await res.json();
      if (!res.ok) { setSetlistError(data.error ?? "Search failed"); return; }
      if (!data.results?.length) { setSetlistError("No setlists found. Try a slightly different name."); return; }
      setSetlistResults(data.results);
    } finally { setSetlistSearching(false); }
  }

  function applySetlist(r: SetlistResult) {
    setForm(f => ({ ...f, setlistFmId: r.id, setlistSource: "setlist_fm", songs: r.songs, venue: f.venue || r.venueName, city: f.city || r.city }));
    setSetlistResults([]);
    setManualText(r.songs.map(s => s.title).join("\n"));
  }

  function applyManual() {
    const songs = manualText.split("\n").map(l => l.trim()).filter(Boolean).map(title => ({ title, setLabel: "Main Set" }));
    setForm(f => ({ ...f, songs, setlistSource: songs.length > 0 ? "manual" : "none", setlistFmId: "" }));
  }

  async function uploadPhoto(slot: "photo1" | "photo2" | "poster", file: File) {
    let gigId = savedIdRef.current;
    if (!gigId) { gigId = await saveGig(); if (!gigId) return; }
    setUploading(u => ({ ...u, [slot]: true }));
    const fd = new FormData();
    fd.append("file", file); fd.append("slot", slot);
    const res  = await fetch(`/api/gigs/journal/${gigId}/photo`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.url) setForm(f => ({ ...f, [slot]: data.url }));
    setUploading(u => ({ ...u, [slot]: false }));
  }

  async function removePhoto(slot: "photo1" | "photo2" | "poster") {
    const gigId = savedIdRef.current;
    if (!gigId) return;
    await fetch(`/api/gigs/journal/${gigId}/photo?slot=${slot}`, { method: "DELETE" });
    setForm(f => ({ ...f, [slot]: null }));
  }

  const grouped = groupByYear(gigs);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "calc(100vh - 114px)", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 256, flexShrink: 0, borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", background: "#fff",
      }}>
        <div style={{ padding: "14px 14px 12px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button type="button" onClick={openNew}
            style={{
              width: "100%", fontFamily: MONO, fontSize: "8.5px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: ORANGE, background: "none",
              border: `1px solid ${ORANGE}`, padding: "9px 0", cursor: "pointer",
            }}>+ Log a gig</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && <div style={{ padding: "18px 14px", fontFamily: MONO, fontSize: "8px", color: "#cccccc" }}>Loading…</div>}
          {!loading && gigs.length === 0 && (
            <div style={{ padding: "20px 14px", fontFamily: MONO, fontSize: "8px", color: "#cccccc", lineHeight: 1.7 }}>No gigs logged yet.</div>
          )}
          {grouped.map(([year, yearGigs]) => (
            <div key={year}>
              <div style={{
                padding: "7px 14px 5px", fontFamily: MONO, fontSize: "7.5px",
                letterSpacing: "0.12em", color: ORANGE, background: "#faf9f6",
                borderBottom: `1px solid ${BORDER}`,
              }}>{year}</div>
              {yearGigs.map(gig => (
                <GigRow key={gig.id} gig={gig}
                  selected={selected?.id === gig.id && view === "detail"}
                  onClick={() => { setSelected(gig); setView("detail"); }}
                />
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "#fff", minWidth: 0 }}>

        {view === "detail" && !selected && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: SERIF, fontSize: "20px", color: "#d8d5d0" }}>
              {gigs.length === 0 && !loading ? "Log your first gig" : "Select a gig"}
            </div>
            {gigs.length === 0 && !loading && (
              <button type="button" onClick={openNew}
                style={{ fontFamily: MONO, fontSize: "8.5px", letterSpacing: "0.1em", textTransform: "uppercase", background: ORANGE, color: "#fff", border: "none", padding: "10px 22px", cursor: "pointer", marginTop: 6 }}
              >Get started →</button>
            )}
          </div>
        )}

        {view === "detail" && selected && (
          <GigDetail gig={selected} onEdit={() => openEdit(selected)} onDelete={() => handleDelete(selected)} />
        )}

        {view === "form" && (
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "36px 32px 80px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 30 }}>
              <div style={{ fontFamily: SERIF, fontSize: "18px", color: INK }}>
                {editGig ? "Edit gig" : "Log a gig"}
              </div>
              <button type="button" onClick={() => setView("detail")}
                style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE, background: "none", border: "none", cursor: "pointer" }}
              >← Cancel</button>
            </div>

            {/* Date + Artists */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 138px" }}>
                <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "8px 10px", width: "100%", outline: "none", color: INK, background: "#fff" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Artist(s) *</label>
                {form.artists.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "center" }}>
                    <input type="text" placeholder={a.is_headliner ? "Headliner" : "Support act"} value={a.name}
                      onChange={e => setForm(f => { const ar = [...f.artists]; ar[i] = { ...ar[i], name: e.target.value }; return { ...f, artists: ar }; })}
                      style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "8px 10px", flex: 1, outline: "none", color: INK, background: "#fff" }}
                    />
                    {i > 0 && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, artists: f.artists.filter((_, j) => j !== i) }))}
                        style={{ fontFamily: MONO, fontSize: "11px", color: "#cccccc", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setForm(f => ({ ...f, artists: [...f.artists, { name: "", is_headliner: false }] }))}
                  style={{ fontFamily: MONO, fontSize: "7.5px", color: ORANGE, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 0" }}
                >+ Support act</button>
              </div>
            </div>

            {/* Venue + City */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Venue</label>
                <input type="text" placeholder="Venue name" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "8px 10px", width: "100%", outline: "none", color: INK, background: "#fff" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>City</label>
                <input type="text" placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  style={{ fontFamily: MONO, fontSize: "11px", border: `1px solid ${BORDER}`, padding: "8px 10px", width: "100%", outline: "none", color: INK, background: "#fff" }}
                />
              </div>
            </div>

            {/* Journal */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 5 }}>Your night</label>
              <textarea value={form.journal} onChange={e => setForm(f => ({ ...f, journal: e.target.value }))}
                placeholder="How was it? What do you remember?" rows={5}
                style={{ fontFamily: SERIF, fontSize: "14px", border: `1px solid ${BORDER}`, padding: "10px 12px", width: "100%", outline: "none", color: INK, background: "#fff", resize: "vertical", lineHeight: 1.65 }}
              />
            </div>

            {/* Rating */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 8 }}>Rating</label>
              <RatingDots value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} size={15} />
            </div>

            {/* Photos */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, display: "block", marginBottom: 6 }}>
                Photos {!savedId && <span style={{ color: "#d0d0d0" }}>— save first to upload</span>}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["photo1", "photo2", "poster"] as const).map((slot, i) => (
                  <div key={slot} style={{ flex: 1, opacity: !savedId ? 0.35 : 1 }}>
                    <PhotoSlot label={["Photo 1", "Photo 2", "Poster"][i]} url={form[slot]}
                      disabled={!savedId} uploading={!!uploading[slot]}
                      onUpload={f => uploadPhoto(slot, f)} onRemove={() => removePhoto(slot)}
                      style={{ height: 80 }}
                    />
                    <div style={{ fontFamily: MONO, fontSize: "7px", color: "#c0c0c0", textAlign: "center", marginTop: 3, letterSpacing: "0.05em" }}>
                      {["PHOTO 1", "PHOTO 2", "POSTER"][i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Setlist */}
            <div style={{ marginBottom: 24, borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <label style={{ fontFamily: MONO, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE }}>Setlist</label>
                {form.songs.length > 0 && <span style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE }}>{form.songs.length} songs</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <button type="button" onClick={handleSetlistSearch} disabled={setlistSearching}
                  style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", border: `1px solid ${BORDER}`, background: "#fff", color: setlistSearching ? SUBTLE : ORANGE, padding: "7px 12px", cursor: setlistSearching ? "default" : "pointer" }}
                >{setlistSearching ? "Searching…" : "Search Setlist.fm →"}</button>
                {setlistError && <span style={{ fontFamily: MONO, fontSize: "8px", color: "#cc2200" }}>{setlistError}</span>}
              </div>

              {setlistResults.length > 0 && (
                <div style={{ border: `1px solid ${BORDER}`, marginBottom: 10 }}>
                  {setlistResults.map(r => (
                    <div key={r.id} onClick={() => applySetlist(r)} style={{ padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = LIGHT)}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                    >
                      <div style={{ fontFamily: MONO, fontSize: "10px", color: INK }}>{r.artistName} — {r.venueName}</div>
                      <div style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE, marginTop: 2 }}>{r.city} · {r.songs.length} songs</div>
                    </div>
                  ))}
                </div>
              )}

              {form.songs.length > 0 && (
                <div style={{ maxHeight: 130, overflowY: "auto", border: `1px solid ${BORDER}`, padding: "6px 10px", marginBottom: 10 }}>
                  {form.songs.map((s, i) => (
                    <div key={i} style={{ fontFamily: MONO, fontSize: "9px", color: INK, padding: "3px 0", borderBottom: i < form.songs.length - 1 ? `1px solid #f4f4f0` : "none", display: "flex", gap: 10 }}>
                      <span style={{ color: "#cccccc", minWidth: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontFamily: MONO, fontSize: "7.5px", color: "#b8b8b8", marginBottom: 5 }}>Or enter manually — one song per line:</div>
              <textarea value={manualText} onChange={e => setManualText(e.target.value)}
                placeholder={"Creep\nKarma Police\nParanoid Android"} rows={3}
                style={{ fontFamily: MONO, fontSize: "10px", border: `1px solid ${BORDER}`, padding: "7px 9px", width: "100%", outline: "none", color: INK, resize: "vertical", background: "#fff" }}
              />
              <button type="button" onClick={applyManual}
                style={{ fontFamily: MONO, fontSize: "7.5px", color: ORANGE, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 0", marginTop: 3 }}
              >Apply manual setlist</button>
            </div>

            {saveError && <div style={{ fontFamily: MONO, fontSize: "9px", color: "#cc2200", marginBottom: 12 }}>{saveError}</div>}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="button" onClick={handleSaveAndReturn} disabled={saving}
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: ORANGE, color: "#fff", border: "none", padding: "10px 24px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
              >{saving ? "Saving…" : savedId ? "Save changes" : "Save gig"}</button>
              {savedId && !saving && (
                <button type="button" onClick={() => saveGig()}
                  style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE, background: "none", border: `1px solid ${BORDER}`, padding: "10px 14px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}
                >Save draft</button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
