"use client";

import { useState, useDeferredValue, useEffect } from "react";
import type { ProfileRecord } from "@/app/api/profile/records/route";

const MONO   = "var(--font-mono)";
const SERIF  = "var(--font-editorial)";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";
const ORANGE = "#CC5500";

type LoadState = "idle" | "loading" | "done" | "error";

interface Props {
  userId:           string;
  isOwner:          boolean;
  collectionPublic: boolean;
  wantlistPublic:   boolean;
  activeTab:        "collection" | "wantlist";
}

export default function ProfileRecordsTabs({
  userId,
  isOwner,
  collectionPublic,
  wantlistPublic,
  activeTab,
}: Props) {
  const [search, setSearch] = useState("");
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

  // Auto-load collection on mount
  useEffect(() => { loadTab("collection"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the newly-selected tab when parent switches it
  useEffect(() => {
    setSearch("");
    loadTab(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = activeTab === "collection" ? collectionItems : wantlistItems;
  const state = activeTab === "collection" ? collectionState : wantlistState;
  const isPrivate = !isOwner && (activeTab === "collection" ? !collectionPublic : !wantlistPublic);

  const q = deferredSearch.toLowerCase().trim();
  const filtered = q
    ? items.filter(r =>
        r.artist.toLowerCase().includes(q) ||
        r.album.toLowerCase().includes(q) ||
        (r.genre ?? "").toLowerCase().includes(q)
      )
    : items;

  return (
    <div>
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

          {/* List */}
          {filtered.length > 0 && (
            <div>
              {filtered.map((item, i) => (
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
                      <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, margin: 0 }}>
                        {item.year}
                      </p>
                    )}
                    {item.format && (
                      <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: "#c0c0c0", margin: "2px 0 0" }}>
                        {item.format}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#cccccc", letterSpacing: "0.06em", margin: "12px 0 0", textAlign: "right" }}>
                {q
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                  : `${filtered.length.toLocaleString()} item${filtered.length !== 1 ? "s" : ""}`
                }
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
