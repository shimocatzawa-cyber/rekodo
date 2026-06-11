"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { setListRecord, removeListItem } from "@/app/lists/actions";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EditorSlot = {
  position:  number;
  recordId:  string | null;
  coverUrl:  string | null;
  artist:    string | null;
  album:     string | null;
};

type SearchResult = {
  id:        string;
  artist:    string;
  album:     string;
  cover_url: string | null;
};

interface Props {
  listId:       string;
  listTitle:    string;
  initialSlots: EditorSlot[];
  onClose:      () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Top5Editor({ listId, listTitle, initialSlots, onClose }: Props) {
  const [slots,        setSlots]        = useState<EditorSlot[]>(
    Array.from({ length: 5 }, (_, i) => {
      const pos  = i + 1;
      const init = initialSlots.find(s => s.position === pos);
      return init ?? { position: pos, recordId: null, coverUrl: null, artist: null, album: null };
    })
  );
  const [activePos,    setActivePos]    = useState<number | null>(null);
  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState<SearchResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [savingPos,    setSavingPos]    = useState<number | null>(null);
  const [removingPos,  setRemovingPos]  = useState<number | null>(null);
  const [, startSave]                   = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/collection/search?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json() as { results?: SearchResult[] };
        setResults(json.results ?? []);
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 280);
  }, []);

  function openSlot(pos: number) {
    setActivePos(pos);
    setQuery("");
    setResults([]);
  }

  function closeSearch() {
    setActivePos(null);
    setQuery("");
    setResults([]);
  }

  function handleSelectRecord(r: SearchResult) {
    if (!activePos) return;
    const pos = activePos;
    setSavingPos(pos);
    closeSearch();
    startSave(async () => {
      await setListRecord(listId, pos, r.id);
      setSlots(prev => prev.map(s =>
        s.position === pos
          ? { position: pos, recordId: r.id, coverUrl: r.cover_url, artist: r.artist, album: r.album }
          : s
      ));
      setSavingPos(null);
    });
  }

  function handleRemove(pos: number) {
    setRemovingPos(pos);
    startSave(async () => {
      await removeListItem(listId, pos);
      setSlots(prev => prev.map(s =>
        s.position === pos
          ? { position: pos, recordId: null, coverUrl: null, artist: null, album: null }
          : s
      ));
      setRemovingPos(null);
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "#ffffff",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, background: "#ffffff",
        borderBottom: `1px solid ${RULE}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", zIndex: 1,
      }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 4px" }}>
            Editing
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "18px", color: INK, margin: 0, lineHeight: 1.2 }}>
            {listTitle}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff", background: INK, border: "none", cursor: "pointer", padding: "8px 16px" }}
        >
          Done
        </button>
      </div>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 32px 80px" }}>

        {/* Slot grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "32px" }}>
          {slots.map(slot => {
            const isActive  = activePos === slot.position;
            const isSaving  = savingPos  === slot.position;
            const isRemoving = removingPos === slot.position;
            const busy      = isSaving || isRemoving;

            return (
              <div key={slot.position}>
                <div
                  onClick={() => { if (!busy) isActive ? closeSearch() : openSlot(slot.position); }}
                  style={{
                    aspectRatio: "1 / 1",
                    position: "relative",
                    overflow: "hidden",
                    background: slot.coverUrl ? "transparent" : "#f8f8f8",
                    border: isActive
                      ? `2px solid ${ORANGE}`
                      : slot.coverUrl
                        ? "none"
                        : `1px dashed ${RULE}`,
                    cursor: busy ? "wait" : "pointer",
                    transition: "border-color 0.1s",
                    boxSizing: "border-box",
                  }}
                >
                  {slot.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slot.coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: MONO, fontSize: "20px", color: "#d8d8d8", lineHeight: 1 }}>+</span>
                    </div>
                  )}

                  {/* Position badge */}
                  <span style={{
                    position: "absolute", top: "6px", left: "6px",
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
                    color: slot.coverUrl ? "rgba(255,255,255,0.8)" : "#cccccc",
                    textShadow: slot.coverUrl ? "0 1px 3px rgba(0,0,0,0.5)" : "none",
                    lineHeight: 1,
                  }}>
                    {slot.position}
                  </span>

                  {/* Saving overlay */}
                  {busy && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: MONO, fontSize: "9px", color: "#aaaaaa" }}>…</span>
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {slot.recordId && !busy && (
                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(slot.position); }}
                    style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0", display: "block", width: "100%" }}
                  >
                    Remove
                  </button>
                )}

                {/* Track info */}
                {slot.artist && !busy && (
                  <div style={{ marginTop: slot.recordId ? "0" : "6px" }}>
                    <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slot.artist}
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: "11px", color: INK, lineHeight: 1.3, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {slot.album}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Search panel */}
        {activePos !== null && (
          <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: "24px" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "12px" }}>
              Slot {activePos} — search your collection
            </p>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="Artist or album…"
              style={{
                width: "100%", boxSizing: "border-box",
                fontFamily: MONO, fontSize: "13px", letterSpacing: "0.04em",
                color: INK, background: "transparent",
                border: "none", borderBottom: `1px solid rgba(0,0,0,0.2)`,
                outline: "none", padding: "0 0 8px",
              }}
            />

            {searching && (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#aaaaaa", marginTop: "16px" }}>Searching…</p>
            )}

            {!searching && results.length > 0 && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column" }}>
                {results.slice(0, 8).map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRecord(r)}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 0",
                      background: "none", border: "none", borderBottom: `0.5px solid ${RULE}`,
                      cursor: "pointer", textAlign: "left", width: "100%",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    <div style={{ width: 40, height: 40, flexShrink: 0, background: "#f0f0f0", overflow: "hidden" }}>
                      {r.cover_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.artist}
                      </p>
                      <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.album}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && query.trim() && results.length === 0 && (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#aaaaaa", marginTop: "16px" }}>
                No records found in your collection.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
