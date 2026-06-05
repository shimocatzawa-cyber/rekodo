"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import {
  setListRecord, addDiscogsRecordToList, addSongToList,
  appendRecordToList, appendDiscogsRecordToList, appendSongToList,
  removeListItem, toggleListPublic, createList, deleteList,
  type DiscogsPayload, type SongPayload,
} from "@/app/lists/actions";
import type { UserList, ListSlot, SlotItem, DiscoverList } from "@/app/lists/page";
import type { CollectionRecord } from "@/app/collection/page";
import { generateShareCard, downloadCard, copyCardToClipboard } from "@/lib/shareCard";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

// ─── Static subtitle map ──────────────────────────────────────────────────────

const LIST_SUBTITLES: Record<string, string> = {
  "Top 5 All Time":                     "The canon. Non-negotiable.",
  "Top 5 Desert Island Records":        "Only five. You're stranded.",
  "Top 5 Break Up Records":             "The ones that understood.",
  "Top 5 Make Up Records":              "Side B of the same story.",
  "Top 5 Sunday Morning Records":       "Coffee. Slow pace. No plans.",
  "Top 5 Saturday Night Records":       "The ones that start everything.",
  "Top 5 Records That Changed My Life": "Before and after.",
  "Top 5 Gateway Records":              "What I'd play to change their life.",
  "Top 5 Most Played":                  "Worn grooves. No apologies.",
  "Top 5 Hidden Gems":                  "Records nobody talks about.",
  "Want to Buy":                        "Building the wish list.",
  "Need to Relisten":                   "Albums that deserve another chance.",
};

// ─── Templates ────────────────────────────────────────────────────────────────

const TOP5_TEMPLATES = [
  { title: "Top 5 All Time",                     subtitle: "The canon. Non-negotiable." },
  { title: "Top 5 Desert Island Records",         subtitle: "Only five. You're stranded." },
  { title: "Top 5 Break Up Records",              subtitle: "The ones that understood." },
  { title: "Top 5 Make Up Records",               subtitle: "Side B of the same story." },
  { title: "Top 5 Sunday Morning Records",         subtitle: "Coffee. Slow pace. No plans." },
  { title: "Top 5 Saturday Night Records",         subtitle: "The ones that start everything." },
  { title: "Top 5 Records That Changed My Life",   subtitle: "Before and after." },
  { title: "Top 5 Gateway Records",               subtitle: "What I'd play to change their life." },
  { title: "Top 5 Most Played",                    subtitle: "Worn grooves. No apologies." },
  { title: "Top 5 Hidden Gems",                    subtitle: "Records nobody talks about." },
  { title: "Custom",                               subtitle: "Name it yourself.", isCustom: true as const },
];

const PERSONAL_TEMPLATES = [
  { title: "Want to Buy",      subtitle: "Building the wish list." },
  { title: "Need to Relisten", subtitle: "Albums that deserve another chance." },
  { title: "Custom",           subtitle: "Your list, your rules.", isCustom: true as const },
];

// ─── Static discover cards ────────────────────────────────────────────────────

const STATIC_DISCOVER_CARDS = [
  {
    id: "s1",
    title: "Top 5 Japanese Jazz",
    username: "tokyovinyl",
    count: "892 records",
    badge: "Label Mate · 71%",
    saves: 312,
    colors: ["#b5956a", "#2a4560", "#7a3535", "#3d5c28"],
  },
  {
    id: "s2",
    title: "Top 5 Kosmische",
    username: "analogdrift",
    count: "634 records",
    badge: "Bandmates · 79%",
    saves: 156,
    colors: ["#1a1a2e", "#0f3460", "#533483", "#16213e"],
  },
  {
    id: "s3",
    title: "Top 5 Drag City Records",
    username: "indiehead",
    count: "445 records",
    badge: "A Side to my B · 58%",
    saves: 89,
    colors: ["#e2cfa8", "#c49a52", "#7a5c18", "#4a3810"],
  },
  {
    id: "s4",
    title: "Top 5 Records of 1972",
    username: "cratedigger",
    count: "23 versions",
    badge: "Trending 🔥",
    saves: 847,
    colors: ["#cc4400", "#f0a060", "#e8d8c0", "#003d6e"],
  },
  {
    id: "s5",
    title: "Top 5 Blue Note Originals",
    username: "jazzhead",
    count: "1,204 records",
    badge: "Regular at the Same Shop · 42%",
    saves: 234,
    colors: ["#1a2440", "#2d4a7a", "#c8a44a", "#0d1a30"],
  },
] as const;

// ─── Discogs artwork queries per static card ──────────────────────────────────

