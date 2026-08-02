"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  setListRecord, addDiscogsRecordToList, addSongToList,
  appendRecordToList, appendDiscogsRecordToList, appendSongToList,
  removeListItem, toggleListPublic, createList, deleteList,
  updateWantlistItemMeta, reorderListItems,
  type DiscogsPayload, type SongPayload,
} from "@/app/lists/actions";
import type { UserList, ListSlot, SlotItem } from "@/app/lists/types";
import type { CollectionRecord } from "@/app/collection/page";
import { generateShareCard, downloadCard, copyCardToClipboard, trackShareCard } from "@/lib/shareCard";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

// ─── Priority ─────────────────────────────────────────────────────────────────

type Priority = "must_have" | "would_love" | "someday";

const PRIORITY_LABELS: Record<Priority, string> = {
  must_have:  "Must Have",
  would_love: "Would Love",
  someday:    "Someday",
};
const PRIORITY_COLORS: Record<Priority, string> = {
  must_have:  "#CC5500",
  would_love: "#7A4E2D",
  someday:    "#999999",
};
// ─── Constants ────────────────────────────────────────────────────────────────

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
  { title: "Need to Relisten", subtitle: "Albums that deserve another chance." },
  { title: "Custom",           subtitle: "Your list, your rules.", isCustom: true as const },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  initialLists: UserList[];
  username:     string;
  listTypeFilter?: "top5" | "wantlist";
  isAdmin?:     boolean;
}

type PickerMode =
  | { listId: string; position: number; strategy: "replace" }
  | { listId: string; strategy: "append" };

type PickerTab = "collection" | "discogs" | "songs";

type CreateState =
  | null
  | { listType: "top5" | "personal"; step: "templates" | "custom" };

