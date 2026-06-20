"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import type { CollectionRecord, CollectionInsights } from "@/app/collection/page";
import { persistRecordPrice } from "@/app/collection/actions";
import { createClient } from "@/lib/supabase/client";
import { getDesirabilityTier, type DesirabilityTier } from "@/lib/desirability";
import { openAppleMusicLink } from "@/lib/openAppleMusic";
import SpotifyPlayer, { getFreshSpotifyToken } from "@/components/SpotifyPlayer";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

// ─── Desirability ─────────────────────────────────────────────────────────────

const TIERS: Record<DesirabilityTier, { label: string; bg: string; color: string }> = {
  "rare":         { label: "Rare",          bg: "#F0997B", color: "#712B13" },
  "holy-grail":   { label: "Holy Grail",    bg: "#FAC775", color: "#633806" },
  "cult":         { label: "Cult Pressing", bg: "#CECBF6", color: "#3C3489" },
  "widely-loved": { label: "Widely Loved",  bg: "#C0DD97", color: "#27500A" },
  "in-demand":    { label: "In Demand",     bg: "#9FE1CB", color: "#085041" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackItem = {
  position: string;
  title: string;
  duration: string;
  type_: string;
};

type FormatItem  = { name: string; qty: string; descriptions?: string[]; text?: string };
type LabelItem   = { name: string; catno: string };

type ReleaseDetail = {
  tracklist?:    TrackItem[];
  formats?:      FormatItem[];
  labels?:       LabelItem[];
  country?:      string;
  year?:         number;
  genres?:       string[];
  styles?:       string[];
  community?:    { have: number; want: number };
  extraartists?: Array<{ name: string; role: string }>;
};

type PriceData = {
  last_sold:      number | null;
  last_sold_date: string | null;
  lowest:         number | null;
  median:         number | null;
  highest:        number | null;
  currency:       string;
  num_for_sale:   number;
};

type BandcampData = {
  embedUrl?:  string;
  albumUrl?:  string;
  searchUrl:  string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripArticle(s: string): string {
  return s.replace(/^(the|a|an)\s+/i, "");
}

function sortLetter(artist: string): string {
  const c = stripArticle(artist.trim() || "").toUpperCase().charAt(0);
  return /[A-Z]/.test(c) ? c : "#";
}

function lastNameKey(artist: string): string {
  const stripped = stripArticle(artist.trim() || "");
  const words    = stripped.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words[words.length - 1].toLowerCase() : stripped.toLowerCase();
}

function lastNameLetter(artist: string): string {
  const c = lastNameKey(artist).toUpperCase().charAt(0);
  return /[A-Z]/.test(c) ? c : "#";
}

function groupByLetter(records: CollectionRecord[], byLastName = false) {
  const groups: Array<{ letter: string; records: CollectionRecord[] }> = [];
  for (const r of records) {
    const letter = byLastName ? lastNameLetter(r.artist || "") : sortLetter(r.artist || "");
    const last   = groups[groups.length - 1];
    if (!last || last.letter !== letter) groups.push({ letter, records: [r] });
    else last.records.push(r);
  }
  const hashIdx = groups.findIndex((g) => g.letter === "#");
  if (hashIdx > 0) groups.push(...groups.splice(hashIdx, 1));
  return groups;
}

const COLOUR_KEYWORDS = new Set([
  "Black", "White", "Red", "Blue", "Green", "Yellow", "Orange", "Purple",
  "Clear", "Colored", "Coloured", "Marbled", "Splatter", "Opaque",
  "Translucent", "Transparent", "Picture Disc", "Etched",
]);

const FORMAT_SKIP = new Set([
  "Vinyl", "Album", "Compilation", "Stereo", "Mono", "Reissue", "Repress",
]);

function formatLabel(formats?: FormatItem[]): string {
  if (!formats?.length) return "";
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const f of formats) {
    const qty  = f.qty && f.qty !== "1" ? `${f.qty}×` : "";
    const descs = (f.descriptions ?? []).filter(
      (d) => !FORMAT_SKIP.has(d) && !COLOUR_KEYWORDS.has(d)
    );
    const keep = descs.length
      ? descs
      : (!FORMAT_SKIP.has(f.name) && !COLOUR_KEYWORDS.has(f.name) ? [f.name] : []);

    for (let i = 0; i < keep.length; i++) {
      const token = i === 0 && qty ? `${qty}${keep[i]}` : keep[i];
      if (!seen.has(token)) { seen.add(token); tokens.push(token); }
    }
    // `text` holds the colour/variant — omit it here since it shows in the Vinyl row
  }

  return tokens.join(", ");
}

function extractVinylColour(formats?: FormatItem[]): string | null {
  if (!formats?.length) return null;
  const vinyl = formats.find((f) => f.name === "Vinyl");
  if (!vinyl) return null;
  // Discogs puts the colour/variant description in `text` (shown in italics on their site)
  if (vinyl.text?.trim()) return vinyl.text.trim();
  // Fallback: scan descriptions for a colour keyword
  const match = (vinyl.descriptions ?? []).find((d) =>
    [...COLOUR_KEYWORDS].some((kw) => d.toLowerCase().includes(kw.toLowerCase()))
  );
  return match ?? null;
}

function sym(code: string): string {
  const map: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "CA$", AUD: "A$",
  };
  return map[code] ?? `${code} `;
}

function formatPrice(value: number | null | undefined, currency: string): string | null {
  if (value == null || value <= 0) return null;
  return `${sym(currency)}${value.toFixed(2)}`;
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch { return null; }
}

// ─── Decade filter helpers ────────────────────────────────────────────────────

const DECADE_ORDER = ["Pre-1960", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;

function decadeLabel(year: number | null): string | null {
  if (!year) return null;
  if (year < 1960) return "Pre-1960";
  const d = Math.floor(year / 10) * 10;
  return d <= 2029 ? `${d}s` : null;
}

function matchesDecade(year: number | null, decade: string): boolean {
  if (!year) return false;
  if (decade === "Pre-1960") return year < 1960;
  const start = parseInt(decade);
  return year >= start && year < start + 10;
}

// ─── Desirability filter options ─────────────────────────────────────────────

const DESIRABILITY_FILTER_OPTIONS: { value: DesirabilityTier; label: string }[] = [
  { value: "holy-grail",   label: "Holy Grail"    },
  { value: "rare",         label: "Rare"          },
  { value: "cult",         label: "Cult Pressing" },
  { value: "widely-loved", label: "Widely Loved"  },
  { value: "in-demand",    label: "In Demand"     },
];

// ─── Props ────────────────────────────────────────────────────────────────────

// ─── Sync helpers ────────────────────────────────────────────────────────────

type SyncState = "idle" | "syncing" | "complete" | "error";

interface SyncProgress {
  message: string;
  done: number;
  total: number;
}

interface SyncResult {
  total: number;
  newAdded: number;
  updated: number;
  priceUpdated: number;
  timestamp: string;
}

function formatSyncDisplayTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    const date = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date}, ${time}`;
  } catch { return "—"; }
}

function formatSyncTime(isoString: string): string {
  try {
    const d      = new Date(isoString);
    if (isNaN(d.getTime())) return "just now";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000)         return "just now";
    if (diffMs < 3_600_000)      return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000)     return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return "just now"; }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DiscogsValue {
  low:      number | null;
  med:      number | null;
  high:     number | null;
  currency: string;
}

interface LastSyncJob {
  total_records: number | null;
  new_added:     number | null;
  completed_at:  string | null;
}

interface Props {
  initialCollection: CollectionRecord[];
  username: string;
  displayLabel?: string;
  avatarUrl?: string | null;
  estimatedValue?: number;
  valueCurrency?: string;
  pricedCount?: number;
  discogsValue?: DiscogsValue;
  insights?: CollectionInsights;
  lastSyncedAt?: string | null;
  lastSyncJob?: LastSyncJob | null;
  startSync?: boolean;
  oauthDenied?: boolean;
  oauthError?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CollectionClient({
  initialCollection,
  username,
  displayLabel,
  avatarUrl      = null,
  estimatedValue = 0,
  valueCurrency  = "USD",
  pricedCount    = 0,
  discogsValue,
  insights,
  lastSyncedAt   = null,
  lastSyncJob    = null,
  startSync      = false,
  oauthDenied    = false,
  oauthError     = false,
}: Props) {
  const router = useRouter();

  const [selectedRecord, setSelectedRecord] = useState<CollectionRecord | null>(null);
  const [releaseDetail,  setReleaseDetail]  = useState<ReleaseDetail | null>(null);
  const [priceData,      setPriceData]      = useState<PriceData | null>(null);
  const [bandcampData,   setBandcampData]   = useState<BandcampData | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);

  const [searchQuery,        setSearchQuery]        = useState("");
  const [filterGenre,        setFilterGenre]        = useState("");
  const [filterYear,         setFilterYear]         = useState("");

const [filterFormat,       setFilterFormat]       = useState("");
  const [filterDesirability, setFilterDesirability] = useState("");
  const [sortBy,             setSortBy]             = useState("artist-az");

  const [filterSheetOpen,  setFilterSheetOpen]  = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [collection, setCollection] = useState<CollectionRecord[]>(initialCollection);

  // Re-sync collection state when the server re-renders with fresh data (e.g. after price sync)
  useEffect(() => {
    if (initialCollection.length > 0) setCollection(initialCollection);
  }, [initialCollection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side fallback: fetch user_records joined to records when the server
  // prop is empty (e.g. due to a silent query error on the server).
  useEffect(() => {
    console.log('[collection] initialCollection.length on mount:', initialCollection.length);
    if (initialCollection.length > 0) return;

    async function loadCollection() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Auth user ID:', user?.id);
      console.log('[collection] auth error:', authError);
      if (!user) {
        console.log('[collection] no user — browser session not authenticated');
        return;
      }

      type LinkRow = {
        record_id:        string;
        value:            number | null;
        price_low:        number | null;
        price_median:     number | null;
        price_currency:   string | null;
        media_condition:  string | null;
        sleeve_condition: string | null;
        open_to_offers:   boolean | null;
        is_essential:     boolean | null;
        feeling:          string | null;
      };
      const allLinks: LinkRow[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("user_records")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("record_id, value, price_low, price_median, price_currency, media_condition, sleeve_condition, open_to_offers, is_essential, feeling" as any)
          .eq("user_id", user.id)
          .range(from, from + PAGE - 1);
        console.log(`[collection] user_records page from=${from}: count=${data?.length ?? 0} error=${JSON.stringify(error)}`);
        if (!data || data.length === 0) break;
        allLinks.push(...(data as unknown as LinkRow[]));
        if (data.length < PAGE) break;
      }

      const recordIds        = allLinks.map((l) => l.record_id);
      const valueMap           = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.value ?? null]));
      const priceLowMap        = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.price_low ?? null]));
      const priceMedianMap     = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.price_median ?? null]));
      const priceCurrencyMap   = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.price_currency ?? null]));
      const mediaConditionMap  = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.media_condition  ?? null]));
      const sleeveConditionMap = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.sleeve_condition ?? null]));
      const openToOffersMap    = new Map<string, boolean | null>(allLinks.map((l) => [l.record_id, l.open_to_offers ?? null]));
      const isEssentialMap     = new Map<string, boolean | null>(allLinks.map((l) => [l.record_id, l.is_essential ?? null]));
      const feelingMap         = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.feeling ?? null]));
      const BATCH        = 400;
      const recordsMap   = new Map<string, Omit<CollectionRecord, "value" | "price_low" | "price_low_usd" | "price_median" | "price_currency" | "media_condition" | "sleeve_condition" | "open_to_offers" | "is_essential" | "feeling">>();
      for (let i = 0; i < recordIds.length; i += BATCH) {
        const { data, error } = await supabase
          .from("records")
          .select("id, discogs_id, artist, album, year, genre, cover_url, label, format, country, community_have, community_want, community_num_for_sale")
          .in("id", recordIds.slice(i, i + BATCH));
        console.log(`[collection] records batch i=${i}: count=${data?.length ?? 0} error=${JSON.stringify(error)}`);
        for (const r of data ?? []) recordsMap.set(r.id, r as Omit<CollectionRecord, "value" | "price_low" | "price_low_usd" | "price_median" | "price_currency" | "media_condition" | "sleeve_condition">);
      }

      const fetched: CollectionRecord[] = recordIds
        .map((id) => {
          const r = recordsMap.get(id);
          if (!r) return undefined;
          return {
            ...r,
            value:            valueMap.get(id)           ?? null,
            price_low:        priceLowMap.get(id)        ?? null,
            price_low_usd:    priceLowMap.get(id)        ?? null, // client fetch is raw USD
            price_median:     priceMedianMap.get(id)     ?? null,
            price_currency:   priceCurrencyMap.get(id)   ?? null,
            media_condition:  mediaConditionMap.get(id)  ?? null,
            sleeve_condition: sleeveConditionMap.get(id) ?? null,
            open_to_offers:   openToOffersMap.get(id)    ?? null,
            is_essential:     isEssentialMap.get(id)     ?? null,
            feeling:          feelingMap.get(id)         ?? null,
          };
        })
        .filter((r): r is CollectionRecord => r !== undefined);

      console.log('[collection] client fetch returned:', fetched.length, 'records');
      if (fetched.length > 0) setCollection(fetched);
    }

    loadCollection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncTriggered = useRef(false);
  const syncAbort     = useRef<AbortController | null>(null);

  // Pre-populate from a recently completed job so returning users see the result
  // rather than a blank idle state. Capped to 2 hours — older jobs are already
  // reflected in the "Last sync: date" line via lastSyncedAt.
  const [syncState, setSyncState] = useState<SyncState>(() => {
    if (!lastSyncJob?.completed_at) return "idle";
    const age = Date.now() - new Date(lastSyncJob.completed_at).getTime();
    return age < 2 * 60 * 60 * 1000 ? "complete" : "idle";
  });
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResult,   setSyncResult]   = useState<SyncResult | null>(() => {
    if (!lastSyncJob?.completed_at) return null;
    const age = Date.now() - new Date(lastSyncJob.completed_at).getTime();
    if (age >= 2 * 60 * 60 * 1000) return null;
    return {
      total:        lastSyncJob.total_records ?? 0,
      newAdded:     lastSyncJob.new_added     ?? 0,
      updated:      0,
      priceUpdated: 0,
      timestamp:    lastSyncJob.completed_at,
    };
  });

  const [priceProgress, setPriceProgress] = useState<{ done: number; total: number; phase: "low" } | null>(null);

  const [csvUploading, setCsvUploading] = useState(false);

  type EnrichStatus = { total: number; enriched: number; pending: number; failed: number; percentComplete: number };
  const [enrichStatus, setEnrichStatus] = useState<EnrichStatus | null>(null);
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startSync || syncTriggered.current) return;
    syncTriggered.current = true;
    router.replace("/collection", { scroll: false });
    runSync();
  }, [startSync]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss the "Sync complete" banner — it's a transient confirmation,
  // not a persistent status. The "Last sync" line under the button (driven by
  // syncResult/lastSyncedAt, untouched here) already covers the lasting record.
  useEffect(() => {
    if (syncState !== "complete") return;
    const t = setTimeout(() => setSyncState("idle"), 8000);
    return () => clearTimeout(t);
  }, [syncState]);

  // Poll enrichment status when collection has records
  useEffect(() => {
    if (collection.length === 0) return;

    const checkEnrichStatus = async () => {
      try {
        const res = await fetch("/api/collection/enrich-status");
        if (!res.ok) return;
        const data: EnrichStatus = await res.json();
        setEnrichStatus(data);
        if (data.pending === 0 && enrichPollRef.current) {
          clearInterval(enrichPollRef.current);
          enrichPollRef.current = null;
        }
      } catch { /* ignore */ }
    };

    checkEnrichStatus();
    enrichPollRef.current = setInterval(checkEnrichStatus, 8000);

    return () => {
      if (enrichPollRef.current) {
        clearInterval(enrichPollRef.current);
        enrichPollRef.current = null;
      }
    };
  }, [collection.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select a random record on load — fires once when collection is first non-empty
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || collection.length === 0) return;
    autoSelected.current = true;
    const idx = Math.floor(Math.random() * collection.length);
    selectRecord(collection[idx]);
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCsvUpload(file: File) {
    setCsvUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/collection/csv-import", { method: "POST", body: formData });
      if (res.ok) {
        void fetch("/api/collection/quiz-archive", { method: "POST" });
        router.refresh();
      }
    } finally {
      setCsvUploading(false);
    }
  }

  async function runSync() {
    setSyncState("syncing");
    setSyncProgress({ message: "Connecting to Discogs...", done: 0, total: 0 });

    const ctrl = new AbortController();
    syncAbort.current = ctrl;

    try {
      const res = await fetch("/api/discogs/sync", { signal: ctrl.signal });

      if (!res.ok || !res.body) {
        setSyncState("error");
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as {
              type: string;
              message?: string;
              page?: number;
              totalPages?: number;
              fetched?: number;
              done?: number;
              total?: number;
              phase?: string;
              newAdded?: number;
              updated?: number;
              priceUpdated?: number;
              timestamp?: string;
            };

            if (ev.type === "status") {
              setSyncProgress({ message: ev.message ?? "Syncing...", done: 0, total: 0 });

            } else if (ev.type === "fetch_page") {
              setSyncProgress({
                message: `Fetching collection... (page ${ev.page} of ${ev.totalPages})`,
                done: ev.page ?? 0,
                total: ev.totalPages ?? 0,
              });

            } else if (ev.type === "processing") {
              setSyncProgress({
                message: ev.message ?? `Syncing... ${ev.done} of ${ev.total} records`,
                done: ev.done ?? 0,
                total: ev.total ?? 0,
              });

            } else if (ev.type === "pricing") {
              setSyncProgress({
                message: `Fetching prices… ${ev.done} of ${ev.total}`,
                done: ev.done ?? 0,
                total: ev.total ?? 0,
              });

            } else if (ev.type === "complete") {
              setSyncResult({
                total:        ev.total        ?? 0,
                newAdded:     ev.newAdded     ?? 0,
                updated:      ev.updated      ?? 0,
                priceUpdated: ev.priceUpdated ?? 0,
                timestamp:    ev.timestamp    ?? new Date().toISOString(),
              });
              setSyncState("complete");
              void fetch("/api/collection/quiz-archive", { method: "POST" });
              router.refresh();
              runPriceLoop(ev.total ?? 0);

            } else if (ev.type === "error") {
              setSyncState("error");
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSyncState("error");
    }
  }

  async function runPriceLoop(collectionTotal: number) {
    type BatchData = { priced: number; processed: number; remaining: number; total: number };

    async function runLoop(endpoint: string, phase: "low") {
      let done = 0;
      let total = collectionTotal;
      let totalLocked = false;
      setPriceProgress({ done, total, phase });
      try {
        while (true) {
          const res = await fetch(endpoint, { cache: "no-store" });
          if (!res.ok) break;
          const data: BatchData = await res.json();
          if (!totalLocked && data.total > 0) {
            total = data.total;   // lock to actual count on first call
            totalLocked = true;
          }
          done += data.processed ?? data.priced;
          setPriceProgress({ done, total, phase });
          if (data.remaining <= 0) break;
        }
      } catch { /* best-effort */ }
    }

    await runLoop("/api/discogs/price-batch", "low");

    setPriceProgress(null);
    router.refresh();
  }

  async function selectRecord(record: CollectionRecord) {
    setSelectedRecord(record);
    setReleaseDetail(null);
    setPriceData(null);
    setBandcampData(null);
    setDetailLoading(true);

    // Bandcamp search uses artist + album (no discogs_id required)
    const bcFetch = fetch(
      `/api/bandcamp/search?artist=${encodeURIComponent(record.artist)}&album=${encodeURIComponent(record.album)}`
    );

    console.log("selectRecord discogs_id:", record.discogs_id, "| record id:", record.id);
    try {
      if (record.discogs_id) {
        console.log("FETCHING PRICE FOR:", record.discogs_id);
        const [relRes, priceRes, bcRes] = await Promise.all([
          fetch(`/api/discogs/release/${record.discogs_id}`),
          fetch(`/api/discogs/price/${record.discogs_id}?currency=${encodeURIComponent(valueCurrency)}`, { cache: "no-store" }),
          bcFetch,
        ]);
        if (relRes.ok)   setReleaseDetail(await relRes.json());
        if (bcRes.ok)    setBandcampData(await bcRes.json());
        if (priceRes.ok) {
          const pData: PriceData = await priceRes.json();
          setPriceData(pData);
          // Persist to user_records for the collection dashboard — fire and forget
          persistRecordPrice(record.id, pData).catch(() => {});
        }
      } else {
        const bcRes = await bcFetch;
        if (bcRes.ok) setBandcampData(await bcRes.json());
      }
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  }

  const filteredCollection = useMemo(() => {
    let result = collection;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        r.artist.toLowerCase().includes(q) ||
        r.album.toLowerCase().includes(q) ||
        (r.label ?? "").toLowerCase().includes(q)
      );
    }
    if (filterGenre)        result = result.filter(r => r.genre === filterGenre);
    if (filterYear)         result = result.filter(r => matchesDecade(r.year, filterYear));
    if (filterFormat)       result = result.filter(r => r.format === filterFormat);
    if (filterDesirability) result = result.filter(r =>
      getDesirabilityTier(r.community_have, r.community_want, r.price_low_usd, r.community_num_for_sale) === filterDesirability
    );
    return result;
  }, [collection, searchQuery, filterGenre, filterYear, filterFormat, filterDesirability]);

  const sortedCollection = useMemo(() => {
    const arr = [...filteredCollection];
    switch (sortBy) {
      case "artist-az":
        return arr.sort((a, b) =>
          stripArticle(a.artist || "").toLowerCase()
            .localeCompare(stripArticle(b.artist || "").toLowerCase(), "en")
        );
      case "artist-za":
        return arr.sort((a, b) =>
          stripArticle(b.artist || "").toLowerCase()
            .localeCompare(stripArticle(a.artist || "").toLowerCase(), "en")
        );
      case "artist-lastname-az":
        return arr.sort((a, b) =>
          lastNameKey(a.artist || "").localeCompare(lastNameKey(b.artist || ""), "en")
        );
      case "artist-lastname-za":
        return arr.sort((a, b) =>
          lastNameKey(b.artist || "").localeCompare(lastNameKey(a.artist || ""), "en")
        );
      case "value-high-low":
        return arr.sort((a, b) => ((b.price_low ?? b.price_median) ?? -1) - ((a.price_low ?? a.price_median) ?? -1));
      case "value-low-high":
        return arr.sort((a, b) => {
          const av = (a.price_low ?? a.price_median) ?? Infinity;
          const bv = (b.price_low ?? b.price_median) ?? Infinity;
          return av - bv;
        });
      case "year-new-old":
        return arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case "year-old-new":
        return arr.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
      default:
        return arr;
    }
  }, [filteredCollection, sortBy]);

  const useGrouped   = sortBy === "artist-az" || sortBy === "artist-za" || sortBy === "artist-lastname-az" || sortBy === "artist-lastname-za";
  const byLastName   = sortBy === "artist-lastname-az" || sortBy === "artist-lastname-za";
  const filteredGroups = useMemo(() => {
    if (!useGrouped) return [];
    return groupByLetter(sortedCollection, byLastName);
  }, [sortedCollection, useGrouped, byLastName]);

  const genres = useMemo(() => {
    const gs = new Set<string>();
    for (const r of collection) if (r.genre) gs.add(r.genre);
    return [...gs].sort();
  }, [collection]);

  const decades = useMemo(() => {
    const ds = new Set<string>();
    for (const r of collection) {
      const lbl = decadeLabel(r.year);
      if (lbl) ds.add(lbl);
    }
    return DECADE_ORDER.filter(d => ds.has(d));
  }, [collection]);

  const formats = useMemo(() => {
    const fs = new Set<string>();
    for (const r of collection) if (r.format) fs.add(r.format);
    return [...fs].sort();
  }, [collection]);

  // Always show all five tiers — community data populates after the next sync,
  // and 0-result selections are explained by the "N of M items" counter.
  const desirabilityOptions = DESIRABILITY_FILTER_OPTIONS;

  const hasFilters = !!searchQuery.trim() || !!filterGenre || !!filterYear || !!filterFormat || !!filterDesirability;
  const activeFilterCount = [filterGenre, filterYear, filterFormat, filterDesirability].filter(Boolean).length;

  function clearAllFilters() {
    setSearchQuery("");
    setFilterGenre("");
    setFilterYear("");
    setFilterFormat("");
    setFilterDesirability("");
  }

  const NAME_SORT_OPTIONS = [
    { value: "artist-az",         label: "First A–Z" },
    { value: "artist-za",         label: "First Z–A" },
    { value: "artist-lastname-az", label: "Last A–Z" },
    { value: "artist-lastname-za", label: "Last Z–A" },
  ];

  const SORT_OPTIONS = [
    { value: "artist-az",          label: "Artist A–Z" },
    { value: "artist-za",          label: "Artist Z–A" },
    { value: "artist-lastname-az", label: "Last Name A–Z" },
    { value: "artist-lastname-za", label: "Last Name Z–A" },
    { value: "value-high-low",     label: "Market Value: High to Low" },
    { value: "value-low-high",     label: "Market Value: Low to High" },
    { value: "year-new-old",       label: "Year: Newest First" },
    { value: "year-old-new",       label: "Year: Oldest First" },
  ];

  return (
    <div className="rk-app-shell" style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#ffffff", overflow: "hidden" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Status banners ── */}
      {oauthDenied && (
        <StatusBanner color="#aaaaaa" bg="#f4f4f4">Discogs authorization cancelled</StatusBanner>
      )}
      {oauthError && (
        <StatusBanner color="#cc2200" bg="#fff5f5">Discogs connection error — please try again</StatusBanner>
      )}
      {syncState === "syncing" && syncProgress && (
        <StatusBanner color="#0d0d0d" bg="#f4f4f4">
          {syncProgress.message}
          {collection.length > 500 && (
            <span style={{ marginLeft: "10px", color: "#888888" }}>
              · Large collection — this may take a while
            </span>
          )}
        </StatusBanner>
      )}
      {priceProgress && (
        <StatusBanner color="#0d0d0d" bg="#f4f4f4">
          Pricing records… {priceProgress.done} of {priceProgress.total}
          {collection.length > 500 && (
            <span style={{ marginLeft: "10px", color: "#888888" }}>
              · Large collection — this may take a while
            </span>
          )}
        </StatusBanner>
      )}
      {syncState === "complete" && syncResult && !priceProgress && (
        <StatusBanner color="#0d0d0d" bg="#f4f4f4">
          <span style={{ color: "#22800a", marginRight: "6px" }}>✓</span>
          <strong>Sync complete</strong>
          {` · ${syncResult.total} records`}
          {syncResult.newAdded > 0 && ` · ${syncResult.newAdded} new`}
          {` · last synced ${formatSyncTime(syncResult.timestamp)}`}
        </StatusBanner>
      )}
      {syncState === "error" && (
        <StatusBanner color="#cc2200" bg="#fff5f5">Sync failed — please try again</StatusBanner>
      )}


      {/* ── Empty state (0 records) ── */}
      {collection.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
          <input
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            id="csv-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvUpload(file);
              e.target.value = "";
            }}
          />
          <h1 style={{ fontFamily: SERIF, fontSize: "28px", fontWeight: 400, color: "#0d0d0d", marginBottom: "10px", letterSpacing: "-0.02em", textAlign: "center" }}>
            Your collection starts here.
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: "#aaaaaa", marginBottom: "40px", textAlign: "center" }}>
            Two ways to import your Discogs collection.
          </p>

          {/* Two-option layout */}
          <div style={{ display: "flex", width: "100%", maxWidth: "660px" }}>

            {/* LEFT — Connect Discogs via OAuth */}
            <div style={{ flex: 1, padding: "28px 32px" }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, margin: "0 0 12px" }}>
                Connect Discogs
              </p>
              <p style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 400, color: "#0d0d0d", margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                Sync via OAuth
              </p>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#aaaaaa", lineHeight: 1.7, margin: "0 0 28px" }}>
                The fastest path. Connects your Discogs account directly and syncs your full collection in the background.
              </p>
              <button
                type="button"
                onClick={() => { window.location.href = "/api/discogs/oauth/init"; }}
                style={{
                  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
                  textTransform: "uppercase", background: ORANGE, color: "#ffffff",
                  border: "none", padding: "11px 20px", cursor: "pointer",
                }}
              >
                Connect Discogs →
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: "1px", background: "#e0e0da", alignSelf: "stretch", flexShrink: 0 }} />

            {/* RIGHT — CSV upload */}
            <div style={{ flex: 1, padding: "28px 32px" }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, margin: "0 0 12px" }}>
                Import CSV
              </p>
              <p style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 400, color: "#0d0d0d", margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                Upload your export file
              </p>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#aaaaaa", lineHeight: 1.7, margin: "0 0 8px" }}>
                Download your collection CSV from Discogs (My Account → Collection → Export), then upload it here. Records appear immediately while we enrich in the background.
              </p>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: ORANGE, lineHeight: 1.7, margin: "0 0 28px" }}>
                Recommended for collectors with &gt;2,000 records.
              </p>
              <div
                onClick={() => { if (!csvUploading) document.getElementById("csv-file-input")?.click(); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && !csvUploading) handleCsvUpload(file);
                }}
                style={{
                  border: "1px solid #e0e0da",
                  padding: "18px 16px",
                  textAlign: "center",
                  cursor: csvUploading ? "default" : "pointer",
                  opacity: csvUploading ? 0.6 : 1,
                }}
              >
                <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#aaaaaa", margin: 0 }}>
                  {csvUploading ? "Uploading…" : "Drop CSV here or click to browse"}
                </p>
              </div>
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#cccccc", margin: "8px 0 0" }}>
                .csv files only · your data is stored securely
              </p>
            </div>
          </div>

          {/* Quiz path */}
          <div style={{ marginTop: "36px", paddingTop: "28px", borderTop: "1px solid #e0e0da", textAlign: "center" }}>
            <p style={{ fontFamily: SERIF, fontSize: "17px", fontWeight: 400, color: "#0d0d0d", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
              Don&apos;t have Discogs yet?
            </p>
            <a href="/quiz" style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: ORANGE, textDecoration: "none" }}>
              Answer a few important questions to get started →
            </a>
          </div>
        </div>
      )}

      {/* ── Enrichment progress banner ── */}
      {/* Only show when enrichment has actually started (percentComplete > 0 prevents stuck "0 of N" from migration backfill) */}
      {collection.length > 0 && enrichStatus && enrichStatus.pending > 0 && enrichStatus.percentComplete > 0 && (
        <div style={{ flexShrink: 0, background: "#FDF6F0", borderTop: "1px solid #e0e0da", borderBottom: "1px solid #e0e0da", padding: "8px 20px 10px" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.05em", color: "#888888", margin: "0 0 6px" }}>
            Enriching your collection — {enrichStatus.enriched} of {enrichStatus.total} records processed. Insights will be available shortly.
          </p>
          <div style={{ height: "2px", background: "#e0e0da", width: "100%" }}>
            <div style={{ height: "100%", background: ORANGE, width: `${enrichStatus.percentComplete}%`, transition: "width 0.5s ease" }} />
          </div>
        </div>
      )}

      {/* ── Three-column panel ── */}
      {collection.length > 0 && (
      <div className="flex flex-col md:grid" style={{ flex: 1, overflow: "hidden", gridTemplateColumns: "380px 1fr 380px" }}>

        {/* Col 1 — search + filters + A-Z record list */}
        <div className={`${mobileDetailOpen ? "hidden" : "flex"} flex-col md:flex`} style={{ flex: 1, borderRight: "1px solid rgba(0,0,0,0.08)", minWidth: 0, overflow: "hidden" }}>

          {/* ── Fixed: search + filters ── */}
          <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>

            {/* Sync row — sync left, randomiser right */}
            <div style={{ padding: "8px 10px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => {
                  if (syncState === "syncing") return;
                  window.location.href = "/api/discogs/oauth/init";
                }}
                disabled={syncState === "syncing"}
                style={{
                  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                  color: syncState === "syncing" ? "#aaaaaa" : ORANGE,
                  background: "none", border: "none",
                  cursor: syncState === "syncing" ? "default" : "pointer",
                  padding: 0,
                }}
              >
                {syncState === "syncing" ? "Syncing…" : "Sync with Discogs →"}
              </button>
              {collection.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = Math.floor(Math.random() * collection.length);
                    selectRecord(collection[idx]);
                    setMobileDetailOpen(true);
                  }}
                  style={{
                    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                    color: ORANGE, background: "none", border: "none",
                    cursor: "pointer", padding: 0,
                  }}
                >
                  ↺ Randomiser
                </button>
              )}
            </div>
            {/* Last sync — flush under the sync button, no gap */}
            {(syncResult?.timestamp || lastSyncedAt) && (
              <div style={{ padding: "0 10px 5px" }}>
                <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#bbbbbb" }}>
                  Last sync: {formatSyncDisplayTime(syncResult?.timestamp ?? lastSyncedAt)}
                </span>
              </div>
            )}

            {/* Mobile — inline search + filter selects */}
            <div className="md:hidden" style={{ padding: "8px 12px 10px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your collection..."
                style={{
                  width: "100%",
                  fontFamily: MONO,
                  fontSize: "13px",
                  border: "0.5px solid #e8e8e8",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  marginBottom: "8px",
                  background: "#fafafa",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <select
                  value={filterGenre}
                  onChange={e => setFilterGenre(e.target.value)}
                  style={{ fontFamily: MONO, fontSize: "12px", padding: "8px", border: "0.5px solid #e8e8e8", borderRadius: "4px", background: "#fafafa", outline: "none", color: filterGenre ? ORANGE : "#888888" }}
                >
                  <option value="">Genre</option>
                  {genres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select
                  value={filterYear}
                  onChange={e => setFilterYear(e.target.value)}
                  style={{ fontFamily: MONO, fontSize: "12px", padding: "8px", border: "0.5px solid #e8e8e8", borderRadius: "4px", background: "#fafafa", outline: "none", color: filterYear ? ORANGE : "#888888" }}
                >
                  <option value="">Year</option>
                  {decades.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  value={filterFormat}
                  onChange={e => setFilterFormat(e.target.value)}
                  style={{ fontFamily: MONO, fontSize: "12px", padding: "8px", border: "0.5px solid #e8e8e8", borderRadius: "4px", background: "#fafafa", outline: "none", color: filterFormat ? ORANGE : "#888888" }}
                >
                  <option value="">Format</option>
                  {formats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={filterDesirability}
                  onChange={e => setFilterDesirability(e.target.value)}
                  style={{ fontFamily: MONO, fontSize: "12px", padding: "8px", border: "0.5px solid #e8e8e8", borderRadius: "4px", background: "#fafafa", outline: "none", color: filterDesirability ? ORANGE : "#888888" }}
                >
                  <option value="">Desirability</option>
                  {desirabilityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Desktop — search input */}
            <div className="hidden md:block" style={{ padding: "2px 10px 6px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your collection..."
                style={{
                  width: "100%",
                  fontFamily: MONO,
                  fontSize: "11px",
                  letterSpacing: "0.02em",
                  color: "#0d0d0d",
                  background: "#f8f8f8",
                  border: "none",
                  borderBottom: `1px solid ${searchQuery ? ORANGE : "rgba(0,0,0,0.1)"}`,
                  outline: "none",
                  padding: "6px 8px",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
              />
            </div>

            {/* Desktop — filter dropdowns + sort */}
            <div className="hidden md:block">

            {/* Filter dropdowns — row 1: Genre + Year */}
            <div style={{ padding: "0 10px 4px", display: "flex", gap: "6px" }}>
              <select
                value={filterGenre}
                onChange={e => setFilterGenre(e.target.value)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: filterGenre ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${filterGenre ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <option value="">Genre</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: filterYear ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${filterYear ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <option value="">Year</option>
                {decades.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Filter dropdowns — row 2: Format + Country */}
            <div style={{ padding: "0 10px 6px", display: "flex", gap: "6px" }}>
              <select
                value={filterFormat}
                onChange={e => setFilterFormat(e.target.value)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: filterFormat ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${filterFormat ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <option value="">Format</option>
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select
                value={filterDesirability}
                onChange={e => setFilterDesirability(e.target.value)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: filterDesirability ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${filterDesirability ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <option value="">Desirability</option>
                {desirabilityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Sort bar — name sorts as inline buttons, value/year as dropdown */}
            <div style={{ padding: "0 10px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", flexShrink: 0 }}>
                  Sort
                </span>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {NAME_SORT_OPTIONS.map(o => {
                    const on = sortBy === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setSortBy(o.value)}
                        style={{
                          fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: on ? "#ffffff" : "#888888",
                          background: on ? "#0d0d0d" : "none",
                          border: `1px solid ${on ? "#0d0d0d" : "rgba(0,0,0,0.13)"}`,
                          borderRadius: "3px", cursor: "pointer", padding: "3px 8px",
                          whiteSpace: "nowrap", transition: "all 0.15s",
                        }}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <select
                value={["value-high-low", "value-low-high", "year-new-old", "year-old-new"].includes(sortBy) ? sortBy : ""}
                onChange={e => { if (e.target.value) setSortBy(e.target.value); }}
                style={{
                  width: "100%", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: ["value-high-low", "value-low-high", "year-new-old", "year-old-new"].includes(sortBy) ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${["value-high-low", "value-low-high", "year-new-old", "year-old-new"].includes(sortBy) ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <option value="">Value / Year sort…</option>
                <option value="value-high-low">Market Value: High to Low</option>
                <option value="value-low-high">Market Value: Low to High</option>
                <option value="year-new-old">Year: Newest First</option>
                <option value="year-old-new">Year: Oldest First</option>
              </select>
            </div>

            {/* Active filter tags */}
            {(filterGenre || filterYear || filterFormat || filterDesirability) && (
              <div style={{ padding: "0 10px 6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {filterGenre        && <FilterTag label={`Genre: ${filterGenre}`}       onRemove={() => setFilterGenre("")} />}
                {filterYear         && <FilterTag label={`Year: ${filterYear}`}         onRemove={() => setFilterYear("")} />}
                {filterFormat       && <FilterTag label={`Format: ${filterFormat}`}     onRemove={() => setFilterFormat("")} />}
                {filterDesirability && <FilterTag label={`Desirability: ${DESIRABILITY_FILTER_OPTIONS.find(o => o.value === filterDesirability)?.label ?? filterDesirability}`} onRemove={() => setFilterDesirability("")} />}
              </div>
            )}

            {/* Filtered count + Clear all — only shown when a filter is active */}
            {hasFilters && (
              <div style={{ padding: "0 10px 7px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: "#aaaaaa" }}>
                  {filteredCollection.length} of {collection.length} items
                </span>
                <button
                  onClick={clearAllFilters}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Clear all
                </button>
              </div>
            )}
            </div>{/* /desktop-filters */}
          </div>

          {/* ── Scrollable: A-Z record list ── */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {collection.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontFamily: SERIF, fontSize: "16px", color: "#0d0d0d", marginBottom: "6px" }}>Empty collection</p>
                <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", letterSpacing: "0.06em" }}>Import from Discogs to get started.</p>
              </div>
            ) : sortedCollection.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", letterSpacing: "0.06em" }}>No records found</p>
              </div>
            ) : useGrouped ? filteredGroups.map((group) => (
              <div key={group.letter}>
                <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#ffffff", padding: "5px 14px 3px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE }}>
                  {group.letter}
                </div>
                {group.records.map((record) => (
                  <RecordRow
                    key={record.id}
                    record={record}
                    selected={selectedRecord?.id === record.id}
                    onClick={() => { selectRecord(record); setMobileDetailOpen(true); }}
                  />
                ))}
              </div>
            )) : sortedCollection.map((record) => (
              <RecordRow
                key={record.id}
                record={record}
                selected={selectedRecord?.id === record.id}
                onClick={() => { selectRecord(record); setMobileDetailOpen(true); }}
              />
            ))}
          </div>
        </div>

        {selectedRecord ? (
          <>
            {/* Col 2 — Album details */}
            <div className={`${mobileDetailOpen ? "flex" : "hidden"} flex-col md:flex`} style={{ flex: 1, borderRight: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", minWidth: 0 }}>
              <button
                className="md:hidden"
                onClick={() => setMobileDetailOpen(false)}
                style={{
                  alignItems: "center", gap: "6px",
                  padding: "14px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: "0.5px solid #e8e8e8",
                  cursor: "pointer",
                  fontFamily: MONO, fontSize: "12px", letterSpacing: "0.08em",
                  textTransform: "uppercase", color: ORANGE,
                  width: "100%",
                  textAlign: "left",
                }}
              >
                ← Collection
              </button>
              <AlbumDetail
                record={selectedRecord}
                detail={releaseDetail}
                price={priceData}
                loading={detailLoading}
                valueCurrency={valueCurrency}
              />
            </div>

            {/* Col 3 — Tracklist + Bandcamp */}
            <div className="hidden md:block" style={{ overflowY: "auto", minWidth: 0 }}>
              <TracklistPanel
                tracks={releaseDetail?.tracklist ?? null}
                loading={detailLoading}
                bandcamp={bandcampData}
                record={selectedRecord}
              />
            </div>
          </>
        ) : (
          <div className="hidden md:flex" style={{ gridColumn: "2 / 4", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <p style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8" }}>Select a record</p>
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#e4e4e4", letterSpacing: "0.08em" }}>
              {collection.length} {collection.length === 1 ? "record" : "records"} in your collection
            </p>
          </div>
        )}
      </div>
      )}

      {/* filter bottom sheet removed — inline filters on mobile */}
      {false && (
        <>
          <div
            className="md:hidden"
            onClick={() => setFilterSheetOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }}
          />
          <div
            className="md:hidden"
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              background: "#ffffff", borderRadius: "12px 12px 0 0",
              zIndex: 50, padding: "20px 20px 40px",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <span style={{ fontFamily: SERIF, fontSize: "17px", color: "#0d0d0d" }}>Filter & Sort</span>
              <button
                onClick={() => setFilterSheetOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: MONO, fontSize: "20px", color: "#aaaaaa", padding: "4px 8px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <label style={{ display: "block", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "4px" }}>Sort</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                width: "100%", fontFamily: MONO, fontSize: "13px", letterSpacing: "0.02em",
                color: sortBy !== "artist-az" ? ORANGE : "#0d0d0d",
                background: "#ffffff", border: `1px solid ${sortBy !== "artist-az" ? ORANGE : "rgba(0,0,0,0.13)"}`,
                cursor: "pointer", padding: "10px 8px", outline: "none", marginBottom: "16px",
              }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <label style={{ display: "block", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "4px" }}>Genre</label>
            <select
              value={filterGenre}
              onChange={e => setFilterGenre(e.target.value)}
              style={{
                width: "100%", fontFamily: MONO, fontSize: "13px",
                color: filterGenre ? ORANGE : "#0d0d0d",
                background: "#ffffff", border: `1px solid ${filterGenre ? ORANGE : "rgba(0,0,0,0.13)"}`,
                cursor: "pointer", padding: "10px 8px", outline: "none", marginBottom: "12px",
              }}
            >
              <option value="">All genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <label style={{ display: "block", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "4px" }}>Year</label>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              style={{
                width: "100%", fontFamily: MONO, fontSize: "13px",
                color: filterYear ? ORANGE : "#0d0d0d",
                background: "#ffffff", border: `1px solid ${filterYear ? ORANGE : "rgba(0,0,0,0.13)"}`,
                cursor: "pointer", padding: "10px 8px", outline: "none", marginBottom: "12px",
              }}
            >
              <option value="">All years</option>
              {decades.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <label style={{ display: "block", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "4px" }}>Format</label>
            <select
              value={filterFormat}
              onChange={e => setFilterFormat(e.target.value)}
              style={{
                width: "100%", fontFamily: MONO, fontSize: "13px",
                color: filterFormat ? ORANGE : "#0d0d0d",
                background: "#ffffff", border: `1px solid ${filterFormat ? ORANGE : "rgba(0,0,0,0.13)"}`,
                cursor: "pointer", padding: "10px 8px", outline: "none", marginBottom: "12px",
              }}
            >
              <option value="">All formats</option>
              {formats.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label style={{ display: "block", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "4px" }}>Desirability</label>
            <select
              value={filterDesirability}
              onChange={e => setFilterDesirability(e.target.value)}
              style={{
                width: "100%", fontFamily: MONO, fontSize: "13px",
                color: filterDesirability ? ORANGE : "#0d0d0d",
                background: "#ffffff", border: `1px solid ${filterDesirability ? ORANGE : "rgba(0,0,0,0.13)"}`,
                cursor: "pointer", padding: "10px 8px", outline: "none", marginBottom: "24px",
              }}
            >
              <option value="">All</option>
              {desirabilityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <div style={{ display: "flex", gap: "12px" }}>
              {hasFilters && (
                <button
                  onClick={() => { clearAllFilters(); setFilterSheetOpen(false); }}
                  style={{
                    flex: 1, fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase",
                    color: ORANGE, background: "none", border: `1px solid ${ORANGE}`,
                    cursor: "pointer", padding: "13px",
                  }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setFilterSheetOpen(false)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase",
                  color: "#ffffff", background: ORANGE, border: "none",
                  cursor: "pointer", padding: "13px",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ─── InsightsPanel ───────────────────────────────────────────────────────────

function fmtLabel(name: string): string {
  const u = name.toUpperCase();
  if (u === "LP")       return "Vinyl LPs";
  if (u === "VINYL")    return "Vinyl";
  if (u === "CD")       return "CDs";
  if (u === "CASSETTE") return "Cassettes";
  if (u === '7"')       return '7" Singles';
  if (u === '10"')      return '10" Singles';
  if (u === '12"')      return '12" Singles';
  if (u === "EP")       return "EPs";
  return name;
}

type StatDef = {
  hero:        string;
  label:       string;
  sub?:        string;
  heroItalic?: boolean;
  heroColor?:  string;
};

function InsightsPanel({
  insights,
  total,
  estimatedValue,
  valueCurrency,
  pricedCount,
  discogsValue,
}: {
  insights: CollectionInsights;
  total: number;
  estimatedValue: number;
  valueCurrency: string;
  pricedCount: number;
  discogsValue?: DiscogsValue;
}) {
  const [oneLiner, setOneLiner] = useState<string | null>(null);

  useEffect(() => {
    if (total < 5) return;
    fetch("/api/insights", { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.oneLiner) setOneLiner(d.oneLiner); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (total < 5) return null;

  const stats: StatDef[] = [];

  // 1. Total collection count — always first
  stats.push({ hero: total.toLocaleString(), label: "Items" });

  // 2. Format count
  if (insights.topFormat) {
    stats.push({
      hero:  insights.topFormat.count.toLocaleString(),
      label: fmtLabel(insights.topFormat.name),
    });
  }

  // 3. Holy Grail count — only shown when at least one exists
  if (insights.holyGrailCount > 0) {
    stats.push({
      hero:      insights.holyGrailCount.toLocaleString(),
      label:     "Holy Grail",
      heroColor: "#633806",
    });
  }

  // 4. Genre — top genre as a single tile
  if (insights.topGenres.length > 0) {
    const shortName = (g: string) => g.split(",")[0].trim();
    stats.push({
      hero:  `${insights.topGenres[0].pct}%`,
      label: shortName(insights.topGenres[0].genre),
    });
  }

  // 4. Most collected artist (vinyl count)
  if (insights.topArtist) {
    stats.push({
      hero:  insights.topArtist.name,
      label: `${insights.topArtist.count} vinyl items`,
    });
  }

  // 5. Most represented label
  if (insights.topLabel && insights.topLabel.count > 1) {
    stats.push({
      hero:  insights.topLabel.name,
      label: `${insights.topLabel.count} label items`,
    });
  }

  // 6. Collection span — "1959 → 2026"
  if (insights.yearRange) {
    const { oldest, newest } = insights.yearRange;
    stats.push({
      hero:  oldest !== newest ? `${oldest} → ${newest}` : String(oldest),
      label: "collection span",
    });
  }

  // 7. Most popular year — sits immediately after collection span
  if (insights.mostPopularYear) {
    stats.push({
      hero:  String(insights.mostPopularYear),
      label: "Most collected year",
    });
  }

  // 8. Collection value — Discogs' own calculation when available, local fallback otherwise
  const fmtV = (n: number, c: string) => {
    const s = sym(c);
    return n >= 1000 ? `${s}${(n / 1000).toFixed(1)}k` : `${s}${Math.round(n).toLocaleString("en-US")}`;
  };

  if (discogsValue?.med != null) {
    const c = discogsValue.currency;
    stats.push({
      hero:  fmtV(discogsValue.med, c),
      label: "Median Collection Value",
    });
  } else {
    const currSym = sym(valueCurrency);
    const fmtFallback = (n: number) =>
      n >= 1000 ? `${currSym}${(n / 1000).toFixed(1)}k` : `${currSym}${Math.round(n).toLocaleString("en-US")}`;
    stats.push(
      estimatedValue > 0
        ? { hero: fmtFallback(estimatedValue), label: "Est. Collection Value" }
        : { hero: "—", label: "Est. Collection Value" }
    );
  }

  if (stats.length === 0) return null;

  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, overflow: "hidden" }}>
      {/* Desktop — all stats horizontal */}
      <div className="hidden md:flex" style={{ overflow: "hidden", background: "#FEFBF8", alignItems: "stretch" }}>
        {stats.map((s, i) => (
          <DashStat
            key={i}
            stat={s}
            first={i === 0}
            last={i === stats.length - 1}
          />
        ))}
      </div>
      {/* Mobile — 2×2 grid, 4 hardcoded cells */}
      <div className="grid grid-cols-2 md:hidden" style={{ background: "#FEFBF8" }}>
        <div style={{ padding: "16px", borderRight: "0.5px solid #e8e8e8", borderBottom: "0.5px solid #e8e8e8" }}>
          <div style={{ fontSize: "clamp(1.8rem, 10vw, 2.4rem)", fontWeight: 600, fontFamily: SERIF, lineHeight: 1 }}>
            {total.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888888", marginTop: "6px" }}>
            Items
          </div>
        </div>
        <div style={{ padding: "16px", borderBottom: "0.5px solid #e8e8e8" }}>
          <div style={{ fontSize: "clamp(1.4rem, 8vw, 2rem)", fontWeight: 600, fontFamily: SERIF, lineHeight: 1 }}>
            {insights.topGenres[0]?.genre.split(",")[0].trim() ?? "—"}
          </div>
          <div style={{ fontSize: "11px", fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888888", marginTop: "6px" }}>
            Top genre
          </div>
        </div>
        <div style={{ padding: "16px", borderRight: "0.5px solid #e8e8e8" }}>
          <div style={{ fontSize: "clamp(1.2rem, 7vw, 1.8rem)", fontWeight: 600, fontFamily: SERIF, lineHeight: 1 }}>
            {insights.topArtist?.name ?? "—"}
          </div>
          <div style={{ fontSize: "11px", fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888888", marginTop: "6px" }}>
            Top artist
          </div>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "clamp(1.4rem, 8vw, 2rem)", fontWeight: 600, fontFamily: SERIF, lineHeight: 1 }}>
            {discogsValue?.med != null
              ? `${sym(discogsValue.currency)}${discogsValue.med >= 1000 ? `${(discogsValue.med / 1000).toFixed(1)}k` : Math.round(discogsValue.med).toLocaleString("en-US")}`
              : estimatedValue > 0
                ? `${sym(valueCurrency)}${estimatedValue >= 1000 ? `${(estimatedValue / 1000).toFixed(1)}k` : Math.round(estimatedValue).toLocaleString("en-US")}`
                : "—"}
          </div>
          <div style={{ fontSize: "11px", fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888888", marginTop: "6px" }}>
            Est. value
          </div>
        </div>
      </div>
      <div className="hidden md:block" style={oneLiner ? { borderTop: "1px solid rgba(0,0,0,0.08)" } : undefined}>
        {oneLiner && (
          <div style={{
            margin: "0 0 14px",
            paddingLeft: "10px",
            borderLeft: `2px solid ${ORANGE}`,
          }}>
            <p style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "13px",
              color: "#888888",
              letterSpacing: "0.01em",
              lineHeight: 1.5,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {oneLiner}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DashStat({ stat, first, last }: { stat: StatDef; first: boolean; last: boolean }) {
  const len = stat.hero.length;
  const heroFontSize =
    len > 12 ? "clamp(0.82rem, 1.3vw, 1.05rem)" :
    len > 8  ? "clamp(0.9rem, 1.5vw, 1.25rem)"  :
               "1.5rem";

  return (
    <div style={{
      flex:          "1 1 0",
      minWidth:      0,
      padding:       `10px ${last ? "20px" : "12px"} 10px ${first ? "20px" : "12px"}`,
      borderRight:   last ? "none" : "1px solid #e0e0da",
      boxSizing:     "border-box",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "flex-start",
    }}>
      <p
        title={stat.hero}
        style={{
          fontFamily:    SERIF,
          fontSize:      heroFontSize,
          fontWeight:    400,
          fontStyle:     stat.heroItalic ? "italic" : "normal",
          color:         stat.heroColor ?? "#0d0d0d",
          lineHeight:    1.2,
          margin:        "0 0 5px 0",
          letterSpacing: "-0.01em",
          wordBreak:     "break-word",
          maxWidth:      "100%",
        }}
      >
        {stat.hero}
      </p>
      <p style={{
        fontFamily:    MONO,
        fontSize:      "0.6rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color:         "#aaaaaa",
        lineHeight:    1.2,
        margin:        0,
        whiteSpace:    "nowrap",
        overflow:      "hidden",
        textOverflow:  "ellipsis",
        maxWidth:      "100%",
      }}>
        {stat.label}
      </p>
      {stat.sub && (
        <p style={{
          fontFamily:    MONO,
          fontSize:      "0.55rem",
          letterSpacing: "0.04em",
          color:         "#cccccc",
          lineHeight:    1.3,
          margin:        "3px 0 0",
          wordBreak:     "break-word",
          maxWidth:      "100%",
        }}>
          {stat.sub}
        </p>
      )}
    </div>
  );
}

// ─── StatusBanner ─────────────────────────────────────────────────────────────

function StatusBanner({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color, background: bg, padding: "9px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
      {children}
    </div>
  );
}

// ─── FilterTag ────────────────────────────────────────────────────────────────

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
      color: ORANGE, background: "rgba(204,85,0,0.07)",
      padding: "2px 5px 2px 6px",
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{
          fontFamily: MONO, fontSize: "12px", lineHeight: 1,
          color: ORANGE, background: "none", border: "none",
          cursor: "pointer", padding: "0 1px",
        }}
      >
        ×
      </button>
    </span>
  );
}

// ─── RecordRow ────────────────────────────────────────────────────────────────

function priceColor(median: number): string {
  if (median > 100) return ORANGE;
  if (median > 25)  return "#888888";
  return "#d0d0d0";
}

function fmtMedianPrice(median: number, currency: string): string {
  const s = sym(currency);
  if (median >= 1000) return `${s}${(median / 1000).toFixed(1)}k`;
  return `${s}${Math.round(median)}`;
}

function RecordRow({ record, selected, onClick }: {
  record: CollectionRecord; selected: boolean; onClick: () => void;
}) {
  const displayPrice = record.price_low ?? record.price_median;
  const hasPrice = displayPrice != null && displayPrice > 0;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        width: "100%", padding: "8px 14px", minHeight: "44px",
        background: selected ? "rgba(204,85,0,0.04)" : "transparent",
        border: "none",
        borderLeft: `2px solid ${selected ? ORANGE : "transparent"}`,
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        cursor: "pointer", textAlign: "left", transition: "background 0.1s",
      }}
    >
      <div style={{ width: 36, height: 36, background: "#f0f0f0", flexShrink: 0, overflow: "hidden" }}>
        {record.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={record.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: "14px", color: "#e0e0e0" }}>♩</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "13px", color: selected ? "#0d0d0d" : "#1a1a1a", lineHeight: 1.2, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {record.album}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#999999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {record.artist}
          {record.year ? <span style={{ color: "#d0d0d0" }}> · {record.year}</span> : null}
        </p>
      </div>
      {hasPrice && (
        <span style={{
          fontFamily: MONO,
          fontSize: "9px",
          letterSpacing: "0.03em",
          color: priceColor(displayPrice!),
          flexShrink: 0,
          paddingLeft: "4px",
        }}>
          {fmtMedianPrice(displayPrice!, record.price_currency ?? "USD")}
        </span>
      )}
    </button>
  );
}

// ─── AlbumDetail ─────────────────────────────────────────────────────────────

function AlbumDetail({ record, detail, price, loading, valueCurrency }: {
  record: CollectionRecord;
  detail: ReleaseDetail | null;
  price: PriceData | null;
  loading: boolean;
  valueCurrency?: string;
}) {
  const [openToOffers, setOpenToOffers] = useState<boolean>(record?.open_to_offers ?? false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  useEffect(() => {
    setOpenToOffers(record?.open_to_offers ?? false);
    setOffersError(null);
  }, [record?.id, record?.open_to_offers]);

  async function handleOpenToOffers() {
    if (offersLoading) return;
    const next = !openToOffers;
    setOpenToOffers(next);
    setOffersLoading(true);
    setOffersError(null);
    try {
      const res = await fetch("/api/collection/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id, open_to_offers: next }),
      });
      if (!res.ok) {
        setOpenToOffers(!next);
        const json = await res.json().catch(() => null) as { error?: string } | null;
        setOffersError(json?.error ?? "Could not save. Please try again.");
      }
    } catch {
      setOpenToOffers(!next);
      setOffersError("Network error. Please try again.");
    } finally {
      setOffersLoading(false);
    }
  }

  const displayLabel = detail?.labels?.[0]?.name ?? record.label ?? null;
  const catno        = detail?.labels?.[0]?.catno ?? null;
  const format       = detail ? formatLabel(detail.formats) : null;
  const vinylColour  = detail ? extractVinylColour(detail.formats) : null;
  const country      = detail?.country ?? null;
  const year         = record.year ?? detail?.year ?? null;
  const genre        = record.genre ?? detail?.genres?.[0] ?? null;
  const styles       = detail?.styles?.length ? detail.styles.join(", ") : null;
  const producers    = detail?.extraartists
    ?.filter((e) => /producer/i.test(e.role))
    .map((e) => e.name)
    .join(", ") || null;

  const tier = getDesirabilityTier(
    detail?.community?.have  ?? null,
    detail?.community?.want  ?? null,
    price?.lowest            ?? null,
    price?.num_for_sale      ?? null,
  );
  const tierMeta = tier ? TIERS[tier] : null;

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
    <div style={{ padding: "16px 20px 20px", maxWidth: "480px" }}>
      {/* Art — capped at 220px, object-fit: contain so any aspect ratio fits */}
      <div style={{ width: "100%", maxWidth: 220, maxHeight: 220, height: 220, background: "#f0f0f0", overflow: "hidden", marginBottom: "12px" }}>
        {record.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={record.cover_url} alt={record.album} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: "36px", color: "#ddd" }}>♩</span>
          </div>
        )}
      </div>

      {/* Desirability pill — only when a tier is resolved */}
      {tierMeta && (
        <span style={{
          display: "inline-block", width: "fit-content",
          fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
          padding: "3px 10px", borderRadius: "10px",
          background: tierMeta.bg, color: tierMeta.color,
          marginBottom: "8px",
        }}>
          {tierMeta.label}
        </span>
      )}

      {/* Title + artist */}
      <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: "#0d0d0d", lineHeight: 1.2, marginBottom: "3px" }}>
        {record.album}
      </h2>
      <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: "#999999", marginBottom: "12px" }}>
        {record.artist}
      </p>

      {/* Metadata */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
        <MetaRow label="Label"   value={displayLabel} />
        {format       && <MetaRow label="Format"  value={format} />}
        {vinylColour  && <MetaRow label="Vinyl"   value={vinylColour} />}
        {record.media_condition  && <MetaRow label="Media"  value={record.media_condition} />}
        {record.sleeve_condition && <MetaRow label="Sleeve" value={record.sleeve_condition} />}
        <MetaRow label="Country" value={country} />
        <MetaRow label="Year"    value={year ? String(year) : null} />
        <MetaRow label="Genre"   value={genre} />
        {styles   && <MetaRow label="Style"   value={styles} />}
        {catno     && <MetaRow label="Cat #"     value={catno} />}
        {producers && <MetaRow label="Producers" value={producers} />}

        {/* Marketplace pricing */}
        {price && (
          <>
            {/* Market Value row — inline with Open to Offers toggle */}
            {formatPrice(price.lowest, price.currency || valueCurrency || "USD") && (
              <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", width: "84px", flexShrink: 0 }}>
                  Market Value
                </span>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, letterSpacing: "0.03em" }}>
                  {formatPrice(price.lowest, price.currency || valueCurrency || "USD")}
                </span>
                <button
                  onClick={handleOpenToOffers}
                  disabled={offersLoading}
                  style={{
                    fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em",
                    textTransform: "uppercase", flexShrink: 0,
                    color: offersLoading ? "#aaaaaa" : openToOffers ? "#ffffff" : ORANGE,
                    background: openToOffers && !offersLoading ? ORANGE : "transparent",
                    border: `1px solid ${offersLoading ? "#dddddd" : ORANGE}`,
                    padding: "2px 7px", cursor: offersLoading ? "default" : "pointer",
                  }}
                >
                  {offersLoading ? "…" : openToOffers ? "Open to Offers ✓" : "Open to Offers"}
                </button>
              </div>
            )}
            <PriceRow label="Median"    value={formatPrice(price.median, price.currency)} />
            <PriceRow label="High"     value={formatPrice(price.highest,   price.currency)} />
            <PriceRow
              label="Last sold"
              value={formatPrice(price.last_sold, price.currency)}
              note={formatDate(price.last_sold_date)}
            />
            {price.num_for_sale > 0 && (
              <div style={{ padding: "8px 0 4px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                  {record.discogs_id && (
                    <a href={`https://www.discogs.com/release/${record.discogs_id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textDecoration: "none", color: ORANGE }}>
                      View on Discogs ↗
                    </a>
                  )}
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", letterSpacing: "0.04em" }}>
                    {price.num_for_sale} for sale
                  </span>
                </div>
                <p style={{ fontFamily: MONO, fontSize: "10px", color: "#bbbbbb", letterSpacing: "0.03em", lineHeight: 1.5, margin: "4px 0 0" }}>
                  Market value reflects the lowest active listing at the time of your last sync.
                </p>
              </div>
            )}
            {!price.lowest && !price.median && !price.highest && !price.last_sold && (
              <div style={{ padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", letterSpacing: "0.06em" }}>
                  No market data
                </span>
              </div>
            )}
            {/* Show link alone when num_for_sale is 0 (paired version shown above when > 0) */}
            {price.num_for_sale === 0 && record.discogs_id && (
              <div style={{ padding: "8px 0 4px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <a href={`https://www.discogs.com/release/${record.discogs_id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textDecoration: "none", color: ORANGE }}>
                  View on Discogs ↗
                </a>
              </div>
            )}
          </>
        )}
        {/* Show link when price data hasn't loaded yet */}
        {!price && record.discogs_id && (
          <div style={{ padding: "8px 0 4px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <a href={`https://www.discogs.com/release/${record.discogs_id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textDecoration: "none", color: ORANGE }}>
              View on Discogs ↗
            </a>
          </div>
        )}
      </div>

      {offersError && (
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#cc3300", margin: "8px 0 0" }}>
          {offersError}
        </p>
      )}
    </div>
    </div>
  );
}

// ─── PriceRow ─────────────────────────────────────────────────────────────────

function PriceRow({ label, value, note }: {
  label: string; value: string | null; note?: string | null;
}) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "baseline" }}>
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", width: "84px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, letterSpacing: "0.03em" }}>
        {value}
      </span>
      {note && (
        <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", marginLeft: "8px", letterSpacing: "0.02em" }}>
          {note}
        </span>
      )}
    </div>
  );
}