const DISCOVER_CARD_QUERIES: Record<string, string[]> = {
  s1: ["Ryo Fukui Scenery", "Toshiko Akiyoshi trio", "Sadao Watanabe jazz", "Masabumi Kikuchi"],
  s2: ["Neu! debut", "Cluster Zuckerzeit", "Harmonia Musik von Harmonia", "Popol Vuh Aguirre"],
  s3: ["Will Oldham Palace Brothers", "Royal Trux Twin Infinitives", "Joanna Newsom Ys", "Smog Knock Knock"],
  s4: ["Neil Young Harvest", "Rolling Stones Exile Main St", "Lou Reed Transformer", "Jethro Tull Thick As A Brick"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  initialLists:   UserList[];
  username:       string;
  displayLabel?:  string;
  avatarUrl?:     string | null;
  discoverLists?: DiscoverList[];
}

type PickerMode =
  | { listId: string; position: number; strategy: "replace" }
  | { listId: string; strategy: "append" };

type PickerTab = "collection" | "discogs" | "songs";

type CreateState =
  | null
  | { listType: "top5" | "personal"; step: "templates" | "custom" };

type DiscoverTab = "similar" | "trending" | "all";

interface DiscogsResult {
  id: number;
  title: string;
  year?: string;
  genre?: string[];
  label?: string[];
  cover_image?: string;
  thumb?: string;
}

interface SavedCardEntry {
  id: string;
  title: string;
  username: string;
}

function parseTitle(title: string): { artist: string; album: string } {
  const idx = title.indexOf(" - ");
  if (idx === -1) return { artist: "", album: title };
  return { artist: title.slice(0, idx), album: title.slice(idx + 3) };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ListsClient({
  initialLists, username, displayLabel, avatarUrl, discoverLists = [],
}: Props) {
  const router = useRouter();
  const [lists,        setLists]       = useState<UserList[]>(initialLists);
  const [saving,       setSaving]      = useState<string | null>(null);
  const [activePillId, setActivePillId] = useState<string | null>(initialLists[0]?.id ?? null);
  const [createState,  setCreateState]  = useState<CreateState>(null);
  const [discoverTab,  setDiscoverTab]  = useState<DiscoverTab>("similar");
  const [newTitle,     setNewTitle]    = useState("");
  const [isCreating,   startCreating]  = useTransition();

  const [picker,       setPicker]       = useState<PickerMode | null>(null);
  const [pickerTab,    setPickerTab]    = useState<PickerTab>("collection");
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const [collectionResults,   setCollectionResults]   = useState<CollectionRecord[]>([]);
  const [collectionSearching, setCollectionSearching] = useState(false);
  const collectionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [discogsResults,   setDiscogsResults]   = useState<DiscogsResult[]>([]);
  const [discogsSearching, setDiscogsSearching] = useState(false);
  const discogsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [shareList,       setShareList]       = useState<UserList | null>(null);
  const [shareCanvas,     setShareCanvas]     = useState<HTMLCanvasElement | null>(null);
  const [shareGenerating, setShareGenerating] = useState(false);
  const [shareCopyState,  setShareCopyState]  = useState<"idle"|"copied"|"failed">("idle");

  const [savedCards,     setSavedCards]     = useState<SavedCardEntry[]>([]);
  const [activeSavedId,  setActiveSavedId]  = useState<string | null>(null);
  const [discoverCovers, setDiscoverCovers] = useState<Record<string, (string|null)[]>>({});

  useEffect(() => { setLists(initialLists); }, [initialLists]);

  useEffect(() => {
    if (activePillId && lists.find(l => l.id === activePillId)) return;
    setActivePillId(lists[0]?.id ?? null);
  }, [lists]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pickerTab !== "collection") return;
    if (!pickerSearch.trim()) { setCollectionResults([]); return; }
    if (collectionDebounce.current) clearTimeout(collectionDebounce.current);
    collectionDebounce.current = setTimeout(async () => {
      setCollectionSearching(true);
      try {
        const res = await fetch(`/api/collection/search?q=${encodeURIComponent(pickerSearch.trim())}`);
        const json = await res.json();
        setCollectionResults(json.results ?? []);
      } catch { setCollectionResults([]); }
      finally { setCollectionSearching(false); }
    }, 300);
    return () => { if (collectionDebounce.current) clearTimeout(collectionDebounce.current); };
  }, [pickerSearch, pickerTab]);

  useEffect(() => {
    if (pickerTab === "collection") return;
    if (!pickerSearch.trim()) { setDiscogsResults([]); return; }
    if (discogsDebounce.current) clearTimeout(discogsDebounce.current);
    discogsDebounce.current = setTimeout(async () => {
      setDiscogsSearching(true);
      try {
        const mode = pickerTab === "songs" ? "song" : "record";
        const res = await fetch(`/api/discogs/search?q=${encodeURIComponent(pickerSearch.trim())}&mode=${mode}`);
        const data = await res.json();
        setDiscogsResults(data.results ?? []);
      } catch { setDiscogsResults([]); }
      finally { setDiscogsSearching(false); }
    }, 400);
    return () => { if (discogsDebounce.current) clearTimeout(discogsDebounce.current); };
  }, [pickerSearch, pickerTab]);

  // Fetch artwork for static discover cards on mount
  useEffect(() => {
    async function fetchCardCovers(cardId: string, queries: string[]) {
      const covers = await Promise.all(queries.map(async (q) => {
        try {
          const res = await fetch(`/api/discogs/search?q=${encodeURIComponent(q)}&mode=record`);
          if (!res.ok) return null;
          const data = await res.json();
          const first = data.results?.[0];
          if (!first) return null;
          return (first.cover_image && !first.cover_image.includes("spacer"))
            ? first.cover_image
            : (first.thumb && !first.thumb.includes("spacer") ? first.thumb : null);
        } catch { return null; }
      }));
      setDiscoverCovers(prev => ({ ...prev, [cardId]: covers }));
    }
    Object.entries(DISCOVER_CARD_QUERIES).forEach(([cardId, queries]) => {
      fetchCardCovers(cardId, queries);
    });
  }, []);

  function openPicker(mode: PickerMode) {
    setPicker(mode);
    setPickerTab("collection");
    setPickerSearch("");
    setCollectionResults([]);
    setDiscogsResults([]);
    setTimeout(() => {
      pickerRef.current?.querySelector("input")?.focus();
      pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  function closePicker() {
    setPicker(null);
    setPickerSearch("");
    setCollectionResults([]);
    setDiscogsResults([]);
  }

  function optimisticSet(listId: string, position: number, item: SlotItem) {
    setLists(prev => prev.map(l =>
      l.id !== listId ? l : {
        ...l,
        slots: l.slots.some(s => s.position === position)
          ? l.slots.map(s => s.position === position ? { ...s, item } : s)
          : [...l.slots, { position, item }].sort((a, b) => a.position - b.position),
      }
    ));
  }

  async function handlePickCollectionRecord(record: CollectionRecord) {
    if (!picker) return;
    const { listId } = picker;
    const slotItem: SlotItem = {
      id: record.id, item_type: "record",
      artist: record.artist, album: record.album, year: record.year,
      genre: record.genre, cover_url: record.cover_url, song_title: null,
    };
    if (picker.strategy === "replace") {
      const { position } = picker;
      optimisticSet(listId, position, slotItem);
      closePicker();
      setSaving(`${listId}-${position}`);
      const res = await setListRecord(listId, position, record.id);
      setSaving(null);
      if (res?.error) { console.error(res.error); setLists(initialLists); }
    } else {
      closePicker();
      const res = await appendRecordToList(listId, record.id);
      if (res?.success && res.position) optimisticSet(listId, res.position, slotItem);
      else if (res?.error) console.error(res.error);
    }
    router.refresh();
  }

  async function handlePickDiscogsRecord(result: DiscogsResult) {
    if (!picker) return;
    const { listId } = picker;
    const { artist, album } = parseTitle(result.title);
    const payload: DiscogsPayload = {
      discogs_id: String(result.id), artist, album,
      year: result.year ? parseInt(result.year, 10) : null,
      genre: result.genre?.[0] ?? null,
      cover_url: (result.cover_image && !result.cover_image.includes("spacer"))
        ? result.cover_image : result.thumb ?? null,
      label: result.label?.[0] ?? null,
    };
    closePicker();
    if (picker.strategy === "replace") {
      const { position } = picker;
      setSaving(`${listId}-${position}`);
      const res = await addDiscogsRecordToList(listId, position, payload);
      setSaving(null);
      if (res?.error) { console.error(res.error); setLists(initialLists); }
      else if (res?.item) optimisticSet(listId, position, res.item as SlotItem);
    } else {
      const res = await appendDiscogsRecordToList(listId, payload);
      if (res?.error) console.error(res.error);
      else if (res?.item && res.position) optimisticSet(listId, res.position, res.item as SlotItem);
    }
    router.refresh();
  }

  async function handlePickSong(result: DiscogsResult) {
    if (!picker) return;
    const { listId } = picker;
    const { artist, album: songTitle } = parseTitle(result.title);
    const payload: SongPayload = {
      song_title: songTitle, song_artist: artist, song_album: "",
      song_cover_url: (result.cover_image && !result.cover_image.includes("spacer"))
        ? result.cover_image : result.thumb ?? null,
      song_year: result.year ? parseInt(result.year, 10) : null,
    };
    const tempItem: SlotItem = {
      id: `temp-${result.id}`, item_type: "song",
      artist, album: "", year: payload.song_year,
      genre: null, cover_url: payload.song_cover_url, song_title: songTitle,
    };
    closePicker();
    if (picker.strategy === "replace") {
      const { position } = picker;
      optimisticSet(listId, position, tempItem);
      setSaving(`${listId}-${position}`);
      const res = await addSongToList(listId, position, payload);
      setSaving(null);
      if (res?.error) { console.error(res.error); setLists(initialLists); }
      else if (res?.item) optimisticSet(listId, position, res.item as SlotItem);
    } else {
      const res = await appendSongToList(listId, payload);
      if (res?.error) console.error(res.error);
      else if (res?.item && res.position) optimisticSet(listId, res.position, res.item as SlotItem);
    }
    router.refresh();
  }

  async function handleRemoveItem(listId: string, position: number) {
    setLists(prev => prev.map(l =>
      l.id !== listId ? l : { ...l, slots: l.slots.filter(s => s.position !== position) }
    ));
    const res = await removeListItem(listId, position);
    if (res?.error) { console.error(res.error); setLists(initialLists); }
    router.refresh();
  }

  async function handleDeleteList(listId: string) {
    const remaining = lists.filter(l => l.id !== listId);
    setLists(remaining);
    if (activePillId === listId) { setActivePillId(remaining[0]?.id ?? null); closePicker(); }
    const res = await deleteList(listId);
    if (res?.error) { console.error(res.error); setLists(initialLists); }
    router.refresh();
  }

  async function handleTogglePublic(listId: string) {
    setLists(prev => prev.map(l => l.id !== listId ? l : { ...l, is_public: !l.is_public }));
    const res = await toggleListPublic(listId);
    if (res?.error) { setLists(initialLists); router.refresh(); }
  }

  async function handleShare(list: UserList) {
    setShareList(list);
    setShareCanvas(null);
    setShareGenerating(true);
    setShareCopyState("idle");
    try {
      const canvas = await generateShareCard({
        title: list.title,
        slots: list.slots.map(s => ({
          position: s.position,
          record: s.item ? { artist: s.item.artist, album: s.item.song_title ?? s.item.album, cover_url: s.item.cover_url } : null,
        })),
        username,
      });
      setShareCanvas(canvas);
    } finally { setShareGenerating(false); }
  }

  function handleCloseShare() { setShareList(null); setShareCanvas(null); setShareCopyState("idle"); }

  async function handleCopyImage() {
    if (!shareCanvas) return;
    const ok = await copyCardToClipboard(shareCanvas);
    setShareCopyState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setShareCopyState("idle"), 2500);
  }

  function handleSaveCard(entry: SavedCardEntry) {
    setSavedCards(prev => prev.some(c => c.id === entry.id) ? prev : [...prev, entry]);
  }

  function doCreate(title: string, listType: "top5" | "personal") {
    startCreating(async () => {
      const res = await createList(title, listType);
      if (res?.success && res.list) {
        const newList: UserList = {
          id: res.list.id, title: res.list.title, slug: res.list.slug,
          is_public: res.list.is_public, list_type: res.list.list_type as "top5" | "personal",
          slots: [],
        };
        setLists(prev => [...prev, newList]);
        setNewTitle("");
        setCreateState(null);
        setActivePillId(newList.id);
        setActiveSavedId(null);
        router.refresh();
      }
    });
  }

  function handleCreateSubmit(e: React.FormEvent, listType: "top5" | "personal") {
    e.preventDefault();
    if (!newTitle.trim() || isCreating) return;
    doCreate(listType === "top5" ? `Top 5 ${newTitle.trim()}` : newTitle.trim(), listType);
  }

  const selectedList = activePillId ? lists.find(l => l.id === activePillId) ?? null : null;

  const activeSavedCard = useMemo(
    () => activeSavedId ? savedCards.find(c => c.id === activeSavedId) ?? null : null,
    [activeSavedId, savedCards]
  );

  const filteredDiscoverLists = useMemo(() => {
    if (discoverTab === "trending") return [...discoverLists].sort((a, b) => b.itemCount - a.itemCount);
    return discoverLists;
  }, [discoverLists, discoverTab]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100vh", background: "#ffffff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Pill strip — untouched ── */}
      <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", padding: "10px 32px", gap: "8px",
          overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none",
        } as React.CSSProperties}>
          <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", flexShrink: 0, marginRight: "6px" }}>
            Your lists
          </span>
          {lists.map(list => {
            const filled = list.slots.filter(s => s.item).length;
            const isActive = activePillId === list.id;
            return (
              <button key={list.id}
                onClick={() => { setActivePillId(list.id); setActiveSavedId(null); closePicker(); }}
                style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                  color: isActive ? ORANGE : list.is_public ? "#555555" : "#aaaaaa",
                  background: "none",
                  border: `1px ${list.is_public ? "solid" : "dashed"} ${isActive ? ORANGE : "rgba(0,0,0,0.18)"}`,
                  borderRadius: "2px", cursor: "pointer", padding: "4px 10px",
                  flexShrink: 0, whiteSpace: "nowrap", transition: "border-color 0.15s, color 0.15s",
                }}
              >
                {list.list_type === "top5" ? `${list.title} · ${filled}/5` : `${list.title} · ${list.slots.length}`}
              </button>
            );
          })}
          <button
            onClick={() => { setCreateState({ listType: "top5", step: "templates" }); setNewTitle(""); }}
            style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
              color: ORANGE, background: "none", border: `1px dashed ${ORANGE}`,
              borderRadius: "2px", cursor: "pointer", padding: "4px 10px",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            + New list
          </button>

          {/* Saved section divider */}
          <div style={{ width: "1px", height: "18px", background: "rgba(0,0,0,0.14)", flexShrink: 0, margin: "0 6px" }} />

          <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", flexShrink: 0, marginRight: "4px" }}>
            Saved
          </span>
          {savedCards.length === 0 ? (
            <span style={{ fontFamily: MONO, fontSize: "9px", color: "#d0d0d0", letterSpacing: "0.04em", flexShrink: 0, fontStyle: "italic" }}>
              No saved lists yet
            </span>
          ) : (
            savedCards.map(card => {
              const isActive = activeSavedId === card.id;
              return (
                <button key={card.id}
                  onClick={() => { setActiveSavedId(card.id); setActivePillId(null); closePicker(); }}
                  style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                    color: isActive ? ORANGE : "#888888",
                    background: "none",
                    border: `1px solid ${isActive ? ORANGE : "rgba(0,0,0,0.15)"}`,
                    borderRadius: "2px", cursor: "pointer", padding: "4px 10px",
                    flexShrink: 0, whiteSpace: "nowrap", transition: "border-color 0.15s, color 0.15s",
                  }}
                >
                  {card.title}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Two-column grid: left 55% + right Discover 45% ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "55fr 45fr", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT — single scrollable column */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {selectedList ? (
            <div style={{ flex: 1, padding: "24px 28px 28px", overflowY: "auto", minHeight: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, marginBottom: "10px" }}>
                リスト · {selectedList.is_public ? "Public List" : "Private List"}
              </p>
              <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: "#0d0d0d", lineHeight: 1.15, marginBottom: "5px" }}>
                {selectedList.title}
              </h2>
              {LIST_SUBTITLES[selectedList.title] && (
                <p style={{ fontFamily: MONO, fontStyle: "italic", fontSize: "11px", color: "#aaaaaa", lineHeight: 1.5, marginBottom: "20px", letterSpacing: "0.02em" }}>
                  {LIST_SUBTITLES[selectedList.title]}
                </p>
              )}

              <div style={{ marginBottom: "20px" }}>
                {selectedList.list_type === "top5" ? (
                  [1, 2, 3, 4, 5].map(pos => {
                    const slot = selectedList.slots.find(s => s.position === pos);
                    const isActive = picker?.listId === selectedList.id && "position" in picker && picker.position === pos;
                    return (
                      <TracklistRow
                        key={pos}
                        position={pos}
                        item={slot?.item ?? null}
                        isSaving={saving === `${selectedList.id}-${pos}`}
                        isPickerOpen={isActive}
                        onOpen={() => openPicker({ listId: selectedList.id, position: pos, strategy: "replace" })}
                        onRemove={() => handleRemoveItem(selectedList.id, pos)}
                      />
                    );
                  })
                ) : (
                  <>
                    {selectedList.slots.map(slot => (
                      <PersonalRow key={slot.position} slot={slot} onRemove={() => handleRemoveItem(selectedList.id, slot.position)} />
                    ))}
                    {selectedList.slots.length < 20 && (
                      <button
                        onClick={() => openPicker({ listId: selectedList.id, strategy: "append" })}
                        style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "12px", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "8px 0", display: "block" }}
                      >
                        + Add a record
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* List actions footer */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                {selectedList.list_type === "top5" && (
                  <button
                    onClick={() => handleShare(selectedList)}
                    style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff", background: ORANGE, border: "none", cursor: "pointer", padding: "6px 12px" }}
                  >
                    Share ↗
                  </button>
                )}
                <button
                  onClick={() => handleTogglePublic(selectedList.id)}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: "pointer", padding: "5px 10px", color: selectedList.is_public ? "#555555" : "#aaaaaa" }}
                >
                  {selectedList.is_public ? "Public" : "Private"}
                </button>
                <button
                  onClick={() => handleDeleteList(selectedList.id)}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#cccccc" }}
                >
                  Delete
                </button>
              </div>

              {/* Search panel — directly below footer */}
              <div ref={pickerRef} style={{ marginTop: "20px", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: "16px" }}>
                {picker?.listId === selectedList.id ? (
                  <>
                    <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "14px" }}>
                      {"position" in picker ? `Add to slot ${picker.position}` : "Add to list"}
                    </p>

                    {/* Tabs */}
                    <div style={{ display: "flex", gap: "20px", borderBottom: "1px solid rgba(0,0,0,0.08)", marginBottom: "14px" }}>
                      {([
                        { key: "collection" as PickerTab, label: "My Collection" },
                        { key: "discogs"    as PickerTab, label: "Discogs" },
                        { key: "songs"      as PickerTab, label: "Song" },
                      ]).map(({ key, label }) => (
                        <button key={key}
                          onClick={() => { setPickerTab(key); setPickerSearch(""); setCollectionResults([]); setDiscogsResults([]); }}
                          style={{
                            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                            color: pickerTab === key ? "#0d0d0d" : "#aaaaaa",
                            background: "none", border: "none",
                            borderBottom: `2px solid ${pickerTab === key ? "#0d0d0d" : "transparent"}`,
                            cursor: "pointer", padding: "0 0 8px", marginBottom: "-1px",
                            transition: "color 0.15s",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder={
                        pickerTab === "collection" ? "Search your collection…" :
                        pickerTab === "songs"      ? "Search by song title…" :
                                                     "Search Discogs…"
                      }
                      autoComplete="off"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        fontFamily: MONO, fontSize: "12px", letterSpacing: "0.02em",
                        color: "#0d0d0d", background: "transparent",
                        border: "none", borderBottom: "1px solid rgba(0,0,0,0.12)",
                        outline: "none", padding: "0 0 8px", marginBottom: "14px",
                      }}
                    />

                    {pickerTab === "collection" && (
                      !pickerSearch.trim() ? (
                        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", letterSpacing: "0.04em" }}>Type to search your collection.</p>
                      ) : collectionSearching ? (
                        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>Searching…</p>
                      ) : collectionResults.length === 0 ? (
                        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa" }}>No results for &ldquo;{pickerSearch}&rdquo;</p>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {collectionResults.map(r => (
                            <PickerRow key={r.id} cover={r.cover_url} primary={r.album} secondary={r.artist} onClick={() => handlePickCollectionRecord(r)} />
                          ))}
                        </ul>
                      )
                    )}

                    {(pickerTab === "discogs" || pickerTab === "songs") && (
                      discogsSearching ? (
                        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>Searching…</p>
                      ) : !pickerSearch.trim() ? (
                        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", letterSpacing: "0.04em" }}>
                          {pickerTab === "songs" ? "Type a song title to search." : "Type to search the Discogs database."}
                        </p>
                      ) : discogsResults.length === 0 ? (
                        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa" }}>No results for &ldquo;{pickerSearch}&rdquo;</p>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {discogsResults.map(r => {
                            const { artist, album: title } = parseTitle(r.title);
                            const thumb = r.thumb && !r.thumb.includes("spacer") ? r.thumb : null;
                            return (
                              <PickerRow
                                key={r.id} cover={thumb} primary={title}
                                secondary={`${artist}${r.year ? ` · ${r.year}` : ""}`}
                                onClick={() => pickerTab === "songs" ? handlePickSong(r) : handlePickDiscogsRecord(r)}
                              />
                            );
                          })}
                        </ul>
                      )
                    )}
                  </>
                ) : (
                  <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "13px", color: "#d8d8d8", lineHeight: 1.5 }}>
                    Click a record slot to add
                  </p>
                )}
              </div>
            </div>
          ) : activeSavedCard ? (
            <div style={{ flex: 1, padding: "24px 28px 20px", overflowY: "auto", minHeight: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, marginBottom: "10px" }}>
                Saved List
              </p>
              <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: "#0d0d0d", lineHeight: 1.15, marginBottom: "8px" }}>
                {activeSavedCard.title}
              </h2>
              <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", letterSpacing: "0.06em" }}>
                @{activeSavedCard.username}
              </p>
              <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "12px", color: "#d0d0d0", marginTop: "40px", lineHeight: 1.5 }}>
                Full list view coming soon.
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "14px", color: "#d8d8d8" }}>No list selected</p>
            </div>
          )}
        </div>

        {/* RIGHT — Discover column (45%) */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "sticky", top: 0, background: "#ffffff", zIndex: 1, padding: "24px 24px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontFamily: SERIF, fontSize: "16px", fontWeight: 400, color: "#0d0d0d", marginBottom: "12px" }}>
              Discover
            </h2>
            <div style={{ display: "flex", gap: "20px" }}>
              {(["similar", "trending", "all"] as DiscoverTab[]).map(tab => (
                <button key={tab} onClick={() => setDiscoverTab(tab)} style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                  background: "none", border: "none", cursor: "pointer", padding: "0 0 4px",
                  color: discoverTab === tab ? "#0d0d0d" : "#aaaaaa",
                  borderBottom: `1px solid ${discoverTab === tab ? "#0d0d0d" : "transparent"}`,
                  transition: "color 0.15s",
                }}>
                  {tab === "similar" ? "Similar taste" : tab === "trending" ? "Trending" : "All lists"}
                </button>
              ))}
            </div>
          </div>

          {STATIC_DISCOVER_CARDS.map(card => (
            <DiscoverCard
              key={card.id}
              card={card}
              covers={discoverCovers[card.id]}
              onSave={() => handleSaveCard({ id: card.id, title: card.title, username: card.username })}
              saved={savedCards.some(c => c.id === card.id)}
            />
          ))}

          {filteredDiscoverLists.map(list => (
            <RealDiscoverCard
              key={list.id}
              list={list}
              onSave={() => handleSaveCard({ id: list.id, title: list.title, username: list.username })}
              saved={savedCards.some(c => c.id === list.id)}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {createState && (
        <CreateModal
          state={createState}
          newTitle={newTitle}
          isCreating={isCreating}
          onChangeTitle={setNewTitle}
          onChangeState={setCreateState}
          onClose={() => { setCreateState(null); setNewTitle(""); }}
          onSelect={(title, listType) => doCreate(title, listType)}
          onSubmit={handleCreateSubmit}
        />
      )}
      {shareList && (
        <ShareCardModal
          list={shareList}
          canvas={shareCanvas}
          generating={shareGenerating}
          copyState={shareCopyState}
          username={username}
          onClose={handleCloseShare}
          onDownload={() => shareCanvas && shareList && downloadCard(shareCanvas, shareList.title)}
          onCopy={handleCopyImage}
        />
      )}
    </div>
  );
}

// ─── TracklistRow ─────────────────────────────────────────────────────────────

function TracklistRow({ position, item, isSaving, isPickerOpen, onOpen, onRemove }: {
  position: number;
  item: SlotItem | null;
  isSaving: boolean;
  isPickerOpen: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)",
        minHeight: "60px", cursor: "pointer",
        background: isPickerOpen ? "rgba(204,85,0,0.025)" : "transparent",
        transition: "background 0.1s",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontFamily: MONO, fontSize: "10px", color: ORANGE, width: "16px", flexShrink: 0, textAlign: "right" }}>
        {position}
      </span>
      <div style={{
        width: 48, height: 48, flexShrink: 0, overflow: "hidden",
        background: "#f0f0f0",
        border: item ? "none" : "1.5px dashed rgba(0,0,0,0.18)",
        boxSizing: "border-box",
      }}>
        {item?.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </div>
      {item ? (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: SERIF, fontSize: "12px", color: "#0d0d0d", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.song_title ?? item.album}
            </p>
            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", letterSpacing: "0.06em", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.artist}
            </p>
          </div>
          {isSaving && (
            <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", letterSpacing: "0.08em", flexShrink: 0 }}>Saving…</span>
          )}
          {!isSaving && hovered && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{ fontFamily: MONO, fontSize: "14px", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "0 4px", lineHeight: 1, flexShrink: 0 }}
            >
              ×
            </button>
          )}
        </>
      ) : (
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "12px", color: isPickerOpen ? "#888888" : "#cccccc" }}>
          + Add a record
        </span>
      )}
    </div>
  );
}

