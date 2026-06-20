"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListSlot } from "@/app/lists/types";
import { isAppleMusicUrl, openAppleMusicLink } from "@/lib/openAppleMusic";
import { updateListTitle } from "@/app/lists/actions";
import ShareModal from "@/components/lists/ShareModal";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  listId:           string;
  ownerId:          string;
  listTitle:        string;
  username:         string;
  slots:            ListSlot[];
  initialLikeCount: number;
  initialLiked:     boolean;
  viewerUserId:     string | null;
  isOwner:          boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicListClient({
  listId, ownerId, listTitle, username, slots,
  initialLikeCount, initialLiked,
  viewerUserId, isOwner,
}: Props) {
  // ── Like state ──────────────────────────────────────────────────────────────
  const [liked,     setLiked]     = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liking,    setLiking]    = useState(false);

  async function toggleLike() {
    if (!viewerUserId || liking) return;
    setLiking(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    if (liked) {
      await supabase.from("list_likes").delete().eq("list_id", listId).eq("user_id", viewerUserId);
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from("list_likes").insert({ list_id: listId, user_id: viewerUserId });
      setLiked(true);
      setLikeCount(c => c + 1);
    }
    setLiking(false);
  }

  // ── Edit title ──────────────────────────────────────────────────────────────
  const [title,      setTitle]      = useState(listTitle);
  const [editing,    setEditing]    = useState(false);
  const [titleDraft, setTitleDraft] = useState(listTitle);
  const [saving,     setSaving]     = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setTitleDraft(title);
    setEditing(true);
    setTimeout(() => titleInputRef.current?.focus(), 30);
  }

  async function commitEdit() {
    if (!titleDraft.trim() || titleDraft === title) { setEditing(false); return; }
    setSaving(true);
    const res = await updateListTitle(listId, titleDraft.trim());
    if (res?.success && res.title) setTitle(res.title);
    setEditing(false);
    setSaving(false);
  }

  // ── Share card ──────────────────────────────────────────────────────────────
  const [showShare, setShowShare] = useState(false);

  // ── Wantlist helper ─────────────────────────────────────────────────────────
  const [savedIds,   setSavedIds]   = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  async function saveToWantlist(recordId: string) {
    setLoadingIds(prev => new Set([...prev, recordId]));
    try {
      const res = await fetch("/api/lists/wantlist-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      if (res.ok) setSavedIds(prev => new Set([...prev, recordId]));
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(recordId); return s; });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {showShare && (
        <ShareModal
          onClose={() => setShowShare(false)}
          title={title}
          slots={slots}
          username={username}
          listUrl={typeof window !== "undefined" ? window.location.href : ""}
        />
      )}

      {/* Header row: title + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
              disabled={saving}
              style={{
                fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 48px)", color: INK, lineHeight: 1,
                background: "none", border: "none", borderBottom: `2px solid ${ORANGE}`,
                outline: "none", width: "100%", padding: "0 0 4px",
              }}
            />
          ) : (
            <h1
              style={{ fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 48px)", color: INK, lineHeight: 1, margin: 0 }}
            >
              {title}
              {isOwner && (
                <button
                  onClick={startEdit}
                  title="Edit title"
                  style={{ marginLeft: "12px", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: 0, verticalAlign: "middle" }}
                >
                  Edit
                </button>
              )}
            </h1>
          )}
        </div>

        {/* Top-right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, paddingTop: "6px" }}>
          {/* Like */}
          <button
            onClick={toggleLike}
            disabled={!viewerUserId}
            title={viewerUserId ? (liked ? "Unlike" : "Like") : "Sign in to like"}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em",
              color: liked ? ORANGE : "#aaa",
              background: "none", border: `1px solid ${liked ? ORANGE : "#e0e0da"}`,
              borderRadius: "3px", cursor: viewerUserId ? "pointer" : "default",
              padding: "5px 10px", transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "13px", lineHeight: 1 }}>{liked ? "♥" : "♡"}</span>
            <span>{likeCount}</span>
          </button>

          {/* Share — owner only */}
          {isOwner && (
            <button
              onClick={() => setShowShare(true)}
              style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: "pointer", padding: "7px 12px" }}
            >
              Share ↗
            </button>
          )}
        </div>
      </div>

      {/* Album grid */}
      <div style={{ marginBottom: "64px" }}>
        <div className="rk-list-slots" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px" }}>
          {slots.map(({ position, item }) => (
            <div key={position} style={{ minWidth: 0 }}>
              <div style={{ position: "relative", overflow: "hidden", lineHeight: 0 }}>
                {item?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_url} alt={item.song_title ?? item.album} style={{ display: "block", width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
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
                    <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.song_title ?? item.album}
                    </p>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {[
                        { label: "Discogs",     href: `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}&type=release` },
                        { label: "Apple Music", href: `https://music.apple.com/search?term=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                        { label: "Spotify",     href: `https://open.spotify.com/search/${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                      ].map(({ label, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.05em", color: "#bbbbbb", textDecoration: "none", whiteSpace: "nowrap" }}
                          onClick={isAppleMusicUrl(href) ? (e) => { e.preventDefault(); openAppleMusicLink(href); } : undefined}
                        >
                          {label} ↗
                        </a>
                      ))}
                      {viewerUserId && item.item_type === "record" && (
                        <button
                          onClick={() => saveToWantlist(item.id)}
                          disabled={loadingIds.has(item.id) || savedIds.has(item.id)}
                          style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.05em", color: savedIds.has(item.id) ? "#aaa" : ORANGE, background: "none", border: "none", cursor: savedIds.has(item.id) ? "default" : "pointer", padding: 0, whiteSpace: "nowrap" }}
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
      </div>

    </>
  );
}
