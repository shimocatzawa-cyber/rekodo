"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListSlot } from "@/app/lists/types";
import { isAppleMusicUrl, openAppleMusicLink } from "@/lib/openAppleMusic";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

export default function PublicListSlots({ slots }: { slots: ListSlot[] }) {
  const [userId,     setUserId]     = useState<string | null>(null);
  const [savedIds,   setSavedIds]   = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  async function saveToWantlist(recordId: string) {
    setLoadingIds(prev => new Set([...prev, recordId]));
    try {
      const res = await fetch("/api/lists/wantlist-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      if (res.ok) setSavedIds(prev => new Set([...prev, recordId]));
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(recordId); return s; });
    }
  }

  return (
    <div className="rk-list-slots" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px" }}>
      {slots.map(({ position, item }) => (
        <div key={position} style={{ minWidth: 0 }}>
          <div style={{ position: "relative", overflow: "hidden", lineHeight: 0 }}>
            {item?.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.cover_url} alt={item.song_title ?? item.album} style={{ display: "block", width: "100%", aspectRatio: "1/1", objectFit: "cover", minWidth: 0 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "1/1", background: "#f4f4f4", border: "1px dashed rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: SERIF, fontSize: "22px", color: "#d0d0d0" }}>—</span>
              </div>
            )}
            <span style={{ position: "absolute", top: "8px", left: "8px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: item ? "rgba(255,255,255,0.8)" : "#c0c0c0", lineHeight: 1, textShadow: item ? "0 1px 2px rgba(0,0,0,0.5)" : "none" }}>
              {position}
            </span>
          </div>

          <div style={{ marginTop: "10px" }}>
            {item ? (
              <>
                <p className="truncate" style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "3px" }}>
                  {item.artist}{item.year ? ` · ${item.year}` : ""}
                </p>
                <p style={{ fontFamily: SERIF, fontSize: "13px", color: "#0d0d0d", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.song_title ?? item.album}
                </p>
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {[
                    { label: "Discogs",     href: `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}&type=release` },
                    { label: "Apple Music", href: `https://music.apple.com/search?term=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                    { label: "Tidal",       href: `https://tidal.com/search?q=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                    { label: "Spotify",     href: `https://open.spotify.com/search/${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                  ].map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.05em", color: "#bbbbbb", textDecoration: "none", whiteSpace: "nowrap" }}
                      onClick={isAppleMusicUrl(href) ? (e) => { e.preventDefault(); openAppleMusicLink(href); } : undefined}
                    >
                      {label} ↗
                    </a>
                  ))}
                  {userId && item.item_type === "record" && (
                    <button
                      onClick={() => saveToWantlist(item.id)}
                      disabled={loadingIds.has(item.id) || savedIds.has(item.id)}
                      style={{
                        fontFamily: MONO, fontSize: "8px", letterSpacing: "0.05em",
                        color: savedIds.has(item.id) ? "#aaaaaa" : ORANGE,
                        background: "none", border: "none",
                        cursor: savedIds.has(item.id) ? "default" : "pointer",
                        padding: 0, whiteSpace: "nowrap",
                      }}
                    >
                      {loadingIds.has(item.id) ? "Saving…" : savedIds.has(item.id) ? "In Wantlist ✓" : "+ Wantlist"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#d0d0d0" }}>Empty</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
