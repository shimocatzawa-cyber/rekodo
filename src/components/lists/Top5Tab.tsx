"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createList, deleteList, toggleListPublic } from "@/app/lists/actions";
import Top5Editor, { type EditorSlot } from "@/components/profile/Top5Editor";
import { createClient } from "@/lib/supabase/client";
import type { UserList } from "@/app/lists/types";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#aaaaaa";

const eyebrowSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em",
  textTransform: "uppercase", color: ORANGE, margin: 0,
};

const TOP5_TEMPLATES = [
  "Top 5 All Time",
  "Top 5 Desert Island Records",
  "Top 5 Break Up Records",
  "Top 5 Make Up Records",
  "Top 5 Sunday Morning Records",
  "Top 5 Saturday Night Records",
  "Top 5 Records That Changed My Life",
  "Top 5 Gateway Records",
  "Top 5 Most Played",
  "Top 5 Hidden Gems",
  "Top 5 Most Wanted",
] as const;

type EditorModal =
  | null
  | { step: "template"; customMode: boolean; customTitle: string }
  | { step: "editor"; listId: string; listTitle: string; slots: EditorSlot[] };

export default function Top5Tab({ username }: { username: string }) {
  const router = useRouter();
  const [lists,      setLists]      = useState<UserList[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [copiedId,   setCopiedId]   = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editorModal, setEditorModal] = useState<EditorModal>(null);
  const [creatingList, startCreatingList] = useTransition();

  function fetchLists() {
    return fetch("/api/lists/mine")
      .then(r => r.json())
      .then((json: { lists?: UserList[] }) => {
        const all = json.lists ?? [];
        return all.filter(l => l.list_type === "top5");
      });
  }

  useEffect(() => {
    fetchLists()
      .then(filtered => { setLists(filtered); setLoading(false); })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch like counts whenever list IDs change
  useEffect(() => {
    const ids = lists.map(l => l.id);
    if (ids.length === 0) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient() as any)
      .from("list_likes")
      .select("list_id")
      .in("list_id", ids)
      .then(({ data }: { data: { list_id: string }[] | null }) => {
        if (cancelled || !data) return;
        const counts: Record<string, number> = {};
        for (const row of data) counts[row.list_id] = (counts[row.list_id] ?? 0) + 1;
        setLikeCounts(counts);
      });
    return () => { cancelled = true; };
  }, [lists]);

  function openCreate() {
    setEditorModal({ step: "template", customMode: false, customTitle: "" });
  }

  function handlePickTemplate(title: string) {
    startCreatingList(async () => {
      const res = await createList(title, "top5");
      if (res && "success" in res && res.success && res.list) {
        const newList: UserList = { id: res.list.id, title: res.list.title, slug: res.list.slug, is_public: true, list_type: "top5", slots: [] };
        setLists(prev => [...prev, newList]);
        setEditorModal({ step: "editor", listId: res.list!.id, listTitle: res.list!.title, slots: [] });
      }
    });
  }

  function handleCustomCreate() {
    if (editorModal?.step !== "template") return;
    const raw = editorModal.customTitle.trim();
    if (!raw) return;
    const title = raw.replace(/^top\s+5\s+/i, "");
    handlePickTemplate(`Top 5 ${title}`);
  }

  function openListEdit(list: UserList) {
    const slots: EditorSlot[] = Array.from({ length: 5 }, (_, i) => {
      const pos  = i + 1;
      const slot = list.slots.find(s => s.position === pos);
      return {
        position: pos,
        recordId: slot?.item?.item_type === "record" ? slot.item.id : null,
        coverUrl: slot?.item?.cover_url ?? null,
        artist:   slot?.item?.artist   ?? null,
        album:    slot?.item?.album    ?? null,
      };
    });
    setEditorModal({ step: "editor", listId: list.id, listTitle: list.title, slots });
  }

  async function handleDeleteList(listId: string, listTitle: string) {
    if (!confirm(`Delete "${listTitle}"? This cannot be undone.`)) return;
    await deleteList(listId);
    setLists(prev => prev.filter(l => l.id !== listId));
  }

  async function handleTogglePublic(listId: string) {
    setTogglingId(listId);
    const res = await toggleListPublic(listId);
    if (res && "isPublic" in res) {
      setLists(prev => prev.map(l => l.id === listId ? { ...l, is_public: !!res.isPublic } : l));
    }
    setTogglingId(null);
  }

  function handleShare(list: UserList) {
    const url = `${window.location.origin}/@${username}/${list.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(list.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }

  function handleEditorClose() {
    setEditorModal(null);
    fetchLists().then(filtered => setLists(filtered)).catch(() => {});
    router.refresh();
  }

  if (loading) {
    return (
      <div className="rk-top5-outer" style={{ padding: "3rem 3.5rem", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.08em", color: MUTED }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="rk-top5-outer" style={{ padding: "3rem 3.5rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: "32px" }}>
        <button
          onClick={openCreate}
          style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, borderRadius: "3px", cursor: "pointer", padding: "4px 10px", whiteSpace: "nowrap" }}
        >
          + New Top 5
        </button>
      </div>

      {lists.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
          {lists.map(list => {
            const likes   = likeCounts[list.id] ?? 0;
            const copied  = copiedId === list.id;
            const toggling = togglingId === list.id;
            return (
              <div key={list.id}>
                <div className="rk-top5-list-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <Link href={`/@${username}/${list.slug}`} style={{ textDecoration: "none", minWidth: 0 }}>
                    <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: INK, margin: 0, lineHeight: 1.2 }}>
                      {list.title}
                    </h2>
                  </Link>
                  <div className="rk-top5-list-actions" style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0, marginLeft: "16px" }}>
                    {/* Like count */}
                    {likes > 0 && (
                      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: MUTED }}>
                        ♥ {likes}
                      </span>
                    )}
                    {/* Share */}
                    <button
                      onClick={() => handleShare(list)}
                      style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: copied ? "#22a559" : MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      {copied ? "Copied ✓" : "Share ↗"}
                    </button>
                    {/* Public/Private toggle */}
                    <button
                      onClick={() => handleTogglePublic(list.id)}
                      disabled={toggling}
                      style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: list.is_public ? MUTED : ORANGE, background: "none", border: "none", cursor: toggling ? "wait" : "pointer", padding: 0, opacity: toggling ? 0.5 : 1 }}
                    >
                      {list.is_public ? "Public" : "Private"}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => openListEdit(list)}
                      style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Edit →
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteList(list.id, list.title)}
                      style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="rk-top5-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const pos      = i + 1;
                    const slot     = list.slots.find(s => s.position === pos);
                    const coverUrl = slot?.item?.cover_url ?? null;
                    return (
                      <div key={pos} style={{ minWidth: 0 }}>
                        <div style={{ position: "relative", overflow: "hidden", lineHeight: 0 }}>
                          {coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={coverUrl}
                              alt={slot?.item?.album ?? ""}
                              style={{ display: "block", width: "100%", aspectRatio: "1/1", objectFit: "cover", minWidth: 0 }}
                            />
                          ) : (
                            <div style={{ width: "100%", aspectRatio: "1/1", background: "#f4f4f4", border: "1px dashed rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8", lineHeight: 1 }}>—</span>
                            </div>
                          )}
                          <span style={{ position: "absolute", top: "7px", left: "7px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: coverUrl ? "rgba(255,255,255,0.75)" : "#cccccc", textShadow: coverUrl ? "0 1px 3px rgba(0,0,0,0.5)" : "none", lineHeight: 1 }}>
                            {pos}
                          </span>
                        </div>
                        {slot?.item && (
                          <div style={{ marginTop: "8px" }}>
                            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, margin: "0 0 3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {slot.item.artist}
                            </p>
                            <p style={{ fontFamily: SERIF, fontSize: "12px", color: INK, lineHeight: 1.3, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {slot.item.album}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: MUTED, margin: 0 }}>
          No Top 5 lists yet.{" "}
          <button
            onClick={openCreate}
            style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Create one →
          </button>
        </p>
      )}

      {/* ── Template picker modal ── */}
      {editorModal?.step === "template" && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onClick={e => { if (e.target === e.currentTarget) setEditorModal(null); }}
        >
          <div className="rk-top5-modal" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", width: "100%", maxWidth: "660px", padding: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "6px" }}>New list</p>
                <p style={{ fontFamily: SERIF, fontSize: "18px", color: INK, margin: 0 }}>Top 5 list</p>
              </div>
              <button onClick={() => setEditorModal(null)} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {!editorModal.customMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
                {TOP5_TEMPLATES.map(title => (
                  <button
                    key={title}
                    disabled={creatingList}
                    onClick={() => handlePickTemplate(title)}
                    style={{ textAlign: "left", padding: "16px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", cursor: creatingList ? "wait" : "pointer" }}
                    onMouseEnter={e => { if (!creatingList) (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
                  >
                    <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, lineHeight: 1.35, margin: 0 }}>{title}</p>
                  </button>
                ))}
                <button
                  disabled={creatingList}
                  onClick={() => setEditorModal({ ...editorModal, customMode: true })}
                  style={{ textAlign: "left", padding: "16px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
                >
                  <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, lineHeight: 1.35, margin: 0 }}>+ Custom</p>
                </button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleCustomCreate(); }} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "baseline", borderBottom: "1px solid rgba(0,0,0,0.2)", paddingBottom: "6px" }}>
                  <span style={{ fontFamily: SERIF, fontSize: "20px", color: "#cccccc", whiteSpace: "nowrap", userSelect: "none" }}>Top 5 </span>
                  <input
                    autoFocus
                    type="text"
                    value={editorModal.customTitle}
                    onChange={e => setEditorModal({ ...editorModal, customTitle: e.target.value })}
                    placeholder="Rainy Day Records…"
                    maxLength={60}
                    style={{ flex: 1, outline: "none", fontFamily: SERIF, fontSize: "20px", color: INK, background: "transparent", border: "none" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!editorModal.customTitle.trim() || creatingList}
                  style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: editorModal.customTitle.trim() ? ORANGE : "#cccccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {creatingList ? "Creating…" : "Create →"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditorModal({ ...editorModal, customMode: false })}
                  style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ← Back
                </button>
              </form>
            )}

            {creatingList && (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginTop: "20px" }}>Creating…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Top5Editor overlay ── */}
      {editorModal?.step === "editor" && (
        <Top5Editor
          listId={editorModal.listId}
          listTitle={editorModal.listTitle}
          initialSlots={editorModal.slots}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}
