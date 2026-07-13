"use client";

import { useState, useDeferredValue, useEffect } from "react";
import type { ProfileRecord } from "@/app/api/profile/records/route";

const MONO   = "var(--font-mono)";
const SERIF  = "var(--font-editorial)";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const ORANGE = "#CC5500";

const PAGE_SIZE = 100;
type LoadState  = "idle" | "loading" | "done" | "error";

interface Props {
  userId:    string;
  isOwner:   boolean;
  type:      "collection" | "wantlist";
  isPublic:  boolean;
  onLoad?:   (count: number) => void;
}

export default function ProfileRecordsTabs({ userId, isOwner, type, isPublic, onLoad }: Props) {
  const [items,  setItems]  = useState<ProfileRecord[]>([]);
  const [state,  setState]  = useState<LoadState>("idle");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(0);
  const deferredSearch = useDeferredValue(search);

  const isPrivate = !isOwner && !isPublic;

  function load() {
    setState("loading");
    fetch(`/api/profile/records?userId=${encodeURIComponent(userId)}&type=${type}`)
      .then(r => r.json())
      .then((data: { items?: ProfileRecord[]; private?: boolean; error?: string }) => {
        if (data.private) { setState("done"); return; }
        if (data.error) throw new Error(data.error);
        const loaded = data.items ?? [];
        setItems(loaded);
        setState("done");
        onLoad?.(loaded.length);
      })
      .catch(() => setState("error"));
  }

  useEffect(() => {
    if (!isPrivate) load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(0); }, [deferredSearch]);

  if (isPrivate) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", margin: 0 }}>
        This {type} is private.
      </p>
    );
  }

  const q        = deferredSearch.toLowerCase().trim();
  const filtered = q
    ? items.filter(r =>
        r.artist.toLowerCase().includes(q) ||
        r.album.toLowerCase().includes(q) ||
        (r.genre ?? "").toLowerCase().includes(q)
      )
    : items;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const paginationBar = totalPages > 1 ? (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <button
        onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        disabled={page === 0}
        style={{
          fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em",
          background: "none", border: "none", padding: 0,
          color: page === 0 ? "#cccccc" : INK,
          cursor: page === 0 ? "default" : "pointer",
        }}
      >
        ← Prev
      </button>
      <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, letterSpacing: "0.04em" }}>
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        disabled={page >= totalPages - 1}
        style={{
          fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em",
          background: "none", border: "none", padding: 0,
          color: page >= totalPages - 1 ? "#cccccc" : INK,
          cursor: page >= totalPages - 1 ? "default" : "pointer",
        }}
      >
        Next →
      </button>
    </div>
  ) : null;

  return (
    <div>
      {state === "done" && items.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "4px" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artist, album or genre…"
            style={{
              fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em",
              flex: 1, background: "none", border: "none",
              borderBottom: `1px solid ${RULE}`, padding: "6px 0",
              outline: "none", color: INK, boxSizing: "border-box",
            }}
          />
          {paginationBar}
        </div>
      )}

      {state === "loading" && (
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", margin: 0 }}>
          Loading…
        </p>
      )}

      {state === "error" && (
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#cc3300", letterSpacing: "0.04em", margin: 0 }}>
          Failed to load.{" "}
          <button
            onClick={() => load()}
            style={{ background: "none", border: "none", color: ORANGE, cursor: "pointer", fontFamily: MONO, fontSize: "0.65rem", padding: 0, textDecoration: "underline" }}
          >
            Retry
          </button>
        </p>
      )}

      {state === "done" && filtered.length === 0 && (
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", margin: 0 }}>
          {q ? "No results." : `Nothing in ${type} yet.`}
        </p>
      )}

      {paged.length > 0 && (
        <div>
          {paged.map((item, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "9px 0", borderBottom: `1px solid ${RULE}` }}
            >
              <div style={{ width: 40, height: 40, flexShrink: 0, background: "#f0ede8", overflow: "hidden" }}>
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverUrl} alt="" width={40} height={40} style={{ objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: 40, height: 40, border: "1px dashed rgba(0,0,0,0.1)" }} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: MONO, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.artist}
                </p>
                <p style={{ fontFamily: SERIF, fontSize: "0.85rem", color: INK, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.album}
                </p>
                {item.genre && (
                  <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: "#b0b0a8", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.genre}
                  </p>
                )}
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {item.year && (
                  <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, margin: 0 }}>{item.year}</p>
                )}
                {item.format && (
                  <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: "#c0c0c0", margin: "2px 0 0" }}>{item.format}</p>
                )}
              </div>
            </div>
          ))}

          <div style={{ marginTop: "12px" }}>
            <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#cccccc", letterSpacing: "0.06em", margin: 0 }}>
              {q
                ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                : `${filtered.length.toLocaleString()} item${filtered.length !== 1 ? "s" : ""}`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