// ─── MetaRow ──────────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "baseline" }}>
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", width: "84px", flexShrink: 0, lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: "11px", color: "#0d0d0d", letterSpacing: "0.03em", lineHeight: 1.4 }}>
        {value}
      </span>
    </div>
  );
}

// ─── TracklistPanel ───────────────────────────────────────────────────────────

function TracklistPanel({ tracks, loading, bandcamp, record }: {
  tracks:   TrackItem[] | null;
  loading:  boolean;
  bandcamp: BandcampData | null;
  record:   CollectionRecord | null;
}) {
  const artist      = record?.artist ?? "";
  const album       = record?.album  ?? "";
  const discogsId   = record?.discogs_id ?? null;
  const bcSearch    = bandcamp?.searchUrl ?? `https://bandcamp.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`;
  const amSearch    = `https://music.apple.com/search?term=${encodeURIComponent(`${artist} ${album}`)}`;
  const tidalSearch = `https://tidal.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`;

  const [lastPlayed, setLastPlayed] = useState<string | null>(record?.last_played_at ?? null);
  const [playedLoading, setPlayedLoading] = useState(false);

  const [isEssential, setIsEssential] = useState<boolean>(record?.is_essential ?? false);
  const [essentialLoading, setEssentialLoading] = useState(false);

  const [feeling, setFeeling] = useState<string | null>(record?.feeling ?? null);
  const [feelingLoading, setFeelingLoading] = useState(false);
  const [feelingOpen, setFeelingOpen] = useState(false);
  const [feelingAbove, setFeelingAbove] = useState(false);
  const feelingRef = useRef<HTMLDivElement>(null);

  // Sync when selected record changes
  useEffect(() => {
    setLastPlayed(record?.last_played_at ?? null);
  }, [record?.id, record?.last_played_at]);

  useEffect(() => {
    setIsEssential(record?.is_essential ?? false);
  }, [record?.id, record?.is_essential]);

  useEffect(() => {
    setFeeling(record?.feeling ?? null);
  }, [record?.id, record?.feeling]);

  useEffect(() => {
    if (!feelingOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (feelingRef.current && !feelingRef.current.contains(e.target as Node)) {
        setFeelingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [feelingOpen]);

  // ── Spotify ───────────────────────────────────────────────────────────────
  const [spotifyPremium,  setSpotifyPremium]  = useState(false);
  // undefined = searching (loading), null = no match found, string = match
  const [currentSpotifyUri, setCurrentSpotifyUri] = useState<string | null | undefined>(undefined);
  const spotifyUriCache = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    fetch("/api/spotify/token")
      .then(r => r.json() as Promise<{ connected: boolean; access_token?: string; product?: string }>)
      .then(data => {
        if (data.connected && data.access_token && data.product === "premium") {
          setSpotifyPremium(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Reset immediately so SpotifyPlayer's reset effect fires for the new album.
    // undefined keeps the player mounted (SDK stays alive) but clears the old URI.
    setCurrentSpotifyUri(undefined);
    if (!spotifyPremium || !record) {
      setCurrentSpotifyUri(null);
      return;
    }
    const key = `${record.artist}||${record.album}`;
    if (spotifyUriCache.current.has(key)) {
      setCurrentSpotifyUri(spotifyUriCache.current.get(key) ?? null);
      return;
    }
    // Already matched by the background Spotify matcher (or a previous visit
    // here) — use the stored album, no live search needed.
    if (record.spotify_matched && record.spotify_album_id) {
      const cachedUri = `spotify:album:${record.spotify_album_id}`;
      spotifyUriCache.current.set(key, cachedUri);
      setCurrentSpotifyUri(cachedUri);
      return;
    }
    const artist   = record.artist;
    const album    = record.album;
    const recordId = record.id;
    let cancelled = false;

    function cacheResult(uri: string | null) {
      // Best-effort — write the live-search result back so future opens of
      // this record (Collection or Playlist tab) skip the search entirely.
      fetch("/api/collection/spotify-match-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId, matched: !!uri,
          albumId: uri ? uri.split(":").pop() : null,
        }),
      }).catch(() => {});
    }

    (async () => {
      try {
        // Always fetch a fresh token — stale state tokens expire after 1 hour
        const token = await getFreshSpotifyToken();
        if (!token || cancelled) { setCurrentSpotifyUri(null); return; }

        // Quoted field-filter search — precise match
        const q1 = encodeURIComponent(`album:"${album}" artist:"${artist}"`);
        const r1 = await fetch(`https://api.spotify.com/v1/search?q=${q1}&type=album&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // A non-OK response (e.g. 429 rate limit, 401 expired token) is not the
        // same as "no match" — don't cache it client-side or write it back to
        // the DB, or a transient Spotify error permanently poisons the record's
        // match status for every future visit.
        if (!r1.ok) { if (!cancelled) setCurrentSpotifyUri(null); return; }
        const d1 = await r1.json() as { albums?: { items?: Array<{ uri: string }> } };
        let uri  = d1?.albums?.items?.[0]?.uri ?? null;

        if (!uri) {
          // Fallback: plain-text search handles name variations (e.g. "Various", remaster suffixes)
          const q2 = encodeURIComponent(`${artist} ${album}`);
          const r2 = await fetch(`https://api.spotify.com/v1/search?q=${q2}&type=album&limit=1`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r2.ok) { if (!cancelled) setCurrentSpotifyUri(null); return; }
          const d2 = await r2.json() as { albums?: { items?: Array<{ uri: string }> } };
          uri = d2?.albums?.items?.[0]?.uri ?? null;
        }

        if (cancelled) return;
        spotifyUriCache.current.set(key, uri);
        setCurrentSpotifyUri(uri);
        cacheResult(uri);
      } catch {
        if (cancelled) return;
        spotifyUriCache.current.set(key, null);
        setCurrentSpotifyUri(null);
      }
    })();
    return () => { cancelled = true; };
  }, [record?.id, spotifyPremium]);

  const FEELINGS = ["upbeat", "joyful", "calm", "tender", "nostalgic", "melancholy", "powerful", "haunted", "longing"] as const;

  async function handleEssential() {
    if (!record?.id || essentialLoading) return;
    const next = !isEssential;
    setIsEssential(next);
    setEssentialLoading(true);
    try {
      const res = await fetch("/api/collection/tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id, is_essential: next }),
      });
      if (!res.ok) setIsEssential(!next);
    } catch {
      setIsEssential(!next);
    } finally {
      setEssentialLoading(false);
    }
  }

  async function handleFeeling(word: string) {
    if (!record?.id || feelingLoading) return;
    const next = feeling === word ? null : word;
    setFeeling(next);
    setFeelingOpen(false);
    setFeelingLoading(true);
    try {
      const res = await fetch("/api/collection/tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id, feeling: next }),
      });
      if (!res.ok) setFeeling(feeling);
    } catch {
      setFeeling(feeling);
    } finally {
      setFeelingLoading(false);
    }
  }

  function openFeelingPopover() {
    if (feelingRef.current) {
      const rect = feelingRef.current.getBoundingClientRect();
      setFeelingAbove(window.innerHeight - rect.bottom < 180);
    }
    setFeelingOpen(v => !v);
  }

  async function handlePlayedToday() {
    if (!record?.id || playedLoading) return;
    setPlayedLoading(true);
    try {
      const res = await fetch("/api/collection/played", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id }),
      });
      const json = await res.json() as { last_played_at?: string };
      if (json.last_played_at) setLastPlayed(json.last_played_at);
    } finally {
      setPlayedLoading(false);
    }
  }

  function formatLastPlayed(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  const baseLinkStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textDecoration: "none",
  };
  const linkStyle: React.CSSProperties = { ...baseLinkStyle, color: ORANGE };
  const secondaryLinkStyle: React.CSSProperties = { ...baseLinkStyle, color: "#555555" };

  return (
    <div>
      {/* ── Spotify Player ── */}
      {/* SpotifyPlayer stays mounted while Premium + a record is selected so the SDK
          player never disconnects between album switches. spotifyUri=undefined when
          searching so the player renders nothing but keeps the SDK connection alive. */}
      {spotifyPremium && record && (
        <SpotifyPlayer mode="collection" spotifyUri={currentSpotifyUri ?? undefined} />
      )}
      {spotifyPremium && record && currentSpotifyUri === null && (
        <div style={{ padding: "10px 28px", borderBottom: "1px solid #e0e0da", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", color: "#aaaaaa" }}>
          No Spotify match for this release.
        </div>
      )}

      {/* ── Played Today + Essential + Feeling ── */}
      {record && (
        <div style={{ padding: "16px 28px 0" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>

            {/* Played Today */}
            <button
              onClick={handlePlayedToday}
              disabled={playedLoading}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em",
                textTransform: "uppercase", color: playedLoading ? "#aaaaaa" : ORANGE,
                background: "transparent", border: `1px solid ${playedLoading ? "#dddddd" : ORANGE}`,
                padding: "5px 12px", cursor: playedLoading ? "default" : "pointer",
                display: "inline-block",
              }}
            >
              {playedLoading ? "Saving…" : "Played Today"}
            </button>

            {/* Essential */}
            <button
              onClick={handleEssential}
              disabled={essentialLoading}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: essentialLoading ? "#aaaaaa" : isEssential ? "#FDF6F0" : "#0a0a0a",
                background: isEssential && !essentialLoading ? ORANGE : "transparent",
                border: `1px solid ${essentialLoading ? "#dddddd" : isEssential ? ORANGE : "#0a0a0a"}`,
                padding: "5px 12px", cursor: essentialLoading ? "default" : "pointer",
                display: "inline-flex", alignItems: "center", gap: "3px",
              }}
            >
              <span style={{ fontFamily: SERIF, fontSize: "11px", lineHeight: 1 }}>ō</span>
              {essentialLoading ? "Saving…" : "Essential"}
            </button>

            {/* Feeling */}
            <div ref={feelingRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <button
                onClick={openFeelingPopover}
                style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: feeling ? "#FDF6F0" : "#888888",
                  background: feeling ? ORANGE : "transparent",
                  border: `1px solid ${feeling ? ORANGE : "#e0e0da"}`,
                  padding: "5px 10px", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: "4px",
                }}
              >
                {feeling ? feeling.toUpperCase() : "+ Feeling"}
                <span style={{ fontSize: "8px", opacity: 0.7 }}>⌄</span>
              </button>

              {feelingOpen && (
                <div style={{
                  position: "absolute",
                  [feelingAbove ? "bottom" : "top"]: "calc(100% + 4px)",
                  right: 0,
                  background: "#ffffff",
                  border: "1px solid #e0e0da",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  zIndex: 50,
                  width: "216px",
                }}>
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid #e0e0da" }}>
                    <span style={{ fontFamily: MONO, fontSize: "8.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888888" }}>
                      How does this make you feel?
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "none", borderLeft: "1px solid #e0e0da" }}>
                    {FEELINGS.map(word => {
                      const selected = feeling === word;
                      return (
                        <button
                          key={word}
                          onClick={() => handleFeeling(word)}
                          style={{
                            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: selected ? "#FDF6F0" : "#0a0a0a",
                            background: selected ? ORANGE : "transparent",
                            border: "none",
                            borderRight: "1px solid #e0e0da",
                            borderBottom: "1px solid #e0e0da",
                            padding: "10px 4px",
                            cursor: "pointer", textAlign: "center" as const,
                            display: "block", width: "100%",
                          }}
                        >
                          {word}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
          {lastPlayed && (
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#aaaaaa", margin: "6px 0 0" }}>
              Last played: {formatLastPlayed(lastPlayed)}
            </p>
          )}
        </div>
      )}

      {/* ── Tracklist ── */}
      <div style={{ padding: "20px 28px 24px" }}>
        {loading ? (
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#d8d8d8" }}>
            Loading…
          </p>
        ) : !tracks || tracks.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#e0e0e0" }}>
            No tracklist
          </p>
        ) : (
          <>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "10px" }}>
              Tracklist
            </p>
            {tracks.map((t, i) => {
              if (t.type_ === "heading") {
                return (
                  <div key={i} style={{ padding: i === 0 ? "0 0 4px" : "12px 0 4px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#c0c0c0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    {t.title}
                  </div>
                );
              }
              return (
                <div key={i} style={{ display: "flex", gap: "14px", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "baseline" }}>
                  <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", width: "26px", flexShrink: 0, textAlign: "right" }}>
                    {t.position}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: "12px", color: "#1a1a1a", flex: 1, letterSpacing: "0.01em", lineHeight: 1.3 }}>
                    {t.title}
                  </span>
                  {t.duration && (
                    <span style={{ fontFamily: MONO, fontSize: "9px", color: "#cccccc", flexShrink: 0 }}>
                      {t.duration}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Bandcamp + streaming ── */}
      {record && (
        <>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", margin: "0 28px" }} />
          <div style={{ padding: "18px 28px 28px" }}>

            {/* Embed player — only when a Bandcamp album was found */}
            {bandcamp?.embedUrl && (
              // eslint-disable-next-line jsx-a11y/iframe-has-title
              <iframe
                src={bandcamp.embedUrl}
                style={{ border: 0, width: "100%", height: 120, display: "block", marginBottom: "14px" }}
                seamless
                title={`${album} on Bandcamp`}
                allow="autoplay *"
              />
            )}

            {/* Links */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <a
                href={amSearch}
                target="_blank"
                rel="noopener noreferrer"
                style={secondaryLinkStyle}
                onClick={(e) => { e.preventDefault(); openAppleMusicLink(amSearch); }}
              >
                Open in Apple Music ↗
              </a>
              <a href={tidalSearch} target="_blank" rel="noopener noreferrer" style={secondaryLinkStyle}>
                Open in Tidal ↗
              </a>
              {/* Bandcamp: link when no embed, omit when embed is showing (iframe is the link) */}
              {!bandcamp?.embedUrl && (
                <a href={bcSearch} target="_blank" rel="noopener noreferrer" style={secondaryLinkStyle}>
                  Search on Bandcamp ↗
                </a>
              )}
              <a
                href={`https://songmeanings.com/query/?query=${encodeURIComponent(artist + " " + album)}&type=albums`}
                target="_blank"
                rel="noopener noreferrer"
                style={secondaryLinkStyle}
              >
                Discuss these songs on SongMeanings ↗
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