// ─── PersonalRow ──────────────────────────────────────────────────────────────

function PersonalRow({ slot, onRemove }: { slot: ListSlot; onRemove: () => void }) {
  const { item } = slot;
  if (!item) return null;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", minHeight: "38px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", width: "16px", flexShrink: 0, textAlign: "right" }}>
        {slot.position}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "11px", color: "#0d0d0d", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.song_title ?? item.album}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", letterSpacing: "0.06em", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.artist}{item.year ? ` · ${item.year}` : ""}
        </p>
      </div>
      {hovered && (
        <button
          onClick={onRemove}
          style={{ fontFamily: MONO, fontSize: "14px", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── PickerRow ────────────────────────────────────────────────────────────────

function PickerRow({ cover, primary, secondary, onClick }: {
  cover: string | null; primary: string; secondary: string; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <li
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        cursor: "pointer", padding: "7px 0",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        background: hovered ? "rgba(204,85,0,0.02)" : "transparent",
        listStyle: "none",
      }}
    >
      <div style={{ width: 30, height: 30, background: "#f4f4f4", flexShrink: 0, overflow: "hidden", borderRadius: 1 }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "11px", color: "#0d0d0d", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</p>
        <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", letterSpacing: "0.06em", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{secondary}</p>
      </div>
      <span style={{ fontFamily: MONO, fontSize: "9px", color: ORANGE, flexShrink: 0, letterSpacing: "0.04em" }}>
        Add →
      </span>
    </li>
  );
}

// ─── DiscoverCard ─────────────────────────────────────────────────────────────

function DiscoverCard({ card, covers, onSave, saved }: {
  card: typeof STATIC_DISCOVER_CARDS[number];
  covers?: (string|null)[];
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ height: 80, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", overflow: "hidden" }}>
        {card.colors.map((color, i) => {
          const cover = covers?.[i];
          return cover ? (
            <div key={i} style={{ overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ) : (
            <div key={i} style={{ background: color }} />
          );
        })}
      </div>
      <div style={{ padding: "14px 20px 16px" }}>
        <p style={{ fontFamily: SERIF, fontSize: "13px", color: "#0d0d0d", lineHeight: 1.35, marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", letterSpacing: "0.06em", marginBottom: "10px" }}>
          @{card.username} · {card.count}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ fontFamily: MONO, fontSize: "9px", color: "#888888", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.badge}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            <button
              onClick={onSave}
              disabled={saved}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
                color: saved ? "#aaaaaa" : ORANGE,
                background: "none", border: "none",
                cursor: saved ? "default" : "pointer",
                padding: 0,
              }}
            >
              {saved ? "Saved ✓" : "Save ↓"}
            </button>
            <span style={{ fontFamily: MONO, fontSize: "9px", color: ORANGE, letterSpacing: "0.04em" }}>
              {card.saves.toLocaleString()} saves
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RealDiscoverCard ─────────────────────────────────────────────────────────

function RealDiscoverCard({ list, onSave, saved }: {
  list: DiscoverList;
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ height: 80, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", overflow: "hidden" }}>
        {[0, 1, 2, 3].map(i => {
          const cover = list.covers[i];
          return cover ? (
            <div key={i} style={{ overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ) : (
            <div key={i} style={{ background: "#f0f0f0" }} />
          );
        })}
      </div>
      <div style={{ padding: "14px 20px 16px" }}>
        <p style={{ fontFamily: SERIF, fontSize: "13px", color: "#0d0d0d", lineHeight: 1.35, marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {list.title}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", letterSpacing: "0.06em", marginBottom: "10px" }}>
          @{list.username} · {list.itemCount} records
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={onSave}
            disabled={saved}
            style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
              color: saved ? "#aaaaaa" : ORANGE,
              background: "none", border: "none",
              cursor: saved ? "default" : "pointer",
              padding: 0,
            }}
          >
            {saved ? "Saved ✓" : "Save ↓"}
          </button>
          <span style={{ fontFamily: MONO, fontSize: "9px", color: ORANGE, letterSpacing: "0.04em" }}>
            {list.saveCount} saves
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── CreateModal ──────────────────────────────────────────────────────────────

function CreateModal({ state, newTitle, isCreating, onChangeTitle, onChangeState, onClose, onSelect, onSubmit }: {
  state: NonNullable<CreateState>;
  newTitle: string;
  isCreating: boolean;
  onChangeTitle: (v: string) => void;
  onChangeState: (s: CreateState) => void;
  onClose: () => void;
  onSelect: (title: string, listType: "top5" | "personal") => void;
  onSubmit: (e: React.FormEvent, listType: "top5" | "personal") => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const templates = state.listType === "top5" ? TOP5_TEMPLATES : PERSONAL_TEMPLATES;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", width: "100%", maxWidth: "660px", padding: "40px" }}>
        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "6px" }}>New list</p>
            <div style={{ display: "flex", gap: "20px" }}>
              {(["top5", "personal"] as const).map(lt => (
                <button key={lt}
                  onClick={() => onChangeState({ listType: lt, step: "templates" })}
                  style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 400, color: state.listType === lt ? "#0d0d0d" : "#cccccc", background: "none", border: "none", cursor: "pointer", padding: 0, borderBottom: `1px solid ${state.listType === lt ? "#0d0d0d" : "transparent"}`, paddingBottom: "2px" }}
                >
                  {lt === "top5" ? "Top 5 list" : "Personal list"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {state.step === "templates" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
            {templates.map(t => {
              const isLoading = active === t.title && isCreating;
              return (
                <button key={t.title} disabled={isCreating}
                  onClick={() => { setActive(t.title); if (t.isCustom) onChangeState({ ...state, step: "custom" }); else onSelect(t.title, state.listType); }}
                  style={{ textAlign: "left", padding: "16px 14px", background: "#fff", border: `1px solid ${active === t.title ? ORANGE : "rgba(0,0,0,0.1)"}`, cursor: isCreating ? "wait" : "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => { if (!isCreating) (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}
                  onMouseLeave={e => { if (active !== t.title) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
                >
                  <p style={{ fontFamily: SERIF, fontSize: "13px", color: isLoading ? ORANGE : "#0d0d0d", lineHeight: 1.35, marginBottom: "8px" }}>
                    {isLoading ? "Creating…" : t.isCustom ? "+ Custom" : t.title}
                  </p>
                  <div style={{ height: "1px", background: "rgba(0,0,0,0.07)", marginBottom: "8px" }} />
                  <p style={{ fontFamily: MONO, fontStyle: "italic", fontSize: "10px", color: "#999999", letterSpacing: "0.03em", lineHeight: 1.5 }}>{t.subtitle}</p>
                </button>
              );
            })}
          </div>
        )}

        {state.step === "custom" && (
          <form onSubmit={e => onSubmit(e, state.listType)} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "baseline", borderBottom: "1px solid rgba(0,0,0,0.2)", paddingBottom: "6px" }}>
              {state.listType === "top5" && (
                <span style={{ fontFamily: SERIF, fontSize: "20px", color: "#cccccc", whiteSpace: "nowrap", userSelect: "none" }}>Top 5{" "}</span>
              )}
              <input
                type="text" value={newTitle} onChange={e => onChangeTitle(e.target.value.replace(/^top\s+5\s+/i, ""))}
                placeholder={state.listType === "top5" ? "Rainy Day Records…" : "List name…"}
                autoFocus maxLength={60}
                style={{ flex: 1, outline: "none", fontFamily: SERIF, fontSize: "20px", color: "#0d0d0d", background: "transparent", border: "none" }}
              />
            </div>
            <button type="submit" disabled={!newTitle.trim() || isCreating}
              style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: newTitle.trim() ? ORANGE : "#cccccc", background: "none", border: "none", cursor: newTitle.trim() ? "pointer" : "default", padding: 0 }}
            >
              {isCreating ? "Creating…" : "Create →"}
            </button>
            <button type="button" onClick={() => onChangeState({ ...state, step: "templates" })}
              style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── ShareCardModal ───────────────────────────────────────────────────────────

function ShareCardModal({
  list, canvas, generating, copyState, username, onClose, onDownload, onCopy,
}: {
  list: UserList; canvas: HTMLCanvasElement | null; generating: boolean;
  copyState: "idle"|"copied"|"failed"; username: string;
  onClose: () => void; onDownload: () => void; onCopy: () => void;
}) {
  const previewUrl = useMemo(() => (canvas ? canvas.toDataURL("image/png") : null), [canvas]);
  const shareUrl   = typeof window !== "undefined" ? `${window.location.origin}/@${username}/${list.slug}` : "";
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleCopyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }
    catch { /* no-op */ }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", width: "100%", maxWidth: "480px", padding: "32px" }}>
        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "4px" }}>Share card</p>
            <h3 style={{ fontFamily: SERIF, fontSize: "20px", color: "#0d0d0d", lineHeight: 1.2 }}>{list.title}</h3>
          </div>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: "0 0 0 16px", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <div style={{ width: 270, height: 480, background: generating ? "#f9f9f9" : "#fff", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {generating && <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#cccccc" }}>Rendering…</p>}
            {previewUrl && !generating && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Share card preview" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
            )}
          </div>
        </div>

        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", textAlign: "center", marginBottom: "20px" }}>
          1080 × 1920 · PNG · Instagram Stories
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <button onClick={onDownload} disabled={!canvas}
            style={{ flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: canvas ? ORANGE : "#f0f0f0", color: canvas ? "#fff" : "#ccc", border: "none", cursor: canvas ? "pointer" : "default", padding: "13px 0" }}
          >
            Download image
          </button>
          <button onClick={onCopy} disabled={!canvas}
            style={{ flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : canvas ? "#0d0d0d" : "#ccc", border: `1px solid ${copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : canvas ? "rgba(0,0,0,0.2)" : "#e8e8e8"}`, cursor: canvas ? "pointer" : "default", padding: "13px 0", transition: "all 0.2s" }}
          >
            {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Copy failed" : "Copy image"}
          </button>
        </div>

        {list.is_public && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#aaaaaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "16px" }}>
              {shareUrl}
            </p>
            <button onClick={handleCopyLink}
              style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0, color: linkCopied ? "#22c55e" : ORANGE, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {linkCopied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