interface DiscogsResult {
  id: number;
  title: string;
  year?: string;
  genre?: string[];
  label?: string[];
  cover_image?: string;
  thumb?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTitle(title: string): { artist: string; album: string } {
  const idx = title.indexOf(" - ");
  if (idx === -1) return { artist: "", album: title };
  return { artist: title.slice(0, idx), album: title.slice(idx + 3) };
}

function reorderSlots(slots: ListSlot[], fromPos: number, toPos: number): ListSlot[] {
  if (fromPos === toPos) return slots;
  return slots.map(s => {
    if (s.position === fromPos) return { ...s, position: toPos };
    if (fromPos < toPos && s.position > fromPos && s.position <= toPos) return { ...s, position: s.position - 1 };
    if (fromPos > toPos && s.position >= toPos && s.position < fromPos) return { ...s, position: s.position + 1 };
    return s;
  }).sort((a, b) => a.position - b.position);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileListsTab({ initialLists, username, listTypeFilter, isAdmin }: Props) {
  const router = useRouter();

  const [lists,        setLists]       = useState<UserList[]>(initialLists);
  const [activePillId, setActivePillId] = useState<string | null>(
    (initialLists.find(l => l.slug === "wantlist" || l.slug === "want-to-buy") ?? initialLists[0])?.id ?? null
  );

  function pickDefault(arr: UserList[]): string | null {
    if (!listTypeFilter) {
      const wl = arr.find(l => l.slug === "wantlist" || l.slug === "want-to-buy");
      return (wl ?? arr[0])?.id ?? null;
    }
    return arr[0]?.id ?? null;
  }
  const [createState, setCreateState] = useState<CreateState>(null);
  const [newTitle,    setNewTitle]    = useState("");
  const [isCreating,  startCreating]  = useTransition();

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

  type WantlistSort = "priority" | "date_added" | "artist";
  const [wantlistSort,         setWantlistSort]         = useState<WantlistSort>("date_added");
  const [wantlistFilter,       setWantlistFilter]       = useState<Set<Priority>>(new Set());
  const [wantlistSearch,       setWantlistSearch]       = useState("");
  const [wantlistSourceFilter, setWantlistSourceFilter] = useState<"discogs" | "rekodo" | null>(null);
  const [wantlistTagFilter,    setWantlistTagFilter]    = useState<Set<string>>(new Set());
  const [keptSomeday,          setKeptSomeday]          = useState<Set<number>>(new Set());
  const WANTLIST_PAGE_SIZE = 50;
  const [wantlistVisibleCount, setWantlistVisibleCount] = useState(WANTLIST_PAGE_SIZE);

  const [dragFromPos, setDragFromPos] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<number | null>(null);

  const [isMobile,     setIsMobile]     = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<{ artist: string; album: string } | null>(null);
  const [likeCounts,   setLikeCounts]   = useState<Record<string, number>>({});

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch like counts for all lists
  useEffect(() => {
    const ids = lists.map(l => l.id).filter(Boolean);
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

  // If the server didn't provide lists, fetch them client-side
  useEffect(() => {
    if (initialLists.length > 0) return;
    let cancelled = false;
    fetch("/api/lists/mine")
      .then(r => r.json())
      .then((json: { lists?: UserList[] }) => {
        if (cancelled) return;
        let fetched: UserList[] = json.lists ?? [];
        if (listTypeFilter === "top5") {
          fetched = fetched.filter(l => l.list_type === "top5");
        } else if (listTypeFilter === "wantlist") {
          fetched = fetched.filter(l => l.slug === "wantlist" || l.slug === "want-to-buy");
        }
        setLists(fetched);
        setActivePillId(pickDefault(fetched));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActivePillId(prev => {
      if (prev && lists.find(l => l.id === prev)) return prev;
      return pickDefault(lists);
    });
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
      const prevLists = lists;
      optimisticSet(listId, position, slotItem);
      closePicker();
      const res = await setListRecord(listId, position, record.id);
      if (res?.error) { console.error(res.error); setLists(prevLists); }
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
      const prevLists = lists;
      const res = await addDiscogsRecordToList(listId, position, payload);
      if (res?.error) { console.error(res.error); setLists(prevLists); }
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
      const prevLists = lists;
      optimisticSet(listId, position, tempItem);
      const res = await addSongToList(listId, position, payload);
      if (res?.error) { console.error(res.error); setLists(prevLists); }
      else if (res?.item) optimisticSet(listId, position, res.item as SlotItem);
    } else {
      const res = await appendSongToList(listId, payload);
      if (res?.error) console.error(res.error);
      else if (res?.item && res.position) optimisticSet(listId, res.position, res.item as SlotItem);
    }
    router.refresh();
  }

  async function handleRemoveItem(listId: string, position: number) {
    const prevLists = lists;
    setLists(prev => prev.map(l =>
      l.id !== listId ? l : { ...l, slots: l.slots.filter(s => s.position !== position) }
    ));
    const res = await removeListItem(listId, position);
    if (res?.error) { console.error(res.error); setLists(prevLists); }
    router.refresh();
  }

  async function handleDeleteList(listId: string) {
    const prevLists = lists;
    const remaining = lists.filter(l => l.id !== listId);
    setLists(remaining);
    if (activePillId === listId) { setActivePillId(remaining[0]?.id ?? null); closePicker(); }
    const res = await deleteList(listId);
    if (res?.error) { console.error(res.error); setLists(prevLists); }
    router.refresh();
  }

  async function handleTogglePublic(listId: string) {
    const prevLists = lists;
    setLists(prev => prev.map(l => l.id !== listId ? l : { ...l, is_public: !l.is_public }));
    const res = await toggleListPublic(listId);
    if (res?.error) { setLists(prevLists); router.refresh(); }
  }

  async function handleUpdateWantlistItemMeta(
    listId: string, position: number,
    updates: { note?: string | null; priority?: Priority | null; price_cap?: number | null; pressing_tip?: string | null; found?: boolean | null; user_tags?: string[] }
  ) {
    const prevLists = lists;
    setLists(prev => prev.map(l => l.id !== listId ? l : {
      ...l,
      slots: l.slots.map(s => s.position !== position ? s : { ...s, ...updates }),
    }));
    const res = await updateWantlistItemMeta(listId, position, updates);
    if (res?.error) { console.error(res.error); setLists(prevLists); }
  }

  async function handleReorder(listId: string, fromPos: number, toPos: number) {
    if (fromPos === toPos) return;
    const prevLists = lists;
    setLists(prev => prev.map(l =>
      l.id !== listId ? l : { ...l, slots: reorderSlots(l.slots, fromPos, toPos) }
    ));
    const res = await reorderListItems(listId, fromPos, toPos);
    if (res?.error) { console.error(res.error); setLists(prevLists); }
    router.refresh();
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
      }
    });
  }

  function handleCreateSubmit(e: React.FormEvent, listType: "top5" | "personal") {
    e.preventDefault();
    if (!newTitle.trim() || isCreating) return;
    doCreate(listType === "top5" ? `Top 5 ${newTitle.trim()}` : newTitle.trim(), listType);
  }

  const selectedList = activePillId ? lists.find(l => l.id === activePillId) ?? null : null;

  const wantlistSlots = useMemo(() => {
    if (!selectedList || (selectedList.slug !== "wantlist" && selectedList.slug !== "want-to-buy")) return [];
    let slots = selectedList.slots.filter(s => s.item != null);

    if (wantlistSearch.trim()) {
      const q = wantlistSearch.trim().toLowerCase();
      slots = slots.filter(s => {
        const artist = (s.item?.artist ?? "").toLowerCase();
        const album  = (s.item?.album ?? "").toLowerCase();
        return artist.includes(q) || album.includes(q);
      });
    }

    if (wantlistFilter.size > 0) {
      slots = slots.filter(s => {
        const p = (s.priority ?? null) as Priority | null;
        return p && wantlistFilter.has(p);
      });
    }

    if (wantlistSourceFilter === "discogs") {
      slots = slots.filter(s => s.source === "discogs");
    } else if (wantlistSourceFilter === "rekodo") {
      slots = slots.filter(s => s.source !== "discogs");
    }

    if (wantlistTagFilter.size > 0) {
      slots = slots.filter(s =>
        (s.user_tags ?? []).some(t => wantlistTagFilter.has(t))
      );
    }

    const PRIORITY_ORDER: Record<string, number> = { must_have: 0, would_love: 1, someday: 2 };
    if (wantlistSort === "priority") {
      slots = [...slots].sort((a, b) =>
        (PRIORITY_ORDER[a.priority ?? ""] ?? 3) - (PRIORITY_ORDER[b.priority ?? ""] ?? 3)
      );
    } else if (wantlistSort === "date_added") {
      slots = [...slots].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    } else if (wantlistSort === "artist") {
      slots = [...slots].sort((a, b) => (a.item?.artist ?? "").localeCompare(b.item?.artist ?? ""));
    }

    return slots;
  }, [selectedList, wantlistSearch, wantlistFilter, wantlistSourceFilter, wantlistTagFilter, wantlistSort]);

  // All unique user-defined tags across the visible wantlist, for the filter bar
  const allUserTags = useMemo(() => {
    if (!selectedList) return [] as string[];
    const seen = new Set<string>();
    for (const slot of selectedList.slots) {
      for (const t of slot.user_tags ?? []) seen.add(t);
    }
    return [...seen].sort();
  }, [selectedList]);

  // Search/filter/sort always run over the full wantlistSlots above — this only
  // caps how many of the *matching* results get mounted as cards at once.
  useEffect(() => {
    setWantlistVisibleCount(WANTLIST_PAGE_SIZE);
  }, [wantlistSearch, wantlistFilter, wantlistSourceFilter, wantlistTagFilter, wantlistSort, selectedList?.id]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#ffffff" }}>
      <style>{`
        .pill-strip::-webkit-scrollbar { display: none; }
        .wl-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }
        @media (max-width: 1100px) { .wl-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) { .wl-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
      `}</style>

      {/* ── Wantlist ── */}
      <div style={{ maxWidth: (selectedList?.slug === "wantlist" || selectedList?.slug === "want-to-buy") ? 1440 : selectedList?.list_type === "top5" ? (activeDrawer && !isMobile ? 1440 : 1100) : (activeDrawer && !isMobile ? 960 : 680), margin: "0 auto", padding: "2rem 1.5rem 3rem", transition: "max-width 0.2s ease" }}>
        {!selectedList && lists.length === 0 ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.06em", color: "#aaaaaa" }}>
            Loading your lists…
          </p>
        ) : selectedList ? (
          <div>

              <div style={{ marginBottom: "20px" }}>
                {(selectedList.slug === "wantlist" || selectedList.slug === "want-to-buy") ? (
                  isAdmin ? <>
                    {/* Wantlist header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                      <div>
                        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 400, color: "#0d0d0d", margin: "0 0 6px", lineHeight: 1.1 }}>
                          Want List
                        </h1>
                        <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.05em", color: "#888", margin: 0 }}>
                          <span style={{ color: ORANGE, fontWeight: 700 }}>{selectedList.slots.filter(s => s.item).length}</span>
                          {" "}{selectedList.slots.filter(s => s.item).length === 1 ? "record" : "records"} on your radar
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        {(["discogs", "rekodo"] as const).map(src => {
                          const on = wantlistSourceFilter === src;
                          return (
                            <button key={src} onClick={() => setWantlistSourceFilter(on ? null : src)} style={{
                              fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
                              color: on ? "#fff" : "#aaaaaa",
                              background: on ? "#0d0d0d" : "none",
                              border: `1px solid ${on ? "#0d0d0d" : "#e0e0da"}`,
                              cursor: "pointer", padding: "5px 12px", whiteSpace: "nowrap", transition: "all 0.15s",
                            }}>
                              {src === "discogs" ? "Discogs" : "Rekōdo"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Priority + tag filter pills */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
                      {(["must_have", "would_love", "someday"] as Priority[]).map(p => {
                        const on = wantlistFilter.has(p);
                        return (
                          <button key={p} onClick={() => {
                            setWantlistFilter(prev => {
                              const next = new Set(prev);
                              if (on) next.delete(p); else next.add(p);
                              return next;
                            });
                          }} style={{
                            fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.06em",
                            color: on ? "#fff" : PRIORITY_COLORS[p],
                            background: on ? PRIORITY_COLORS[p] : "none",
                            border: `1px solid ${PRIORITY_COLORS[p]}`,
                            borderRadius: "20px", cursor: "pointer", padding: "4px 12px",
                            whiteSpace: "nowrap", transition: "all 0.15s",
                          }}>
                            {PRIORITY_LABELS[p]}
                          </button>
                        );
                      })}
                      {allUserTags.map(tag => {
                        const on = wantlistTagFilter.has(tag);
                        return (
                          <button key={tag} onClick={() => {
                            setWantlistTagFilter(prev => {
                              const next = new Set(prev);
                              if (on) next.delete(tag); else next.add(tag);
                              return next;
                            });
                          }} style={{
                            fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.04em",
                            color: on ? "#fff" : "#666",
                            background: on ? "#555" : "none",
                            border: `1px solid ${on ? "#555" : "#d0d0cc"}`,
                            borderRadius: "20px", cursor: "pointer", padding: "4px 10px",
                            whiteSpace: "nowrap", transition: "all 0.15s",
                          }}>
                            #{tag}
                          </button>
                        );
                      })}
                    </div>

                    {/* Search + sort */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "180px", position: "relative" }}>
                        <input
                          type="text"
                          value={wantlistSearch}
                          onChange={e => setWantlistSearch(e.target.value)}
                          placeholder="Search artist or album…"
                          style={{
                            width: "100%", boxSizing: "border-box",
                            fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em",
                            color: "#333", background: "#f8f7f4",
                            border: "1px solid #e8e5e0", outline: "none",
                            padding: "8px 12px 8px 32px",
                          }}
                        />
                        <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#ccc", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                        <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ccc", marginRight: "8px" }}>Sort</span>
                        {(["priority", "date_added", "artist"] as const).map(s => (
                          <button key={s} onClick={() => setWantlistSort(s)} style={{
                            fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em",
                            color: wantlistSort === s ? "#0d0d0d" : "#aaaaaa",
                            background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
                            borderBottom: `1.5px solid ${wantlistSort === s ? ORANGE : "transparent"}`,
                            transition: "all 0.15s",
                          }}>
                            {s === "priority" ? "Priority" : s === "date_added" ? "Date" : "Artist"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Card grid */}
                    <div className="wl-grid">
                      {wantlistSlots.slice(0, wantlistVisibleCount).map((slot, idx) => {
                        const monthsOld = slot.created_at
                          ? Math.floor((Date.now() - new Date(slot.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
                          : null;
                        const showSomedayPrompt =
                          slot.priority === "someday" &&
                          monthsOld !== null && monthsOld >= 6 &&
                          !keptSomeday.has(slot.position);
                        return (
                          <WantlistGridCard
                            key={slot.item?.id ?? slot.position}
                            slot={slot}
                            fetchIndex={idx}
                            monthsOld={monthsOld}
                            showSomedayPrompt={showSomedayPrompt}
                            onRemove={() => handleRemoveItem(selectedList.id, slot.position)}
                            onKeepSomeday={() => setKeptSomeday(prev => new Set([...prev, slot.position]))}
                            onUpdateMeta={updates => handleUpdateWantlistItemMeta(selectedList.id, slot.position, updates)}
                          />
                        );
                      })}
                      {/* Add record tile */}
                      <button
                        onClick={() => openPicker({ listId: selectedList.id, strategy: "append" })}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          border: "1px dashed #d8d5d0", background: "#fafaf8", cursor: "pointer",
                          aspectRatio: "1", padding: 0,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#aaa6a0"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#d8d5d0"; }}
                      >
                        <span style={{ fontSize: "1.8rem", color: "#ccc", lineHeight: 1, marginBottom: "8px" }}>+</span>
                        <span style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.07em", color: "#bbb", textAlign: "center", padding: "0 10px", lineHeight: 1.6 }}>
                          Add a record
                        </span>
                      </button>
                    </div>

                    {wantlistSlots.length > wantlistVisibleCount && (
                      <button
                        onClick={() => setWantlistVisibleCount(c => c + WANTLIST_PAGE_SIZE)}
                        style={{
                          display: "block", width: "100%", margin: "24px 0 4px",
                          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase",
                          color: ORANGE, background: "none", border: `1px solid ${ORANGE}`,
                          padding: "12px 0", cursor: "pointer",
                        }}
                      >
                        Load {Math.min(WANTLIST_PAGE_SIZE, wantlistSlots.length - wantlistVisibleCount)} more ({wantlistSlots.length - wantlistVisibleCount} remaining)
                      </button>
                    )}

                    {selectedList.slots.filter(s => s.item).length === 0 && (
                      <div style={{ margin: "48px 0 24px", textAlign: "center" }}>
                        <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: "#aaaaaa", lineHeight: 1.7, marginBottom: "16px" }}>
                          Your Wantlist is empty. Every record you&apos;ve almost bought, nearly found, or need to own belongs here.
                        </p>
                        <Link href="/dig" style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}>
                          Dig for records →
                        </Link>
                      </div>
                    )}
                  </> : <>
                    {/* Legacy wantlist layout — shown to non-admin users until grid design ships */}
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {(["must_have", "would_love", "someday"] as Priority[]).map(p => {
                            const on = wantlistFilter.has(p);
                            return (
                              <button key={p} onClick={() => {
                                setWantlistFilter(prev => { const next = new Set(prev); if (on) next.delete(p); else next.add(p); return next; });
                              }} style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: on ? PRIORITY_COLORS[p] : "#aaaaaa", background: on ? `${PRIORITY_COLORS[p]}14` : "none", border: `1px solid ${on ? PRIORITY_COLORS[p] : "#e0e0da"}`, borderRadius: "3px", cursor: "pointer", padding: "4px 10px", flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.15s" }}>
                                {PRIORITY_LABELS[p]}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          {(["discogs", "rekodo"] as const).map(src => {
                            const on = wantlistSourceFilter === src;
                            return (
                              <button key={src} onClick={() => setWantlistSourceFilter(on ? null : src)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: on ? "#0d0d0d" : "#aaaaaa", background: on ? "#0d0d0d0d" : "none", border: `1px solid ${on ? "#0d0d0d" : "#e0e0da"}`, borderRadius: "3px", cursor: "pointer", padding: "4px 10px", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                                {src === "discogs" ? "Discogs" : "Rekōdo"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ marginBottom: "10px" }}>
                        <input type="text" value={wantlistSearch} onChange={e => setWantlistSearch(e.target.value)} placeholder="Search artist or album…" style={{ width: "100%", boxSizing: "border-box", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em", color: "#333", background: "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.12)", outline: "none", padding: "0 0 6px" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", flexShrink: 0, marginRight: "4px" }}>Sort</span>
                        {(["priority", "date_added", "artist"] as const).map(s => (
                          <button key={s} onClick={() => setWantlistSort(s)} style={{ fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.05em", color: wantlistSort === s ? "#0d0d0d" : "#aaaaaa", background: "none", border: "none", cursor: "pointer", padding: "0 0 2px", borderBottom: `1px solid ${wantlistSort === s ? "#0d0d0d" : "transparent"}` }}>
                            {s === "priority" ? "Priority" : s === "date_added" ? "Date Added" : "Artist A–Z"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {wantlistSlots.slice(0, wantlistVisibleCount).map(slot => {
                      const monthsOld = slot.created_at ? Math.floor((Date.now() - new Date(slot.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)) : null;
                      const showSomedayPrompt = slot.priority === "someday" && monthsOld !== null && monthsOld >= 6 && !keptSomeday.has(slot.position);
                      return (
                        <WantlistGridCard key={slot.item?.id ?? slot.position} slot={slot} fetchIndex={0} monthsOld={monthsOld} showSomedayPrompt={showSomedayPrompt} onRemove={() => handleRemoveItem(selectedList.id, slot.position)} onKeepSomeday={() => setKeptSomeday(prev => new Set([...prev, slot.position]))} onUpdateMeta={updates => handleUpdateWantlistItemMeta(selectedList.id, slot.position, updates)} />
                      );
                    })}
                    {wantlistSlots.length > wantlistVisibleCount && (
                      <button onClick={() => setWantlistVisibleCount(c => c + WANTLIST_PAGE_SIZE)} style={{ display: "block", width: "100%", margin: "12px 0 4px", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, borderRadius: "2px", padding: "10px 0", cursor: "pointer" }}>
                        Load {Math.min(WANTLIST_PAGE_SIZE, wantlistSlots.length - wantlistVisibleCount)} more
                      </button>
                    )}
                    {selectedList.slots.filter(s => s.item).length === 0 && (
                      <div style={{ margin: "32px 0 24px" }}>
                        <p style={{ fontFamily: SERIF, fontSize: "14px", color: "#aaaaaa", lineHeight: 1.7, marginBottom: "10px" }}>Your Wantlist is empty. Every record you&apos;ve almost bought, nearly found, or need to own belongs here.</p>
                        <Link href="/dig" style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}>Dig for records →</Link>
                      </div>
                    )}
                    {selectedList.slots.length < 20 && (
                      <AddRecordButton onClick={() => openPicker({ listId: selectedList.id, strategy: "append" })} />
                    )}
                  </>
                ) : selectedList.list_type === "top5" ? (
                  <Top5Grid
                    slots={selectedList.slots}
                    onEdit={pos => openPicker({ listId: selectedList.id, position: pos, strategy: "replace" })}
                    onRemove={pos => handleRemoveItem(selectedList.id, pos)}
                    isMobile={isMobile}
                  />
                ) : (
                  <>
                    {selectedList.slots.map(slot => (
                      <PersonalRow
                        key={slot.position}
                        slot={slot}
                        onRemove={() => handleRemoveItem(selectedList.id, slot.position)}
                        isDragging={dragFromPos === slot.position}
                        isDragOver={dragOverPos === slot.position && dragFromPos !== slot.position}
                        onDragStart={() => setDragFromPos(slot.position)}
                        onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOverPos(slot.position); }}
                        onDrop={dragFromPos !== null && dragFromPos !== slot.position ? () => {
                          const from = dragFromPos;
                          setDragFromPos(null); setDragOverPos(null);
                          handleReorder(selectedList.id, from, slot.position);
                        } : undefined}
                        onDragEnd={() => { setDragFromPos(null); setDragOverPos(null); }}
                      />
                    ))}
                    {selectedList.slots.length < 20 && (
                      <AddRecordButton onClick={() => openPicker({ listId: selectedList.id, strategy: "append" })} />
                    )}
                  </>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                {selectedList.list_type === "top5" && likeCounts[selectedList.id] !== undefined && (
                  <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#aaa", marginRight: "4px" }}>
                    ♥ {likeCounts[selectedList.id]} {likeCounts[selectedList.id] === 1 ? "like" : "likes"}
                  </span>
                )}
                {selectedList.list_type === "top5" && (
                  <button onClick={() => handleShare(selectedList)}
                    style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff", background: ORANGE, border: "none", cursor: "pointer", padding: "6px 12px" }}>
                    Share ↗
                  </button>
                )}
                {selectedList.slug !== "wantlist" && selectedList.slug !== "want-to-buy" && (
                  <button onClick={() => handleTogglePublic(selectedList.id)}
                    style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: "pointer", padding: "5px 10px", color: selectedList.is_public ? "#555555" : "#aaaaaa" }}>
                    {selectedList.is_public ? "Public" : "Private"}
                  </button>
                )}
                {selectedList.slug !== "wantlist" && selectedList.slug !== "want-to-buy" && (
                  <button onClick={() => handleDeleteList(selectedList.id)}
                    style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#cccccc" }}>
                    Delete
                  </button>
                )}
              </div>

              {/* Record picker */}
              <div ref={pickerRef} style={{ marginTop: "20px", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: "16px" }}>
                {picker?.listId === selectedList.id && (
                  <>
                    <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "14px" }}>
                      {"position" in picker ? `Add to slot ${picker.position}` : "Add to list"}
                    </p>
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
                      type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
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
                              <PickerRow key={r.id} cover={thumb} primary={title}
                                secondary={`${artist}${r.year ? ` · ${r.year}` : ""}`}
                                onClick={() => pickerTab === "songs" ? handlePickSong(r) : handlePickDiscogsRecord(r)}
                              />
                            );
                          })}
                        </ul>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
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
          onClose={() => { setShareList(null); setShareCanvas(null); setShareCopyState("idle"); }}
          onDownload={() => { if (shareCanvas && shareList) { downloadCard(shareCanvas, shareList.title); trackShareCard("List", "download"); } }}
          onCopy={async () => {
            if (!shareCanvas) return;
            const ok = await copyCardToClipboard(shareCanvas);
            setShareCopyState(ok ? "copied" : "failed");
            if (ok) { trackShareCard("List", "copy"); setTimeout(() => setShareCopyState("idle"), 2500); }
          }}
        />
      )}
    </div>
  );
}

// ─── Top5Grid ─────────────────────────────────────────────────────────────────

function Top5Grid({ slots, onEdit, onRemove, isMobile }: {
  slots: ListSlot[];
  onEdit:   (position: number) => void;
  onRemove: (position: number) => void;
  isMobile?: boolean;
}) {
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "8px" }}>
        {[1, 2, 3, 4, 5].map(pos => {
          const slot = slots.find(s => s.position === pos);
          const item = slot?.item ?? null;
          return (
            <div key={pos} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontFamily: MONO, fontSize: "9px", color: "#c0c0c0", width: "14px", flexShrink: 0, textAlign: "center" }}>
                {pos}
              </span>
              <div
                onClick={() => onEdit(pos)}
                style={{ width: "56px", height: "56px", flexShrink: 0, overflow: "hidden", lineHeight: 0, cursor: "pointer" }}
              >
                {item?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_url} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "#f4f4f4", border: "1px dashed rgba(0,0,0,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: MONO, fontSize: "16px", color: "#ddd" }}>+</span>
                  </div>
                )}
              </div>
              <div onClick={() => onEdit(pos)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                {item ? (
                  <>
                    <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.07em", textTransform: "uppercase", color: "#aaa", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.artist}
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: "13px", color: "#0d0d0d", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.song_title ?? item.album}
                    </p>
                  </>
                ) : (
                  <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "13px", color: "#cccccc" }}>+ Add a record</p>
                )}
              </div>
              {item && (
                <button
                  onClick={e => { e.stopPropagation(); onRemove(pos); }}
                  style={{ fontFamily: MONO, fontSize: "16px", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "0 4px", lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "8px" }}>
      {[1, 2, 3, 4, 5].map(pos => {
        const slot = slots.find(s => s.position === pos);
        const item = slot?.item ?? null;
        const hovered = hoveredPos === pos;
        return (
          <div key={pos} style={{ minWidth: 0 }}
            onMouseEnter={() => setHoveredPos(pos)}
            onMouseLeave={() => setHoveredPos(null)}
          >
            {/* Cover art */}
            <div
              onClick={() => onEdit(pos)}
              style={{ position: "relative", overflow: "hidden", lineHeight: 0, cursor: "pointer", aspectRatio: "1/1" }}
            >
              {item?.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.cover_url} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#f4f4f4", border: "1px dashed rgba(0,0,0,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "18px", color: "#ddd" }}>+</span>
                </div>
              )}
              {/* Position badge */}
              <span style={{ position: "absolute", top: "6px", left: "6px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: item ? "rgba(255,255,255,0.85)" : "#c0c0c0", textShadow: item ? "0 1px 2px rgba(0,0,0,0.5)" : "none", lineHeight: 1 }}>
                {pos}
              </span>
              {/* Hover overlay */}
              {hovered && item && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff" }}>Change</span>
                  <button
                    onClick={e => { e.stopPropagation(); onRemove(pos); }}
                    style={{ fontFamily: MONO, fontSize: "16px", color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              )}
              {hovered && !item && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(204,85,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE }}>Add</span>
                </div>
              )}
            </div>
            {/* Text */}
            <div style={{ marginTop: "8px" }}>
              {item ? (
                <>
                  <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.07em", textTransform: "uppercase", color: "#aaa", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.artist}
                  </p>
                  <p style={{ fontFamily: SERIF, fontSize: "12px", color: "#0d0d0d", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {item.song_title ?? item.album}
                  </p>
                </>
              ) : (
                <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.07em", textTransform: "uppercase", color: "#ddd" }}>Empty</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PersonalRow ──────────────────────────────────────────────────────────────

function PersonalRow({ slot, onRemove, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }: {
  slot: ListSlot; onRemove: () => void;
  isDragging?: boolean; isDragOver?: boolean;
  onDragStart?: () => void; onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void; onDragEnd?: () => void;
}) {
  const { item } = slot;
  if (!item) return null;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      draggable
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)",
        borderTop: isDragOver ? `2px solid ${ORANGE}` : undefined,
        minHeight: "48px",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.4 : 1, transition: "opacity 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", width: "16px", flexShrink: 0, textAlign: "right" }}>
        {slot.position}
      </span>
      <div style={{ width: 36, height: 36, flexShrink: 0, overflow: "hidden", background: "#f0f0f0" }}>
        {item.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "11px", color: "#0d0d0d", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.song_title ?? item.album}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", letterSpacing: "0.06em", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.artist}{item.year ? ` · ${item.year}` : ""}
        </p>
      </div>
      {hovered && (
        <button onClick={onRemove}
          style={{ fontFamily: MONO, fontSize: "14px", color: "#cccccc", background: "none", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>
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
    <li onClick={onClick}
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
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "11px", color: "#0d0d0d", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</p>
        <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaaaaa", letterSpacing: "0.06em", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{secondary}</p>
      </div>
      <span style={{ fontFamily: MONO, fontSize: "9px", color: ORANGE, flexShrink: 0, letterSpacing: "0.04em" }}>Add →</span>
    </li>
  );
}

// ─── AddRecordButton ──────────────────────────────────────────────────────────

function AddRecordButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: SERIF, fontSize: "0.8rem",
        color: hovered ? ORANGE : "#999999",
        background: "none", border: "none", cursor: "pointer",
        padding: "10px 0", display: "block", transition: "color 0.15s",
      }}
    >
      + Add a record
    </button>
  );
}

// ─── MarketplaceDrawer ────────────────────────────────────────────────────────

type MemberRow = { username: string; avatar_url: string | null };

function MarketplaceDrawer({
  isOpen, onClose, artist, album, inline = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  artist: string;
  album: string;
  inline?: boolean;
}) {
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [members,        setMembers]      = useState<MemberRow[]>([]);
  const [membersPhase,   setMembersPhase] = useState<"idle" | "loading" | "done">("idle");
  const [confirming,     setConfirming]   = useState(false);
  const [interestSent,   setInterestSent] = useState(false);

  useEffect(() => {
    if (inline) return;
    const check = () => setIsMobileSheet(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [inline]);

  useEffect(() => {
    if (!isOpen) {
      setMembersPhase("idle");
      setMembers([]);
      setConfirming(false);
      setInterestSent(false);
      return;
    }
    setMembersPhase("loading");
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: matchingRecords } = await (supabase as any)
          .from("records")
          .select("id")
          .ilike("artist", artist)
          .ilike("album", album);
        if (!matchingRecords?.length) { setMembersPhase("done"); return; }
        const recordIds = (matchingRecords as { id: string }[]).map(r => r.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any)
          .from("public_sell_list")
          .select("user_id")
          .in("record_id", recordIds);
        if (user?.id) q = q.neq("user_id", user.id);
        const { data: sellerRows } = await q;
        if (!sellerRows?.length) { setMembersPhase("done"); return; }
        const userIds = (sellerRows as { user_id: string }[]).map(r => r.user_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("username, avatar_url")
          .in("id", userIds);
        setMembers((profiles as MemberRow[]) ?? []);
      } catch { /* silently fail */ }
      finally { setMembersPhase("done"); }
    });
  }, [isOpen, artist, album]);

  async function handleExpressInterest() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all(
      members.map(m =>
        fetch("/api/wantlist/express-interest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerUsername: m.username, artist, album }),
        })
      )
    );
    setConfirming(false);
    setInterestSent(true);
  }

  if (!isOpen) return null;

  const q = encodeURIComponent(`${artist} ${album}`);
  const qVinyl = encodeURIComponent(`${artist} ${album} vinyl record`);
  const FIND_LINKS = [
    { label: "Buy on Discogs ↗",      href: `https://www.discogs.com/search/?q=${q}&type=release` },
    { label: "Buy on eBay ↗",         href: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=306` },
    { label: "Search Google Shopping ↗", href: `https://www.google.com/search?tbm=shop&q=${qVinyl}` },
    { label: "Search Bandcamp ↗",     href: `https://bandcamp.com/search?q=${q}` },
    { label: "Search Rough Trade ↗",  href: `https://www.roughtrade.com/search?q=${q}` },
    { label: "Search Juno ↗",         href: `https://www.juno.co.uk/search/?q=${q}` },
    { label: "Search Boomkat ↗",      href: `https://boomkat.com/search?q=${q}` },
  ];
  const labelStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.14em",
    textTransform: "uppercase", color: ORANGE, margin: "0 0 10px",
  };

  const inlineStyle: React.CSSProperties = {
    background: "#FDF6F0", border: "1px solid #e0e0da", overflowY: "auto",
  };
  const sheetStyle: React.CSSProperties = isMobileSheet
    ? { position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "72vh", overflowY: "auto", background: "#FDF6F0", borderTop: "1px solid #e0e0da", zIndex: 200 }
    : { position: "fixed", right: 0, top: 0, bottom: 0, width: "380px", overflowY: "auto", background: "#FDF6F0", borderLeft: "1px solid #e0e0da", zIndex: 200 };
  const drawerStyle = inline ? inlineStyle : sheetStyle;

  return (
    <>
      {!inline && isMobileSheet && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 199 }} />
      )}
      <div style={drawerStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid #e0e0da" }}>
          <div>
            <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: "#0a0a0a", margin: 0, lineHeight: 1.2 }}>{artist}</p>
            <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "12px", color: "#555", margin: "3px 0 0" }}>{album}</p>
          </div>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", padding: "0 0 0 16px", lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <p style={labelStyle}>Find It</p>
          {FIND_LINKS.map(({ label, href }, i, arr) => (
            <div key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.05em", color: "#0a0a0a", textDecoration: "none", display: "block", padding: "8px 0" }}>
                {label}
              </a>
              {i < arr.length - 1 && <div style={{ height: "1px", background: "rgba(0,0,0,0.06)" }} />}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #e0e0da", padding: "16px 20px" }}>
          <p style={labelStyle}>Rekōdo Members</p>
          {membersPhase === "loading" && (
            <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#888", letterSpacing: "0.04em" }}>Searching members…</p>
          )}
          {membersPhase === "done" && members.length === 0 && (
            <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#888", letterSpacing: "0.04em" }}>No members currently selling this.</p>
          )}
          {membersPhase === "done" && members.length > 0 && (
            <>
              {members.map(m => (
                <div key={m.username} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", background: "#e0e0da", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {m.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: MONO, fontSize: "10px", color: "#888", textTransform: "uppercase" }}>{m.username[0]}</span>
                    }
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#0a0a0a", flex: 1 }}>@{m.username}</span>
                  <a href={`/@${m.username}`} style={{ fontFamily: MONO, fontSize: "0.7rem", color: ORANGE, textDecoration: "none", whiteSpace: "nowrap" }}>
                    View profile →
                  </a>
                </div>
              ))}
              {interestSent ? (
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#22c55e", margin: "14px 0 0", letterSpacing: "0.04em" }}>Your interest has been shared.</p>
              ) : confirming ? (
                <div style={{ marginTop: "14px", padding: "14px", background: "#fff", border: "1px solid #e0e0da" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: "#0a0a0a", lineHeight: 1.6, margin: "0 0 14px" }}>
                    Share your email with {members.length === 1 ? "this member" : "these members"} so they can reach out about <em>{artist} — {album}</em>?
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={handleExpressInterest} style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", background: "#0a0a0a", color: "#FDF6F0", border: "none", cursor: "pointer", padding: "8px 16px", flex: 1 }}>
                      Confirm
                    </button>
                    <button onClick={() => setConfirming(false)} style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", color: "#888", border: "1px solid #e0e0da", cursor: "pointer", padding: "8px 16px" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  style={{ marginTop: "14px", width: "100%", fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", background: "#0a0a0a", color: "#FDF6F0", border: "none", cursor: "pointer", padding: "12px 0" }}
                >
                  Express Interest
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── WantlistCard ─────────────────────────────────────────────────────────────

type WantlistMeta = {
  note?: string | null;
  priority?: Priority | null;
  price_cap?: number | null;
  pressing_tip?: string | null;
  found?: boolean | null;
  user_tags?: string[];
};

function WantlistGridCard({ slot, fetchIndex, monthsOld, showSomedayPrompt, onRemove, onKeepSomeday, onUpdateMeta }: {
  slot: ListSlot;
  fetchIndex: number;
  monthsOld: number | null;
  showSomedayPrompt: boolean;
  onRemove: () => void;
  onKeepSomeday: () => void;
  onUpdateMeta: (updates: WantlistMeta) => void;
}) {
  const { item } = slot;
  if (!item) return null;

  const [hovered,  setHovered]  = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(item.cover_url ?? null);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput,  setTagInput]  = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  type MarketplaceStats = { numForSale: number; lowestPrice: number | null; currency: string };
  const [marketStats, setMarketStats] = useState<MarketplaceStats | null>(null);

  useEffect(() => {
    if (coverUrl) return;
    let cancelled = false;
    fetch(`/api/discogs/search?q=${encodeURIComponent(`${item.artist} ${item.album}`)}&mode=record`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const first = data?.results?.[0];
        if (!first) return;
        const url = (first.cover_image && !first.cover_image.includes("spacer"))
          ? first.cover_image
          : (first.thumb && !first.thumb.includes("spacer") ? first.thumb : null);
        if (!url) return;
        setCoverUrl(url);
        if (item.item_type === "song") {
          createClient().from("list_items").update({ song_cover_url: url }).eq("id", item.id).then(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [item.artist, item.album]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Discogs marketplace stats staggered by card index to avoid rate limits
  useEffect(() => {
    if (!slot.discogs_release_id) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/discogs/release/${slot.discogs_release_id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (cancelled || !data) return;
          setMarketStats({
            numForSale: data.num_for_sale ?? 0,
            lowestPrice: data.lowest_price ?? null,
            currency: data.lowest_price?.currency ?? "USD",
          });
        })
        .catch(() => {});
    }, fetchIndex * 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [slot.discogs_release_id, fetchIndex]);

  const priority = (slot.priority ?? null) as Priority | null;
  const userTags = slot.user_tags ?? [];

  const discogsHref = slot.discogs_release_id
    ? `https://www.discogs.com/release/${slot.discogs_release_id}`
    : `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist} ${item.album}`)}&type=release`;

  const dateLabel = slot.created_at
    ? new Date(slot.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  function handleAddTag() {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || userTags.includes(tag) || userTags.length >= 5) return;
    onUpdateMeta({ user_tags: [...userTags, tag] });
    setTagInput("");
    setAddingTag(false);
  }

  return (
    <div
      style={{ position: "relative", display: "flex", flexDirection: "column", minWidth: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover image — square aspect ratio */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#ece9e3", overflow: "hidden", flexShrink: 0 }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "#bbb", letterSpacing: "0.1em" }}>NO COVER</span>
          </div>
        )}

        {/* Priority badge */}
        {priority && (
          <span style={{
            position: "absolute", top: "8px", left: "8px",
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.07em", textTransform: "uppercase",
            background: PRIORITY_COLORS[priority], color: "#fff",
            padding: "2px 6px", lineHeight: 1.4,
          }}>
            {PRIORITY_LABELS[priority]}
          </span>
        )}

        {/* Source badge */}
        {slot.source === "discogs" && (
          <span style={{
            position: "absolute", top: priority ? "26px" : "8px", left: "8px",
            fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.06em",
            background: "rgba(0,0,0,0.52)", color: "rgba(255,255,255,0.85)",
            padding: "2px 5px", lineHeight: 1.4,
          }}>
            Discogs
          </span>
        )}

        {/* Remove button */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove from wantlist"
          style={{
            position: "absolute", top: "6px", right: "6px",
            width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.55)", color: "#fff",
            border: "none", cursor: "pointer", fontSize: "15px", lineHeight: 1,
            opacity: hovered ? 1 : 0, transition: "opacity 0.15s",
          }}
        >
          ×
        </button>

        {/* Someday aging overlay */}
        {showSomedayPrompt && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "12px",
          }}>
            <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.05em", color: "#fff", textAlign: "center", margin: 0 }}>
              {monthsOld}mo old · Still want this?
            </p>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={e => { e.stopPropagation(); onKeepSomeday(); }} style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", background: "#fff", color: "#0d0d0d", border: "none", cursor: "pointer", padding: "3px 10px" }}>Keep</button>
              <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", background: "none", color: "#ccc", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", padding: "3px 10px" }}>Remove</button>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ paddingTop: "8px", flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.82rem", fontWeight: 600, color: "#0d0d0d", lineHeight: 1.25, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.76rem", color: "#555", lineHeight: 1.25, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.song_title ?? item.album}
          {item.year && <span style={{ fontFamily: MONO, fontStyle: "normal", fontSize: "0.62rem", color: "#999", letterSpacing: "0.04em" }}> · {item.year}</span>}
        </p>

        {/* Priority selector */}
        <select
          value={priority ?? ""}
          onChange={e => onUpdateMeta({ priority: (e.target.value as Priority) || null })}
          onClick={e => e.stopPropagation()}
          style={{
            fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.06em",
            color: priority ? PRIORITY_COLORS[priority] : "#bbbbbb",
            background: "none",
            border: `1px solid ${priority ? `${PRIORITY_COLORS[priority]}50` : "#e0e0da"}`,
            cursor: "pointer", padding: "2px 4px",
            outline: "none", appearance: "none", WebkitAppearance: "none",
            width: "auto", alignSelf: "flex-start", marginTop: "2px",
          }}
        >
          <option value="">Set priority</option>
          <option value="must_have">Must Have</option>
          <option value="would_love">Would Love</option>
          <option value="someday">Someday</option>
        </select>

        {/* User tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
          {userTags.map(tag => (
            <span key={tag} style={{
              fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.03em",
              color: "#666", background: "#f0ede8", padding: "2px 5px",
              display: "inline-flex", alignItems: "center", gap: "3px",
            }}>
              #{tag}
              <button
                onClick={() => onUpdateMeta({ user_tags: userTags.filter(t => t !== tag) })}
                style={{ fontFamily: MONO, fontSize: "10px", lineHeight: 1, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: "0 0 0 1px" }}
              >
                ×
              </button>
            </span>
          ))}
          {!addingTag && userTags.length < 5 && (
            <button
              onClick={() => { setAddingTag(true); setTimeout(() => tagInputRef.current?.focus(), 30); }}
              style={{
                fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.03em",
                color: "#bbb", background: "none", border: "1px dashed #ddd",
                cursor: "pointer", padding: "2px 5px",
              }}
            >
              + tag
            </button>
          )}
          {addingTag && (
            <input
              ref={tagInputRef}
              value={tagInput}
              onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20))}
              onKeyDown={e => {
                if (e.key === "Enter") handleAddTag();
                if (e.key === "Escape") { setTagInput(""); setAddingTag(false); }
              }}
              onBlur={() => { if (tagInput.trim()) handleAddTag(); else { setTagInput(""); setAddingTag(false); } }}
              placeholder="tag…"
              style={{
                fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.03em",
                color: "#333", background: "#fafafa",
                border: "1px solid #ccc", outline: "none",
                padding: "2px 4px", width: "54px",
              }}
            />
          )}
        </div>

        {/* Marketplace stats + Find It link */}
        <div style={{ marginTop: "auto", paddingTop: "6px" }}>
          {marketStats ? (
            <a
              href={discogsHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.03em", color: marketStats.numForSale > 0 ? ORANGE : "#aaa", textDecoration: "none", display: "block" }}
            >
              {marketStats.numForSale > 0
                ? `${marketStats.numForSale} ${marketStats.numForSale === 1 ? "copy" : "copies"} · From $${marketStats.lowestPrice?.toFixed(2) ?? "—"} ↗`
                : "None for sale ↗"
              }
            </a>
          ) : (
            <a
              href={discogsHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.03em", color: ORANGE, textDecoration: "none" }}
            >
              Find It ↗
            </a>
          )}
          {dateLabel && (
            <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: "#bbb", letterSpacing: "0.02em", display: "block", marginTop: "2px" }}>
              {dateLabel}
            </span>
          )}
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
            <p style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 400, color: "#0d0d0d", margin: 0 }}>Top 5 list</p>
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
              style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: newTitle.trim() ? ORANGE : "#cccccc", background: "none", border: "none", cursor: newTitle.trim() ? "pointer" : "default", padding: 0 }}>
              {isCreating ? "Creating…" : "Create →"}
            </button>
            <button type="button" onClick={() => onChangeState({ ...state, step: "templates" })}
              style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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
            style={{ flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: canvas ? ORANGE : "#f0f0f0", color: canvas ? "#fff" : "#ccc", border: "none", cursor: canvas ? "pointer" : "default", padding: "13px 0" }}>
            Download image
          </button>
          <button onClick={onCopy} disabled={!canvas}
            style={{ flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", color: copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : canvas ? "#0d0d0d" : "#ccc", border: `1px solid ${copyState === "copied" ? "#22c55e" : copyState === "failed" ? "#ef4444" : canvas ? "rgba(0,0,0,0.2)" : "#e8e8e8"}`, cursor: canvas ? "pointer" : "default", padding: "13px 0", transition: "all 0.2s" }}>
            {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Copy failed" : "Copy image"}
          </button>
        </div>

        {list.is_public && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#aaaaaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "16px" }}>
              {shareUrl}
            </p>
            <button onClick={handleCopyLink}
              style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0, color: linkCopied ? "#22c55e" : ORANGE, whiteSpace: "nowrap", flexShrink: 0 }}>
              {linkCopied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
