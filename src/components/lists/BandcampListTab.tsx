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
};

type Sort = "artist" | "album" | "imported";

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
      <a
        href={bcSearchUrl(item.artist, item.album)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none", flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = ORANGE; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = INK; }}
      >
        BC →
      </a>
    </div>
  );
}

export default function BandcampListTab() {
  const [items,   setItems]   = useState<Import[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [hasBc,   setHasBc]   = useState<boolean | null>(null);

  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<Sort>("artist");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("bandcamp_username")
        .eq("id", user.id)
        .single();
      setHasBc(!!profile?.bandcamp_username);

      const { data, error: fetchError } = await supabase
        .from("digital_imports")
        .select("id, artist, album, imported_at")
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
  }, [items, search, sort]);

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
              {items.length.toLocaleString()} albums
            </p>
            {importedDate && (
              <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: 0 }}>
                Last synced {importedDate}
              </p>
            )}
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
              border: "none", borderBottom: "1px solid rgba(0,0,0,0.12)",
              outline: "none", padding: "0 0 6px",
            }}
          />

          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#cccccc", flexShrink: 0 }}>Sort</span>
            {([
              { key: "artist"   as Sort, label: "Artist A–Z" },
              { key: "album"    as Sort, label: "Album A–Z" },
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
