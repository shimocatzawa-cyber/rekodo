"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0a0a0a";

type Import = {
  id: string;
  artist: string;
  album: string;
  imported_at: string;
  purchased_at: string | null;
  item_url: string | null;
  release_date: string | null;
  label: string | null;
  tags: string[] | null;
};

type Sort = "purchased" | "artist" | "album" | "release";

// ── Helpers ───────────────────────────────────────────────────────────────────

function topN<T extends string>(arr: T[], n: number): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function purchaseYear(iso: string | null): number | null {
  if (!iso) return null;
  const y = new Date(iso).getFullYear();
  return isNaN(y) ? null : y;
}

function formatPurchaseDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({ item, activeTag, onTagClick }: {
  item: Import;
  activeTag: string | null;
  onTagClick: (tag: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const href = item.item_url ?? `https://bandcamp.com/search?q=${encodeURIComponent(`${item.artist} ${item.album}`)}&item_type=a`;
  const purchaseDate = formatPurchaseDate(item.purchased_at);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: "14px",
        padding: "12px 0", borderBottom: `1px solid ${RULE}`,
        background: hovered ? "#f7f5f0" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, margin: "0 0 2px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "0.85rem", fontStyle: "italic", color: INK, margin: "0 0 5px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.album}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {item.label && (
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>
              {item.label}
            </span>
          )}
          {item.label && item.release_date && (
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "#ccc" }}>·</span>
          )}
          {item.release_date && (
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: "#aaa" }}>
              {item.release_date.slice(0, 4)}
            </span>
          )}
          {purchaseDate && (
            <>
              <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "#ccc" }}>·</span>
              <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: "#bbb" }}>
                Bought {purchaseDate}
              </span>
            </>
          )}
        </div>
        {item.tags && item.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px" }}>
            {item.tags.slice(0, 6).map(tag => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                style={{
                  fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.07em",
                  textTransform: "lowercase", padding: "1px 5px",
                  border: `1px solid ${activeTag === tag ? ORANGE : RULE}`,
                  color: activeTag === tag ? ORANGE : "#aaa",
                  background: "none", cursor: "pointer",
                  borderRadius: "2px", transition: "all 0.1s",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none", flexShrink: 0, paddingTop: "2px" }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = ORANGE; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = INK; }}
      >
        BC →
      </a>
    </div>
  );
}

// ── Insights panel ────────────────────────────────────────────────────────────

function InsightsPanel({ items, activeTag, activeLabel, onTagClick, onLabelClick }: {
  items: Import[];
  activeTag: string | null;
  activeLabel: string | null;
  onTagClick: (tag: string | null) => void;
  onLabelClick: (label: string | null) => void;
}) {
  const topTags = useMemo(() => {
    const all = items.flatMap(i => i.tags ?? []);
    return topN(all, 20);
  }, [items]);

  const topLabels = useMemo(() => {
    const all = items.map(i => i.label).filter(Boolean) as string[];
    return topN(all, 10);
  }, [items]);

  const byYear = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      const y = purchaseYear(item.purchased_at);
      if (y) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
  }, [items]);

  const maxYearCount = byYear.reduce((m, [, c]) => Math.max(m, c), 1);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.05em",
    background: "none", border: "none", padding: "2px 0",
    textAlign: "left", cursor: active ? "default" : "pointer",
    color: active ? ORANGE : INK,
    borderBottom: active ? `1px solid ${ORANGE}` : "1px solid transparent",
    width: "fit-content", transition: "color 0.1s",
    display: "flex", justifyContent: "space-between", gap: "6px",
  });

  return (
    <div style={{ width: 160, flexShrink: 0, paddingTop: 4, display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Tags */}
      {topTags.length > 0 && (
        <div>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px" }}>
            Genre / Tags
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {activeTag && (
              <button onClick={() => onTagClick(null)} style={{ ...btnStyle(false), color: ORANGE, fontSize: "9px", letterSpacing: "0.08em" }}>
                ← All tags
              </button>
            )}
            {topTags.map(({ value, count }) => (
              <button key={value} onClick={() => onTagClick(activeTag === value ? null : value)} style={btnStyle(activeTag === value)}>
                <span>{value}</span>
                <span style={{ color: "#888", fontSize: "9px" }}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Labels */}
      {topLabels.length > 0 && (
        <div>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px" }}>
            Labels
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {activeLabel && (
              <button onClick={() => onLabelClick(null)} style={{ ...btnStyle(false), color: ORANGE, fontSize: "9px", letterSpacing: "0.08em" }}>
                ← All labels
              </button>
            )}
            {topLabels.map(({ value, count }) => (
              <button key={value} onClick={() => onLabelClick(activeLabel === value ? null : value)} style={btnStyle(activeLabel === value)}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{value}</span>
                <span style={{ color: "#ccc", fontSize: "9px", flexShrink: 0 }}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* By year */}
      {byYear.length > 0 && (
        <div>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px" }}>
            By year purchased
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byYear.map(([year, count]) => (
              <div key={year} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontFamily: MONO, fontSize: "9px", color: INK, width: 30, flexShrink: 0 }}>{year}</span>
                <div style={{ flex: 1, height: 3, background: RULE, borderRadius: 1 }}>
                  <div style={{ width: `${(count / maxYearCount) * 100}%`, height: "100%", background: ORANGE, borderRadius: 1 }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: "9px", color: "#666", width: 20, textAlign: "right", flexShrink: 0 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BandcampListTab() {
  const [items,   setItems]   = useState<Import[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [hasBc,   setHasBc]   = useState<boolean | null>(null);

  const [search,      setSearch]      = useState("");
  const [sort,        setSort]        = useState<Sort>("purchased");
  const [activeTag,   setActiveTag]   = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [syncing,     setSyncing]     = useState(false);
  const [syncError,   setSyncError]   = useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setSyncError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSyncing(false); return; }
    try {
      const res  = await fetch("/api/deep-dive/bandcamp-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json() as { success?: boolean; error?: string; total?: number };
      if (!res.ok || json.error) {
        setSyncError(json.error ?? "Sync failed. Please try again.");
      } else {
        // Reload fresh data
        const { data } = await supabase
          .from("digital_imports")
          .select("id, artist, album, imported_at, purchased_at, item_url, release_date, label, tags")
          .eq("user_id", user.id)
          .eq("source", "bandcamp")
          .order("purchased_at", { ascending: false, nullsFirst: false });
        setItems((data ?? []) as Import[]);
      }
    } catch {
      setSyncError("Network error. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("bandcamp_username").eq("id", user.id).single();
      setHasBc(!!profile?.bandcamp_username);

      const { data, error: fetchError } = await supabase
        .from("digital_imports")
        .select("id, artist, album, imported_at, purchased_at, item_url, release_date, label, tags")
        .eq("user_id", user.id)
        .eq("source", "bandcamp")
        .order("purchased_at", { ascending: false, nullsFirst: false });

      if (fetchError) setError(fetchError.message);
      else setItems((data ?? []) as Import[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = items;

    if (activeTag)   result = result.filter(i => i.tags?.includes(activeTag));
    if (activeLabel) result = result.filter(i => i.label === activeLabel);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i =>
        i.artist.toLowerCase().includes(q) || i.album.toLowerCase().includes(q)
      );
    }

    if (sort === "purchased") result = [...result].sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));
    if (sort === "artist")    result = [...result].sort((a, b) => a.artist.localeCompare(b.artist));
    if (sort === "album")     result = [...result].sort((a, b) => a.album.localeCompare(b.album));
    if (sort === "release")   result = [...result].sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));

    return result;
  }, [items, activeTag, activeLabel, search, sort]);

  const syncDate = items.length > 0
    ? new Date(items.reduce((l, i) => i.imported_at > l ? i.imported_at : l, items[0].imported_at))
        .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const hasInsights = items.some(i => (i.tags && i.tags.length > 0) || i.label || i.purchased_at);

  const mobileTopTags   = useMemo(() => topN(items.flatMap(i => i.tags ?? []), 12), [items]);
  const mobileTopLabels = useMemo(() => topN(items.map(i => i.label).filter(Boolean) as string[], 8), [items]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <style>{`
        @media (max-width: 767px) {
          .bc-insights-panel { display: none !important; }
          .bc-mobile-filters { display: flex !important; }
        }
        @media (min-width: 768px) {
          .bc-mobile-filters { display: none !important; }
        }
        .bc-mobile-filters::-webkit-scrollbar { display: none; }
      `}</style>

      {loading && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}>Loading…</p>
      )}

      {!loading && error && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300" }}>{error}</p>
      )}

      {!loading && !error && hasBc === false && (
        <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center", padding: "0 1.5rem" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "16px" }}>
            Bandcamp not connected
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "1.4rem", fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: "12px" }}>
            Connect your Bandcamp account to see your digital collection here.
          </p>
          <p style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: "#888888", lineHeight: 1.8, marginBottom: "32px" }}>
            Add your Bandcamp username in profile settings and rekōdo will sync your purchases — genre tags, labels, and purchase history included.
          </p>
          <Link
            href="/settings/profile"
            style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#ffffff", background: INK, textDecoration: "none",
              padding: "12px 28px", display: "inline-block",
            }}
          >
            Go to profile settings →
          </Link>
        </div>
      )}

      {!loading && !error && hasBc && items.length === 0 && (
        <div style={{ paddingTop: "2rem" }}>
          <p style={{ fontFamily: SERIF, fontSize: "1rem", color: INK, lineHeight: 1.6, marginBottom: "1rem" }}>
            No Bandcamp imports yet.
          </p>
          <Link href="/deep-dive" style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}>
            Sync your Bandcamp collection →
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>

          {/* Insights panel — desktop only */}
          {hasInsights && (
            <div className="bc-insights-panel" style={{ position: "sticky", top: "80px", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
              <InsightsPanel
                items={items}
                activeTag={activeTag}
                activeLabel={activeLabel}
                onTagClick={setActiveTag}
                onLabelClick={setActiveLabel}
              />
            </div>
          )}

          {/* Main list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mobile filter strip */}
            {hasInsights && (
              <div className="bc-mobile-filters" style={{ gap: "6px", overflowX: "auto", marginBottom: "14px", paddingBottom: "2px" }}>
                {mobileTopTags.map(({ value }) => (
                  <button key={value} onClick={() => setActiveTag(prev => prev === value ? null : value)} style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.07em", flexShrink: 0,
                    color: activeTag === value ? "#fff" : INK,
                    background: activeTag === value ? ORANGE : "none",
                    border: `1px solid ${activeTag === value ? ORANGE : RULE}`,
                    borderRadius: "2px", cursor: "pointer", padding: "3px 8px",
                  }}>{value}</button>
                ))}
                {mobileTopLabels.map(({ value }) => (
                  <button key={value} onClick={() => setActiveLabel(prev => prev === value ? null : value)} style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.07em", flexShrink: 0,
                    color: activeLabel === value ? "#fff" : INK,
                    background: activeLabel === value ? INK : "none",
                    border: `1px solid ${activeLabel === value ? INK : RULE}`,
                    borderRadius: "2px", cursor: "pointer", padding: "3px 8px",
                  }}>{value}</button>
                ))}
              </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 600, color: INK, margin: "0 0 10px" }}>
                {activeTag || activeLabel
                  ? `${filtered.length} of ${items.length.toLocaleString()} items in your digital collection`
                  : `${items.length.toLocaleString()} items in your digital collection`}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <button
                  onClick={runSync}
                  disabled={syncing}
                  style={{
                    fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase",
                    color: syncing ? "#aaaaaa" : INK, background: "transparent",
                    border: `1px solid ${syncing ? "#dddddd" : RULE}`,
                    padding: "5px 12px", cursor: syncing ? "default" : "pointer",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => { if (!syncing) { (e.currentTarget as HTMLButtonElement).style.color = ORANGE; (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = syncing ? "#aaaaaa" : INK; (e.currentTarget as HTMLButtonElement).style.borderColor = syncing ? "#dddddd" : RULE; }}
                >
                  {syncing ? "Syncing…" : "Sync with Bandcamp →"}
                </button>
                {syncDate && (
                  <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: 0 }}>
                    Last synced {syncDate}
                  </p>
                )}
                {syncError && (
                  <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#cc3300", margin: 0 }}>{syncError}</p>
                )}
              </div>
            </div>

            {/* Active filter pills */}
            {(activeTag || activeLabel) && (
              <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
                {activeTag && (
                  <button onClick={() => setActiveTag(null)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.07em", color: ORANGE, border: `1px solid ${ORANGE}`, background: "none", cursor: "pointer", padding: "2px 7px", borderRadius: "2px" }}>
                    {activeTag} ×
                  </button>
                )}
                {activeLabel && (
                  <button onClick={() => setActiveLabel(null)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.07em", color: ORANGE, border: `1px solid ${ORANGE}`, background: "none", cursor: "pointer", padding: "2px 7px", borderRadius: "2px" }}>
                    {activeLabel} ×
                  </button>
                )}
              </div>
            )}

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search artist or album…"
              style={{
                width: "100%", boxSizing: "border-box", marginBottom: "12px",
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                color: "#333", background: "transparent",
                border: "none", borderBottom: "1px solid rgba(0,0,0,0.12)",
                outline: "none", padding: "0 0 6px",
              }}
            />

            {/* Sort */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", flexShrink: 0 }}>Sort</span>
              {([
                { key: "purchased" as Sort, label: "Date bought" },
                { key: "artist"    as Sort, label: "Artist A–Z" },
                { key: "album"     as Sort, label: "Album A–Z" },
                { key: "release"   as Sort, label: "Release year" },
              ]).map(({ key, label }) => (
                <button key={key} onClick={() => setSort(key)} style={{
                  fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.05em",
                  color: sort === key ? INK : "#aaaaaa",
                  background: "none", border: "none", cursor: "pointer", padding: "0 0 2px",
                  borderBottom: `1px solid ${sort === key ? INK : "transparent"}`,
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#aaaaaa", padding: "2rem 0" }}>No results.</p>
            ) : (
              <div style={{ borderTop: `1px solid ${RULE}` }}>
                {filtered.map(item => (
                  <Row key={item.id} item={item} activeTag={activeTag} onTagClick={t => setActiveTag(prev => prev === t ? null : t)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
