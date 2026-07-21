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
  highlight_moment: string | null; highlight_best_song: string | null; highlight_sound: string | null;
  start_time: string | null; duration: string | null;
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
  startTime: string; duration: string;
  highlightMoment: string; highlightBestSong: string; highlightSound: string;
};

const EMPTY_FORM: FormState = {
  date: "", artists: [{ name: "", is_headliner: true }],
  venue: "", city: "", country: "", journal: "", rating: 0,
  songs: [], setlistSource: "none", setlistFmId: "",
  photo1: null, photo2: null, poster: null,
  startTime: "", duration: "",
  highlightMoment: "", highlightBestSong: "", highlightSound: "",
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

function RatingStars({ value, onChange, size = 14 }: {
  value: number; onChange?: (v: number) => void; size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  const display = onChange ? (hovered || value) : value;
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onClick={() => onChange?.(value === n ? 0 : n)}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          style={{
            fontSize: size, lineHeight: 1, padding: 0, background: "none", border: "none",
            cursor: onChange ? "pointer" : "default",
            color: n <= display ? ORANGE : "#d8d5d0",
            transition: "color 0.1s",
          }} aria-label={`${n} of 5`}
        >★</button>
      ))}
    </div>
  );
}
// Keep alias used in sidebar rows
const RatingDots = ({ value, size = 10 }: { value: number; size?: number }) =>
  <RatingStars value={value} size={size} />;

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
        <div style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", color: SUBTLE, marginTop: 1 }}>{d.month}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: SERIF, fontSize: "13px", color: selected ? ORANGE : INK,
          lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{headliner}</div>
        {(gig.venue || gig.city) && (
          <div style={{
            fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.04em",
            marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{[gig.venue, gig.city].filter(Boolean).join(" · ")}</div>
        )}
      </div>
      {!!gig.rating && <RatingDots value={gig.rating} size={7} />}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function GigDetail({ gig, onEdit, onDelete, timesSeen, onUploadPhoto }: {
  gig: Gig; onEdit: () => void; onDelete: () => void;
  timesSeen: number;
  onUploadPhoto: (slot: "photo1" | "photo2" | "poster", file: File) => Promise<void>;
}) {
  const d = parseDateParts(gig.date);
  const headliners = gig.artists.filter(a => a.is_headliner).map(a => a.artist_name);
  const supports   = gig.artists.filter(a => !a.is_headliner).map(a => a.artist_name);
  const sets       = groupSongsBySet(gig.songs);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxUrl, setLightboxUrl]     = useState<string | null>(null);
  const [editingField, setEditingField]   = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);

  const [notesValue,   setNotesValue]   = useState(gig.journal_entry       ?? "");
  const [momentValue,  setMomentValue]  = useState(gig.highlight_moment    ?? "");
  const [bestSongValue, setBestSongValue] = useState(gig.highlight_best_song ?? "");
  const [soundValue,   setSoundValue]   = useState(gig.highlight_sound     ?? "");

  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({});
  const p1Ref = useRef<HTMLInputElement>(null);
  const p2Ref = useRef<HTMLInputElement>(null);
  const p3Ref = useRef<HTMLInputElement>(null);
  const photoRefs = { photo1: p1Ref, photo2: p2Ref, poster: p3Ref };

  useEffect(() => {
    setNotesValue(gig.journal_entry       ?? "");
    setMomentValue(gig.highlight_moment   ?? "");
    setBestSongValue(gig.highlight_best_song ?? "");
    setSoundValue(gig.highlight_sound     ?? "");
  }, [gig.id]);

  async function saveFields(updates: Record<string, string | null>) {
    setSaving(true);
    await fetch(`/api/gigs/journal/${gig.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: gig.date, venue: gig.venue, city: gig.city, country: gig.country,
        journal_entry: notesValue || null, rating: gig.rating,
        setlist_fm_id: gig.setlist_fm_id, setlist_source: gig.setlist_source,
        photo_1_url: gig.photo_1_url, photo_2_url: gig.photo_2_url, poster_url: gig.poster_url,
        highlight_moment: momentValue || null,
        highlight_best_song: bestSongValue || null,
        highlight_sound: soundValue || null,
        start_time: gig.start_time || null,
        duration: gig.duration || null,
        ...updates,
      }),
    }).finally(() => setSaving(false));
  }

  async function handlePhotoUpload(slot: "photo1" | "photo2" | "poster", file: File) {
    setPhotoUploading(u => ({ ...u, [slot]: true }));
    await onUploadPhoto(slot, file).finally(() => setPhotoUploading(u => ({ ...u, [slot]: false })));
  }

  const photoSlots: { slot: "photo1" | "photo2" | "poster"; url: string | null }[] = [
    { slot: "photo1", url: gig.photo_1_url },
    { slot: "photo2", url: gig.photo_2_url },
    { slot: "poster", url: gig.poster_url },
  ];
  const heroPhoto = photoSlots[0].url ?? null;
  const heroRight = photoSlots[1].url ?? null;

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]) + " time";
  };

  type InfoChip = { icon: React.ReactNode; label: string; value: string };
  const infoChips: InfoChip[] = [];
  const Ic = ({ d: path, ...p }: { d: string; [k: string]: string }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} {...p} />
    </svg>
  );
  infoChips.push({ label: "DATE", value: `${d.day} ${d.month} ${d.year}`, icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ) });
  const venue = [gig.venue, gig.city].filter(Boolean).join(", ");
  if (venue) infoChips.push({ label: "VENUE", value: venue, icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ) });
  if (supports.length > 0) infoChips.push({ label: "SUPPORT", value: supports.join(", "), icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ) });
  if (gig.start_time) infoChips.push({ label: "START TIME", value: gig.start_time, icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ) });
  if (gig.duration) infoChips.push({ label: "DURATION", value: gig.duration, icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
    </svg>
  ) });
  if (gig.songs.length > 0) infoChips.push({ label: "SONGS", value: String(gig.songs.length), icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  ) });
  if (timesSeen > 0) infoChips.push({ label: "TIMES SEEN", value: ordinal(timesSeen), icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) });
  void Ic;

  return (
    <div>

      {/* ── HERO (with top buffer) ── */}
      <div style={{ position: "relative", display: "flex", height: 380, overflow: "hidden", borderTop: `4px solid #fff` }}>

        {/* Left: main photo with overlay */}
        <div style={{ flex: heroRight ? "0 0 55%" : "1", position: "relative", overflow: "hidden", background: "#111" }}>
          {heroPhoto && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={heroPhoto} alt="" onClick={() => setLightboxUrl(heroPhoto)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "zoom-in" }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.04) 100%)", pointerEvents: "none" }} />
          {/* Artist name + support + venue + rating */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 28px 26px" }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(28px, 3vw, 48px)", lineHeight: 1.05, color: "#fff", marginBottom: 7 }}>
              {headliners.join(" & ") || "Unknown Artist"}
            </div>
            {supports.length > 0 && (
              <div style={{ fontFamily: SERIF, fontSize: 14, color: "rgba(255,255,255,0.72)", marginBottom: 5 }}>
                w/ {supports.join(", ")}
              </div>
            )}
            {(gig.venue || gig.city) && (
              <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)", marginBottom: 13, textTransform: "uppercase" }}>
                {[gig.venue, gig.city].filter(Boolean).join(", ")}
              </div>
            )}
            {!!gig.rating && <RatingStars value={gig.rating} size={16} />}
          </div>
        </div>

        {/* Right: second photo */}
        {heroRight ? (
          <div style={{ flex: "0 0 45%", position: "relative", overflow: "hidden", background: LIGHT }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroRight} alt="" onClick={() => setLightboxUrl(heroRight)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "zoom-in" }}
            />
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, alignItems: "center", zIndex: 10 }}>
              <button type="button" onClick={onEdit} style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(0,0,0,0.18)", padding: "5px 11px", cursor: "pointer" }}>Edit</button>
              {confirmDelete
                ? <button type="button" onClick={onDelete} style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#cc2200", border: "none", padding: "5px 11px", cursor: "pointer" }}>Confirm?</button>
                : <button type="button" onClick={() => setConfirmDelete(true)} style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", background: "rgba(255,255,255,0.75)", border: "none", cursor: "pointer", padding: "5px 8px" }}>Delete</button>
              }
            </div>
          </div>
        ) : (
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, alignItems: "center", zIndex: 10 }}>
            <button type="button" onClick={onEdit} style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "rgba(255,255,255,0.9)", border: `1px solid ${ORANGE}`, padding: "5px 11px", cursor: "pointer" }}>Edit</button>
            {confirmDelete
              ? <button type="button" onClick={onDelete} style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#cc2200", border: "none", padding: "5px 11px", cursor: "pointer" }}>Confirm?</button>
              : <button type="button" onClick={() => setConfirmDelete(true)} style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer", padding: "5px 8px" }}>Delete</button>
            }
          </div>
        )}
      </div>

      {/* ── INFO BAR ── */}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: `1px solid ${BORDER}`, overflowX: "auto" }}>
        {infoChips.map((chip, i) => (
          <div key={i} style={{ padding: "16px 28px", borderRight: i < infoChips.length - 1 ? `1px solid ${BORDER}` : "none", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ color: SUBTLE, flexShrink: 0 }}>{chip.icon}</div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE, marginBottom: 4 }}>{chip.label}</div>
              <div style={{ fontFamily: MONO, fontSize: "11px", color: INK }}>{chip.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── BODY: two columns ── */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>

        {/* Left: Notes + Highlights + Photos */}
        <div style={{ flex: "0 0 58%", borderRight: `1px solid ${BORDER}` }}>

          {/* Notes */}
          <div style={{ padding: "32px 36px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE }}>Notes</div>
              {saving && <span style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa" }}>saving…</span>}
            </div>
            {editingField === "notes" ? (
              <textarea autoFocus value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                onBlur={() => { setEditingField(null); saveFields({ journal_entry: notesValue || null }); }}
                onKeyDown={e => { if (e.key === "Escape") { setEditingField(null); saveFields({ journal_entry: notesValue || null }); } }}
                rows={5}
                style={{ fontFamily: SERIF, fontSize: "17px", lineHeight: 1.8, color: INK, fontStyle: "italic", width: "100%", border: "none", outline: "none", resize: "vertical", background: "transparent", padding: 0 }}
              />
            ) : (
              <div onClick={() => setEditingField("notes")}
                style={{ fontFamily: SERIF, fontSize: "17px", lineHeight: 1.8, fontStyle: "italic", cursor: "text", minHeight: 28 }}>
                {notesValue ? (
                  <span style={{ color: INK }}>
                    <span style={{ color: ORANGE }}>&ldquo;</span>{notesValue}<span style={{ color: ORANGE }}>&rdquo;</span>
                  </span>
                ) : (
                  <span style={{ color: "#bbb" }}>Click to add notes…</span>
                )}
              </div>
            )}
          </div>

          {/* Highlights */}
          <div style={{ padding: "28px 36px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE, marginBottom: 16 }}>Highlights</div>
            <div style={{ display: "flex", gap: 10 }}>
              {([
                { key: "moment",   label: "Favourite Moment", value: momentValue,   set: setMomentValue,   field: "highlight_moment" },
                { key: "bestSong", label: "Best Song",        value: bestSongValue, set: setBestSongValue, field: "highlight_best_song" },
                { key: "sound",    label: "Sound",            value: soundValue,    set: setSoundValue,    field: "highlight_sound" },
              ] as { key: string; label: string; value: string; set: (v: string) => void; field: string }[]).map(card => (
                <div key={card.key}
                  onClick={() => editingField !== card.key && setEditingField(card.key)}
                  style={{ flex: 1, border: `1px solid ${BORDER}`, padding: "14px 14px 12px", minHeight: 90, cursor: "text" }}>
                  <div style={{ fontFamily: MONO, fontSize: "7.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, marginBottom: 10 }}>{card.label}</div>
                  {editingField === card.key ? (
                    <textarea autoFocus value={card.value}
                      onChange={e => card.set(e.target.value)}
                      onBlur={() => { setEditingField(null); saveFields({ [card.field]: card.value || null }); }}
                      onKeyDown={e => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); setEditingField(null); saveFields({ [card.field]: card.value || null }); } }}
                      rows={3}
                      style={{ fontFamily: SERIF, fontSize: "13px", lineHeight: 1.6, color: INK, width: "100%", border: "none", outline: "none", resize: "none", background: "transparent", padding: 0 }}
                    />
                  ) : (
                    <div style={{ fontFamily: SERIF, fontSize: "13px", lineHeight: 1.6, color: card.value ? INK : "#ccc" }}>
                      {card.value || "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Photos — 3 slots always shown */}
          <div style={{ padding: "28px 36px 40px" }}>
            <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE, marginBottom: 16 }}>Photos</div>
            <div style={{ display: "flex", gap: 8 }}>
              {photoSlots.map(({ slot, url }) => (
                <div key={slot} style={{ flexShrink: 0 }}>
                  <input ref={photoRefs[slot]} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(slot, f); e.target.value = ""; }}
                  />
                  {url ? (
                    <div style={{ width: 100, height: 100, overflow: "hidden", background: LIGHT, position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" onClick={() => setLightboxUrl(url)}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "zoom-in" }} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => photoRefs[slot].current?.click()} disabled={!!photoUploading[slot]}
                      style={{ width: 100, height: 100, background: LIGHT, border: `1.5px dashed ${BORDER}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {photoUploading[slot] ? (
                        <span style={{ fontFamily: MONO, fontSize: "8px", color: SUBTLE }}>Uploading…</span>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SUBTLE} strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <span style={{ fontFamily: MONO, fontSize: "7.5px", color: SUBTLE, letterSpacing: "0.05em", textTransform: "uppercase" }}>Add photo</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Setlist */}
        <div style={{ flex: 1, padding: "32px 32px 64px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE }}>Setlist</div>
            {gig.setlist_fm_id && (
              <a href={`https://www.setlist.fm/setlist/${gig.setlist_fm_id}`} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.06em", textDecoration: "none" }}>
                setlist.fm ↗
              </a>
            )}
          </div>
          {sets.length > 0 ? (
            <>
              {sets.map((set, si) => (
                <div key={si} style={{ marginBottom: si < sets.length - 1 ? 20 : 0 }}>
                  {set.label !== "Main Set" && (
                    <div style={{ fontFamily: MONO, fontSize: "8.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
                      {set.label}
                    </div>
                  )}
                  {set.songs.map(s => (
                    <div key={s.id} style={{ display: "flex", gap: 14, padding: "9px 0", borderBottom: `1px solid #f0ede8`, alignItems: "baseline" }}>
                      <span style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", minWidth: 22, flexShrink: 0 }}>
                        {String(s.position).padStart(2, "0")}
                      </span>
                      <span style={{ fontFamily: SERIF, fontSize: "14px", color: INK, lineHeight: 1.4 }}>{s.song_title}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE, marginTop: 20, letterSpacing: "0.04em" }}>
                Total songs: {gig.songs.length}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE }}>
              No setlist yet —{" "}
              <button type="button" onClick={onEdit} style={{ fontFamily: MONO, fontSize: "10px", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                add one →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain", display: "block" }} />
        </div>
      )}
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
      startTime: gig.start_time ?? "", duration: gig.duration ?? "",
      highlightMoment: gig.highlight_moment ?? "", highlightBestSong: gig.highlight_best_song ?? "", highlightSound: gig.highlight_sound ?? "",
    });
    setManualText(sorted.map(s => s.song_title).join("\n"));
    setSetlistResults([]); setSetlistError(null); setSaveError(null);
    setView("form");
  }

  async function detailUploadPhoto(gigId: string, slot: "photo1" | "photo2" | "poster", file: File) {
    const fd = new FormData();
    fd.append("file", file); fd.append("slot", slot);
    const res  = await fetch(`/api/gigs/journal/${gigId}/photo`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.url) await loadGigs(gigId);
  }

  function computeTimesSeen(gig: Gig): number {
    const headliner = gig.artists.find(a => a.is_headliner)?.artist_name?.toLowerCase();
    if (!headliner) return 1;
    const matching = gigs
      .filter(g => g.artists.some(a => a.is_headliner && a.artist_name.toLowerCase() === headliner))
      .sort((a, b) => a.date.localeCompare(b.date));
    return matching.findIndex(g => g.id === gig.id) + 1;
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
          {loading && <div style={{ padding: "18px 14px", fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>Loading…</div>}
          {!loading && gigs.length === 0 && (
            <div style={{ padding: "20px 14px", fontFamily: MONO, fontSize: "9px", color: SUBTLE, lineHeight: 1.7 }}>No gigs logged yet.</div>
          )}
          {grouped.map(([year, yearGigs]) => (
            <div key={year}>
              <div style={{
                padding: "7px 14px 5px", fontFamily: MONO, fontSize: "9px",
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
          <GigDetail gig={selected} onEdit={() => openEdit(selected)} onDelete={() => handleDelete(selected)}
            timesSeen={computeTimesSeen(selected)}
            onUploadPhoto={(slot, file) => detailUploadPhoto(selected.id, slot, file)}
          />
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
              <RatingStars value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} size={20} />
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
