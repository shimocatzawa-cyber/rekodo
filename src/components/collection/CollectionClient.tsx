"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import type { CollectionRecord, CollectionInsights } from "@/app/collection/page";
import { persistRecordPrice } from "@/app/collection/actions";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

// ─── Desirability ─────────────────────────────────────────────────────────────

type DesirabilityTier = "rare" | "holy-grail" | "cult" | "widely-loved" | "in-demand" | "steady";

const TIERS: Record<DesirabilityTier, { label: string; bg: string; color: string }> = {
  "rare":         { label: "Rare",          bg: "#F0997B", color: "#712B13" },
  "holy-grail":   { label: "Holy grail",    bg: "#FAC775", color: "#633806" },
  "cult":         { label: "Cult pressing", bg: "#CECBF6", color: "#3C3489" },
  "widely-loved": { label: "Widely loved",  bg: "#C0DD97", color: "#27500A" },
  "in-demand":    { label: "In demand",     bg: "#9FE1CB", color: "#085041" },
  "steady":       { label: "Steady seller", bg: "#E1F5EE", color: "#0F6E56" },
};

function getDesirabilityTier(
  have: number, want: number, price: number, numForSale: number
): DesirabilityTier | null {
  const total      = have + want;
  if (total < 30) return null;
  const notForSale = numForSale === 0;
  const confidence = Math.log10(total + 1) / Math.log10(50001);
  const ratio      = want / Math.max(have, 1);
  const baseScore  = ratio * (0.4 + 0.6 * confidence);
  const priceBoost = (price >= 50 || notForSale) ? Math.min(price / 400, 0.5) : 0;
  const finalScore = baseScore + priceBoost;
  if (want > have && (price >= 200 || notForSale) && total >= 30) return "rare";
  if (finalScore >= 1.5 && total >= 500 && (price >= 50 || notForSale)) return "holy-grail";
  if (baseScore >= 2.5 && total >= 30 && total < 500) return "cult";
  if (total >= 5000 && ratio >= 0.15 && ratio <= 0.65) return "widely-loved";
  if (baseScore >= 0.45) return "in-demand";
  if (baseScore >= 0.15) return "steady";
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackItem = {
  position: string;
  title: string;
  duration: string;
  type_: string;
};

type FormatItem  = { name: string; qty: string; descriptions?: string[] };
type LabelItem   = { name: string; catno: string };

type ReleaseDetail = {
  tracklist?:  TrackItem[];
  formats?:    FormatItem[];
  labels?:     LabelItem[];
  country?:    string;
  year?:       number;
  genres?:     string[];
  community?:  { have: number; want: number };
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

function groupByLetter(records: CollectionRecord[]) {
  const sorted = [...records].sort((a, b) =>
    stripArticle(a.artist || "Unknown").toLowerCase()
      .localeCompare(stripArticle(b.artist || "Unknown").toLowerCase(), "en")
  );
  const groups: Array<{ letter: string; records: CollectionRecord[] }> = [];
  for (const r of sorted) {
    const letter = sortLetter(r.artist || "");
    const last   = groups[groups.length - 1];
    if (!last || last.letter !== letter) groups.push({ letter, records: [r] });
    else last.records.push(r);
  }
  const hashIdx = groups.findIndex((g) => g.letter === "#");
  if (hashIdx > 0) groups.push(...groups.splice(hashIdx, 1));
  return groups;
}

function formatLabel(formats?: FormatItem[]): string {
  if (!formats?.length) return "";
  const skip = ["Album", "Compilation", "Stereo", "Mono", "Reissue", "Repress"];
  return formats.map((f) => {
    const qty   = f.qty && f.qty !== "1" ? `${f.qty}×` : "";
    const descs = (f.descriptions ?? []).filter((d) => !skip.includes(d));
    return `${qty}${descs.length ? descs.join(", ") : f.name}`;
  }).join(", ");
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

  const [searchQuery,   setSearchQuery]   = useState("");
  const [filterGenre,   setFilterGenre]   = useState("");
  const [filterYear,    setFilterYear]    = useState("");
  const [filterFormat,  setFilterFormat]  = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [sortBy,        setSortBy]        = useState("artist-az");

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
      };
      const allLinks: LinkRow[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("user_records")
          .select("record_id, value, price_low, price_median, price_currency, media_condition, sleeve_condition")
          .eq("user_id", user.id)
          .range(from, from + PAGE - 1);
        console.log(`[collection] user_records page from=${from}: count=${data?.length ?? 0} error=${JSON.stringify(error)}`);
        if (!data || data.length === 0) break;
        allLinks.push(...(data as LinkRow[]));
        if (data.length < PAGE) break;
      }

      const recordIds        = allLinks.map((l) => l.record_id);
      const valueMap           = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.value ?? null]));
      const priceLowMap        = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.price_low ?? null]));
      const priceMedianMap     = new Map<string, number | null>(allLinks.map((l) => [l.record_id, l.price_median ?? null]));
      const priceCurrencyMap   = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.price_currency ?? null]));
      const mediaConditionMap  = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.media_condition  ?? null]));
      const sleeveConditionMap = new Map<string, string | null>(allLinks.map((l) => [l.record_id, l.sleeve_condition ?? null]));
      const BATCH        = 400;
      const recordsMap   = new Map<string, Omit<CollectionRecord, "value" | "price_low" | "price_median" | "price_currency">>();
      for (let i = 0; i < recordIds.length; i += BATCH) {
        const { data, error } = await supabase
          .from("records")
          .select("id, discogs_id, artist, album, year, genre, cover_url, label, format, country")
          .in("id", recordIds.slice(i, i + BATCH));
        console.log(`[collection] records batch i=${i}: count=${data?.length ?? 0} error=${JSON.stringify(error)}`);
        for (const r of data ?? []) recordsMap.set(r.id, r as Omit<CollectionRecord, "value" | "price_low" | "price_median" | "price_currency">);
      }

      const fetched: CollectionRecord[] = recordIds
        .map((id) => {
          const r = recordsMap.get(id);
          if (!r) return undefined;
          return {
            ...r,
            value:            valueMap.get(id)           ?? null,
            price_low:        priceLowMap.get(id)        ?? null,
            price_median:     priceMedianMap.get(id)     ?? null,
            price_currency:   priceCurrencyMap.get(id)   ?? null,
            media_condition:  mediaConditionMap.get(id)  ?? null,
            sleeve_condition: sleeveConditionMap.get(id) ?? null,
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
  const [syncState,    setSyncState]    = useState<SyncState>("idle");
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResult,   setSyncResult]   = useState<SyncResult | null>(null);

  const [priceProgress, setPriceProgress] = useState<{ done: number; total: number; phase: "low" } | null>(null);

  useEffect(() => {
    if (!startSync || syncTriggered.current) return;
    syncTriggered.current = true;
    router.replace("/collection", { scroll: false });
    runSync();
  }, [startSync]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select a random record on load — fires once when collection is first non-empty
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || collection.length === 0) return;
    autoSelected.current = true;
    const idx = Math.floor(Math.random() * collection.length);
    selectRecord(collection[idx]);
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (filterGenre)   result = result.filter(r => r.genre   === filterGenre);
    if (filterYear)    result = result.filter(r => matchesDecade(r.year, filterYear));
    if (filterFormat)  result = result.filter(r => r.format  === filterFormat);
    if (filterCountry) result = result.filter(r => r.country === filterCountry);
    return result;
  }, [collection, searchQuery, filterGenre, filterYear, filterFormat, filterCountry]);

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

  const useGrouped = sortBy === "artist-az" || sortBy === "artist-za";
  const filteredGroups = useMemo(() => {
    if (!useGrouped) return [];
    return groupByLetter(sortedCollection);
  }, [sortedCollection, useGrouped]);

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

  const countries = useMemo(() => {
    const cs = new Set<string>();
    for (const r of collection) if (r.country) cs.add(r.country);
    return [...cs].sort();
  }, [collection]);

  const hasFilters = !!searchQuery.trim() || !!filterGenre || !!filterYear || !!filterFormat || !!filterCountry;

  function clearAllFilters() {
    setSearchQuery("");
    setFilterGenre("");
    setFilterYear("");
    setFilterFormat("");
    setFilterCountry("");
  }

  const SORT_OPTIONS = [
    { value: "artist-az",      label: "Artist A–Z" },
    { value: "artist-za",      label: "Artist Z–A" },
    { value: "value-high-low", label: "Market Value: High to Low" },
    { value: "value-low-high", label: "Market Value: Low to High" },
    { value: "year-new-old",   label: "Year: Newest First" },
    { value: "year-old-new",   label: "Year: Oldest First" },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#ffffff", overflow: "hidden" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Status banners ── */}
      {oauthDenied && (
        <StatusBanner color="#aaaaaa" bg="#f4f4f4">Discogs authorization cancelled</StatusBanner>
      )}
      {oauthError && (
        <StatusBanner color="#cc2200" bg="#fff5f5">Discogs connection error — please try again</StatusBanner>
      )}
      {syncState === "syncing" && syncProgress && (
        <StatusBanner color="#0d0d0d" bg="#f4f4f4">{syncProgress.message}</StatusBanner>
      )}
      {priceProgress && (
        <StatusBanner color="#0d0d0d" bg="#f4f4f4">
          Pricing records… {priceProgress.done} of {priceProgress.total}
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


      {/* ── Insights panel ── */}
      {insights && (
        <InsightsPanel
          insights={insights}
          total={collection.length}
          estimatedValue={estimatedValue}
          valueCurrency={valueCurrency}
          pricedCount={pricedCount}
          discogsValue={discogsValue}
        />
      )}

      {/* ── Empty state (0 records) ── */}
      {collection.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: "28px", fontWeight: 400, color: "#0d0d0d", marginBottom: "10px", letterSpacing: "-0.01em" }}>
            Your collection starts here.
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: "#aaaaaa", marginBottom: "28px" }}>
            Import your Discogs collection to get started
          </p>
          <button
            type="button"
            onClick={() => { window.location.href = "/api/discogs/oauth/init"; }}
            style={{
              fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#ffffff", background: ORANGE,
              border: "none", cursor: "pointer",
              padding: "12px 28px",
              marginBottom: "16px",
            }}
          >
            Import from Discogs
          </button>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: "#cccccc" }}>
            Or search for records to add individually
          </p>
        </div>
      )}

      {/* ── Three-column panel ── */}
      {collection.length > 0 && (
      <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "380px 1fr 380px" }}>

        {/* Col 1 — search + filters + A-Z record list */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid rgba(0,0,0,0.08)", minWidth: 0, overflow: "hidden" }}>

          {/* ── Fixed: search + filters ── */}
          <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>

            {/* Sync + Random row */}
            <div style={{ padding: "8px 10px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

            {/* Search input */}
            <div style={{ padding: "2px 10px 6px" }}>
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
                value={filterCountry}
                onChange={e => setFilterCountry(e.target.value)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: filterCountry ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${filterCountry ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <option value="">Country</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Sort dropdown */}
            <div style={{ padding: "0 10px 6px" }}>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  width: "100%", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                  color: sortBy !== "artist-az" ? ORANGE : "#888888",
                  background: "#ffffff",
                  border: `1px solid ${sortBy !== "artist-az" ? ORANGE : "rgba(0,0,0,0.13)"}`,
                  cursor: "pointer", padding: "4px 6px", outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Active filter tags */}
            {(filterGenre || filterYear || filterFormat || filterCountry) && (
              <div style={{ padding: "0 10px 6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {filterGenre   && <FilterTag label={`Genre: ${filterGenre}`}     onRemove={() => setFilterGenre("")} />}
                {filterYear    && <FilterTag label={`Year: ${filterYear}`}       onRemove={() => setFilterYear("")} />}
                {filterFormat  && <FilterTag label={`Format: ${filterFormat}`}   onRemove={() => setFilterFormat("")} />}
                {filterCountry && <FilterTag label={`Country: ${filterCountry}`} onRemove={() => setFilterCountry("")} />}
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
                    onClick={() => selectRecord(record)}
                  />
                ))}
              </div>
            )) : sortedCollection.map((record) => (
              <RecordRow
                key={record.id}
                record={record}
                selected={selectedRecord?.id === record.id}
                onClick={() => selectRecord(record)}
              />
            ))}
          </div>
        </div>

        {selectedRecord ? (
          <>
            {/* Col 2 — Album details */}
            <div style={{ borderRight: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <AlbumDetail
                record={selectedRecord}
                detail={releaseDetail}
                price={priceData}
                loading={detailLoading}
                valueCurrency={valueCurrency}
              />
            </div>

            {/* Col 3 — Tracklist + Bandcamp */}
            <div style={{ overflowY: "auto", minWidth: 0 }}>
              <TracklistPanel
                tracks={releaseDetail?.tracklist ?? null}
                loading={detailLoading}
                bandcamp={bandcampData}
                record={selectedRecord}
              />
            </div>
          </>
        ) : (
          <div style={{ gridColumn: "2 / 4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <p style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8" }}>Select a record</p>
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#e4e4e4", letterSpacing: "0.08em" }}>
              {collection.length} {collection.length === 1 ? "record" : "records"} in your collection
            </p>
          </div>
        )}
      </div>
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

  // 3. Genre — top genre as a single tile
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
      <div style={{ display: "flex", overflow: "hidden", background: "#FEFBF8", alignItems: "stretch" }}>
        {stats.map((s, i) => (
          <DashStat
            key={i}
            stat={s}
            first={i === 0}
            last={i === stats.length - 1}
          />
        ))}
      </div>
      {oneLiner && (
        <div style={{
          margin: "0 28px 14px",
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
        width: "100%", padding: "8px 14px",
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
  const displayLabel = detail?.labels?.[0]?.name ?? record.label ?? null;
  const catno        = detail?.labels?.[0]?.catno ?? null;
  const format       = detail ? formatLabel(detail.formats) : null;
  const country      = detail?.country ?? null;
  const year         = record.year ?? detail?.year ?? null;
  const genre        = record.genre ?? detail?.genres?.[0] ?? null;

  const tier = getDesirabilityTier(
    detail?.community?.have  ?? 0,
    detail?.community?.want  ?? 0,
    price?.lowest            ?? 0,
    price?.num_for_sale      ?? 0,
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
        {format   && <MetaRow label="Format"  value={format} />}
        {record.media_condition  && <MetaRow label="Media"  value={record.media_condition} />}
        {record.sleeve_condition && <MetaRow label="Sleeve" value={record.sleeve_condition} />}
        <MetaRow label="Country" value={country} />
        <MetaRow label="Year"    value={year ? String(year) : null} />
        <MetaRow label="Genre"   value={genre} />
        {catno    && <MetaRow label="Cat #"   value={catno} />}

        {/* Marketplace pricing */}
        {price && (
          <>
            <PriceRow label="Market Value" value={formatPrice(price.lowest, price.currency || valueCurrency || "USD")} />
            <PriceRow label="Median"    value={formatPrice(price.median, price.currency)} />
            <PriceRow label="High"     value={formatPrice(price.highest,   price.currency)} />
            <PriceRow
              label="Last sold"
              value={formatPrice(price.last_sold, price.currency)}
              note={formatDate(price.last_sold_date)}
            />
            {price.num_for_sale > 0 && (
              <div style={{ padding: "8px 0 4px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", letterSpacing: "0.04em" }}>
                  {price.num_for_sale} for sale on Discogs
                </span>
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
          </>
        )}
      </div>
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
    <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "baseline" }}>
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", width: "84px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: "11px", color: "#0d0d0d", letterSpacing: "0.03em" }}>
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
  const spotifySearch = `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${album}`)}`;

  const baseLinkStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textDecoration: "none",
  };
  const linkStyle: React.CSSProperties = { ...baseLinkStyle, color: ORANGE };
  const secondaryLinkStyle: React.CSSProperties = { ...baseLinkStyle, color: "#555555" };

  return (
    <div>
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
              {discogsId && (
                <a href={`https://www.discogs.com/release/${discogsId}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  View on Discogs ↗
                </a>
              )}
              <a href={amSearch} target="_blank" rel="noopener noreferrer" style={secondaryLinkStyle}>
                Open in Apple Music ↗
              </a>
              <a href={tidalSearch} target="_blank" rel="noopener noreferrer" style={secondaryLinkStyle}>
                Open in Tidal ↗
              </a>
              <a href={spotifySearch} target="_blank" rel="noopener noreferrer" style={secondaryLinkStyle}>
                Open in Spotify ↗
              </a>
              {/* Bandcamp: link when no embed, omit when embed is showing (iframe is the link) */}
              {!bandcamp?.embedUrl && (
                <a href={bcSearch} target="_blank" rel="noopener noreferrer" style={secondaryLinkStyle}>
                  Search on Bandcamp ↗
                </a>
              )}
            </div>

            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#cccccc", marginTop: "10px" }}>
              Buying on Bandcamp pays artists directly
            </p>
          </div>
        </>
      )}
    </div>
  );
}
