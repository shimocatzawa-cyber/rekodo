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
  is_duplicate: boolean;
  imported_at: string;
};

type Filter = "all" | "digital_only" | "also_vinyl";
type Sort   = "artist" | "album" | "imported";

function bcSearchUrl(artist: string, album: string) {
  return `https://bandcamp.com/search?q=${encodeURIComponent(`${artist} ${album}`)}&item_type=a`;
}

function Row({ item }: { item: Import }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "11px 0", borderBottom: `1px solid ${RULE}`,
        background: hovered ? "#f7f5f0" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, margin: "0 0 2px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "0.85rem", fontStyle: "italic", color: INK, margin: 0, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.album}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        {item.is_duplicate && (
          <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", border: `1px solid ${RULE}`, padding: "1px 5px", whiteSpace: "nowrap" }}>
            On vinyl
          </span>
        )}
        <a
          href={bcSearchUrl(item.artist, item.album)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = ORANGE; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = INK; }}
        >
          BC →
        </a>
      </div>
    </div>
  );
}

export default function BandcampListTab() {
  const [items,    setItems]    = useState<Import[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [hasBc,    setHasBc]    = useState<boolean | null>(null);

  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<Filter>("all");
  const [sort,     setSort]     = useState<Sort>("artist");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }

      // Check if Bandcamp is connected
      const { data: profile } = await supabase
        .from("profiles")
        .select("bandcamp_username")
        .eq("id", user.id)
        .single();
      setHasBc(!!profile?.bandcamp_username);

      const { data, error: fetchError } = await supabase
        .from("digital_imports")
        .select("id, artist, album, is_duplicate, imported_at")
        .eq("user_id", user.id)
        .eq("source", "bandcamp")
        .order("artist", { ascending: true });

      if (fetchError) setError(fetchError.message);
      else setItems((data ?? []) as Import[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = items;

    if (filter === "digital_only") result = result.filter(i => !i.is_duplicate);
    if (filter === "also_vinyl")   result = result.filter(i => i.is_duplicate);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i =>
        i.artist.toLowerCase().includes(q) || i.album.toLowerCase().includes(q)
      );
    }

    if (sort === "artist")   result = [...result].sort((a, b) => a.artist.localeCompare(b.artist));
    if (sort === "album")    result = [...result].sort((a, b) => a.album.localeCompare(b.album));
    if (sort === "imported") result = [...result].sort((a, b) => b.imported_at.localeCompare(a.imported_at));

    return result;
  }, [items, filter, search, sort]);

  const totalCount   = items.length;
  const vinylCount   = items.filter(i => i.is_duplicate).length;
  const digitalOnly  = totalCount - vinylCount;

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all",          label: "All",           count: totalCount },
    { key: "digital_only", label: "Digital only",  count: digitalOnly },
    { key: "also_vinyl",   label: "Also on vinyl", count: vinylCount },
  ];

  const importedDate = items.length > 0
    ? new Date(items.reduce((l, i) => i.imported_at > l ? i.imported_at : l, items[0].imported_at))
        .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

      {loading && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}>Loading…</p>
      )}

      {!loading && error && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300" }}>{error}</p>
      )}

      {!loading && !error && hasBc === false && (
        <div style={{ paddingTop: "2rem" }}>
          <p style={{ fontFamily: SERIF, fontSize: "1rem", color: INK, lineHeight: 1.6, marginBottom: "1rem" }}>
            No Bandcamp account connected yet.
          </p>
          <Link
            href="/settings/profile"
            style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}
          >
            Add your Bandcamp username →
          </Link>
        </div>
      )}

      {!loading && !error && hasBc && items.length === 0 && (
        <div style={{ paddingTop: "2rem" }}>
          <p style={{ fontFamily: SERIF, fontSize: "1rem", color: INK, lineHeight: 1.6, marginBottom: "1rem" }}>
            No Bandcamp imports yet.
          </p>
          <Link
            href="/deep-dive"
            style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}
          >
            Sync your Bandcamp collection →
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Stats row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
            <p style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 600, color: INK, margin: 0 }}>
              {totalCount.toLocaleString()} albums
            </p>
            {importedDate && (
              <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: 0 }}>
                Last synced {importedDate}
              </p>
            )}
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
            {FILTERS.map(({ key, label, count }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.07em",
                    color: active ? "#ffffff" : "#888888",
                    background: active ? INK : "none",
                    border: `1px solid ${active ? INK : RULE}`,
                    borderRadius: "2px", cursor: "pointer",
                    padding: "4px 10px", transition: "all 0.15s",
                  }}
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>

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
              border: "none", borderBottom: `1px solid rgba(0,0,0,0.12)`,
              outline: "none", padding: "0 0 6px",
            }}
          />

          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", flexShrink: 0 }}>Sort</span>
            {([
              { key: "artist" as Sort,   label: "Artist A–Z" },
              { key: "album" as Sort,    label: "Album A–Z" },
              { key: "imported" as Sort, label: "Date imported" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.05em",
                  color: sort === key ? INK : "#aaaaaa",
                  background: "none", border: "none", cursor: "pointer", padding: "0 0 2px",
                  borderBottom: `1px solid ${sort === key ? INK : "transparent"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#aaaaaa", padding: "2rem 0" }}>
              No results.
            </p>
          ) : (
            <div style={{ borderTop: `1px solid ${RULE}` }}>
              {filtered.map(item => <Row key={item.id} item={item} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
