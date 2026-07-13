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
  userId:               string;
  isOwner:              boolean;
  collectionPublic:     boolean;
  wantlistPublic:       boolean;
  totalCollectionCount: number;
}

export default function ProfileRecordsTabs({
  userId,
  isOwner,
  collectionPublic,
  wantlistPublic,
  totalCollectionCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<"collection" | "wantlist">("collection");
  const [search,   setSearch]     = useState("");
  const [page,     setPage]       = useState(0);
  const deferredSearch = useDeferredValue(search);

  const [collectionItems, setCollectionItems] = useState<ProfileRecord[]>([]);
  const [wantlistItems,   setWantlistItems]   = useState<ProfileRecord[]>([]);
  const [collectionState, setCollectionState] = useState<LoadState>("idle");
  const [wantlistState,   setWantlistState]   = useState<LoadState>("idle");

  async function loadTab(type: "collection" | "wantlist") {
    const state    = type === "collection" ? collectionState : wantlistState;
    const setState = type === "collection" ? setCollectionState : setWantlistState;
    const setItems = type === "collection" ? setCollectionItems : setWantlistItems;

    if (state !== "idle") return;
    setState("loading");
    try {
      const res  = await fetch(`/api/profile/records?userId=${encodeURIComponent(userId)}&type=${type}`);
      const data = await res.json() as { items?: ProfileRecord[]; private?: boolean; error?: string };
      if (data.private) { setState("done"); return; }
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setItems(data.items ?? []);
      setState("done");
    } catch {
      setState("error");
    }
  }

  useEffect(() => { loadTab("collection"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(tab: "collection" | "wantlist") {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSearch("");
    setPage(0);
    loadTab(tab);
  }

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [deferredSearch]);

  const items     = activeTab === "collection" ? collectionItems : wantlistItems;
  const state     = activeTab === "collection" ? collectionState : wantlistState;
  const isPrivate = !isOwner && (activeTab === "collection" ? !collectionPublic : !wantlistPublic);

  const q = deferredSearch.toLowerCase().trim();
  const filtered = q
    ? items.filter(r =>
        r.artist.toLowerCase().includes(q) ||
        r.album.toLowerCase().includes(q) ||
        (r.genre ?? "").toLowerCase().includes(q)
      )
    : items;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Nav labels — collection uses server count immediately; wantlist shows count after load
  function navLabel(tab: "collection" | "wantlist") {
    if (tab === "collection") {
      return totalCollectionCount > 0
        ? `Collection\n(${totalCollectionCount.toLocaleString()})`
        : "Collection";
    }
    return wantlistState === "done" && wantlistItems.length > 0
      ? `Wantlist\n(${wantlistItems.length.toLocaleString()})`
      : "Wantlist";
  }

  return (
    <div style={{ marginTop: "36px", display: "flex", gap: "40px", alignItems: "flex-start" }}>

      {/* ── Left nav — SpotlightArchivePicker style ── */}
      <div style={{ width: 110, flexShrink: 0, paddingTop: 4 }}>
        {(["collection", "wantlist"] as const).map(tab => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              style={{
                display:       "block",
                fontFamily:    MONO,
                fontSize:      "10px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace:    "pre",
                lineHeight:    1.5,
                background:    "none",
                border:        "none",
                padding:       "2px 0",
                marginBottom:  "8px",
                textAlign:     "left",
                cursor:        active ? "default" : "pointer",
                color:         active ? ORANGE : "#888888",
                borderBottom:  `1px solid ${active ? ORANGE : "transparent"}`,
                width:         "fit-content",
              }}
            >
              {navLabel(tab)}
            </button>
          );
        })}
      </div>

      {/* ── Right: content panel ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isPrivate ? (
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", margin: 0 }}>
            This {activeTab} is private.
          </p>
        ) : (
          <>
            {/* Search */}
            {state === "done" && items.length > 0 && (
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search artist, album or genre…"
                style={{
                  fontFamily:    MONO,
                  fontSize:      "0.72rem",
                  letterSpacing: "0.04em",
                  width:         "100%",
                  background:    "none",
                  border:        "none",
                  borderBottom:  `1px solid ${RULE}`,
                  padding:       "6px 0",
                  marginBottom:  "4px",
                  outline:       "none",
                  color:         INK,
                  boxSizing:     "border-box",
                }}
              />
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
                  onClick={() => {
                    (activeTab === "collection" ? setCollectionState : setWantlistState)("idle");
                    void loadTab(activeTab);
                  }}
                  style={{ background: "none", border: "none", color: ORANGE, cursor: "pointer", fontFamily: MONO, fontSize: "0.65rem", padding: 0, textDecoration: "underline" }}
                >
                  Retry
                </button>
              </p>
            )}

            {state === "done" && filtered.length === 0 && (
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", margin: 0 }}>
                {q ? "No results." : `Nothing in ${activeTab} yet.`}
              </p>
            )}

            {/* List — current page only */}
            {paged.length > 0 && (
              <div>
                {paged.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          "12px",
                      padding:      "9px 0",
                      borderBottom: `1px solid ${RULE}`,
                    }}
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

                {/* Footer: count + pagination */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#cccccc", letterSpacing: "0.06em", margin: 0 }}>
                    {q
                      ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                      : `${filtered.length.toLocaleString()} item${filtered.length !== 1 ? "s" : ""}`
                    }
                  </p>

                  {totalPages > 1 && (
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
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
