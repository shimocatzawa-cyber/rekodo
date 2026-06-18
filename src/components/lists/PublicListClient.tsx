"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListSlot } from "@/app/lists/types";
import { isAppleMusicUrl, openAppleMusicLink } from "@/lib/openAppleMusic";
import { generateShareCard, downloadCard, copyCardToClipboard } from "@/lib/shareCard";
import { updateListTitle } from "@/app/lists/actions";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublicComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

interface Props {
  listId:           string;
  ownerId:          string;
  listTitle:        string;
  username:         string;
  slots:            ListSlot[];
  initialLikeCount: number;
  initialLiked:     boolean;
  initialComments:  PublicComment[];
  viewerUserId:     string | null;
  isOwner:          boolean;
}

// ─── Share modal ──────────────────────────────────────────────────────────────

function ShareModal({
  onClose, title, slots, username,
}: {
  onClose:  () => void;
  title:    string;
  slots:    ListSlot[];
  username: string;
}) {
  const [canvas,    setCanvas]    = useState<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(true);
  const [copyState,  setCopyState]  = useState<"idle" | "copied" | "failed">("idle");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generateShareCard({
      title,
      slots: slots.map(s => ({
        position: s.position,
        record: s.item ? { artist: s.item.artist, album: s.item.song_title ?? s.item.album, cover_url: s.item.cover_url } : null,
      })),
      username,
    }).then(c => { setCanvas(c); setGenerating(false); }).catch(() => setGenerating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canvas || !previewRef.current) return;
    previewRef.current.innerHTML = "";
    canvas.style.cssText = "width:100%;height:auto;display:block;";
    previewRef.current.appendChild(canvas);
  }, [canvas]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ background: "#fff", maxWidth: 420, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Share Card</p>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {generating ? (
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", textAlign: "center", padding: "40px 0" }}>Generating…</p>
          ) : canvas ? (
            <div ref={previewRef} style={{ border: "1px solid rgba(0,0,0,0.08)" }} />
          ) : (
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", textAlign: "center", padding: "40px 0" }}>Could not generate card.</p>
          )}
        </div>

        {canvas && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: "10px" }}>
            <button
              onClick={() => downloadCard(canvas, title)}
              style={{ flex: 1, fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: "pointer", padding: "10px 0" }}
            >
              Download PNG
            </button>
            <button
              onClick={async () => {
                const ok = await copyCardToClipboard(canvas);
                setCopyState(ok ? "copied" : "failed");
                setTimeout(() => setCopyState("idle"), 2500);
              }}
              style={{ flex: 1, fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer", padding: "10px 0", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : INK }}
            >
              {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Failed" : "Copy to Clipboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicListClient({
  listId, ownerId, listTitle, username, slots,
  initialLikeCount, initialLiked, initialComments,
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

  // ── Comments ────────────────────────────────────────────────────────────────
  const [comments,     setComments]     = useState<PublicComment[]>(initialComments);
  const [commentDraft, setCommentDraft] = useState("");
  const [submitting,   setSubmitting]   = useState(false);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const body = commentDraft.trim();
    if (!body || !viewerUserId || submitting) return;
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data } = await supabase
      .from("list_comments")
      .insert({ list_id: listId, user_id: viewerUserId, body })
      .select("id, user_id, body, created_at")
      .single();
    if (data) {
      const { data: profile } = await supabase
        .from("profiles").select("username, avatar_url").eq("id", viewerUserId).maybeSingle();
      setComments((prev: PublicComment[]) => [{
        ...(data as { id: string; user_id: string; body: string; created_at: string }),
        profiles: (profile as { username: string; avatar_url: string | null } | null) ?? null,
      }, ...prev]);
      setCommentDraft("");
    }
    setSubmitting(false);
  }

  async function deleteComment(commentId: string) {
    if (!viewerUserId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    await supabase.from("list_comments").delete().eq("id", commentId).eq("user_id", viewerUserId);
    setComments(prev => prev.filter((c: PublicComment) => c.id !== commentId));
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return "just now";
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

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

          {/* Share */}
          <button
            onClick={() => setShowShare(true)}
            style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: "pointer", padding: "7px 12px" }}
          >
            Share ↗
          </button>
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
                        { label: "Tidal",       href: `https://tidal.com/search?q=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
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

      {/* Comments */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: "40px" }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa", marginBottom: "24px" }}>
          {comments.length === 0 ? "No comments yet" : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
        </p>

        {/* Comment form */}
        {viewerUserId ? (
          <form onSubmit={submitComment} style={{ marginBottom: "32px" }}>
            <textarea
              value={commentDraft}
              onChange={e => setCommentDraft(e.target.value)}
              placeholder="Leave a comment…"
              maxLength={500}
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box",
                fontFamily: MONO, fontSize: "12px", letterSpacing: "0.02em",
                color: INK, background: "#fafafa",
                border: "1px solid rgba(0,0,0,0.1)", outline: "none",
                padding: "10px 12px", resize: "vertical", lineHeight: 1.6,
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="submit"
                disabled={!commentDraft.trim() || submitting}
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: "pointer", padding: "7px 16px", opacity: (!commentDraft.trim() || submitting) ? 0.4 : 1 }}
              >
                {submitting ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        ) : (
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em", color: "#bbb", marginBottom: "32px" }}>
            <a href="/login" style={{ color: ORANGE, textDecoration: "none" }}>Sign in</a> to leave a comment.
          </p>
        )}

        {/* Comment list */}
        <div>
          {comments.map(c => (
            <div key={c.id} style={{ paddingBottom: "20px", marginBottom: "20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                {/* Avatar */}
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#e0e0da", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {c.profiles?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontFamily: MONO, fontSize: "9px", color: "#888", textTransform: "uppercase" }}>{c.profiles?.username?.[0] ?? "?"}</span>
                  }
                </div>
                <a href={`/@${c.profiles?.username}`} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: INK, textDecoration: "none" }}>
                  @{c.profiles?.username ?? "unknown"}
                </a>
                <span style={{ fontFamily: MONO, fontSize: "9px", color: "#bbb", letterSpacing: "0.04em" }}>{timeAgo(c.created_at)}</span>
                {(c.user_id === viewerUserId || isOwner) && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    style={{ marginLeft: "auto", fontFamily: MONO, fontSize: "9px", color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.02em", color: "#444", lineHeight: 1.7, margin: 0 }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
