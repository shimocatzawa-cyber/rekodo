"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { DigitalImport } from "@/app/digital/page";

const SERIF  = "var(--font-shippori), Georgia, serif";
const MONO   = "var(--font-dm-mono), 'Courier New', monospace";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const SUBTLE = "#999999";

type Sort = "artist-az" | "artist-za" | "album-az" | "album-za" | "purchased";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "artist-az",  label: "Artist A–Z" },
  { value: "artist-za",  label: "Artist Z–A" },
  { value: "album-az",   label: "Album A–Z" },
  { value: "album-za",   label: "Album Z–A" },
  { value: "purchased",  label: "Date bought" },
];

function fmtYear(imp: DigitalImport): string | null {
  if (!imp.release_date) return null;
  return imp.release_date.match(/\d{4}/)?.[0] ?? null;
}

// ── Cover art hook ─────────────────────────────────────────────────────────

const coverCache = new Map<string, string | null>();

function useCoverArt(artist: string, album: string, bandcampUrl?: string | null): string | null {
  const key = `${artist}::${album}`;
  const [url, setUrl] = useState<string | null>(coverCache.get(key) ?? null);

  useEffect(() => {
    if (coverCache.has(key)) { setUrl(coverCache.get(key) ?? null); return; }
    let cancelled = false;
    const params = new URLSearchParams({ artist, album });
    if (bandcampUrl) params.set("bandcampUrl", bandcampUrl);
    fetch(`/api/deep-dive/album-art?${params}`)
      .then(r => r.json() as Promise<{ url: string | null }>)
      .then(({ url: u }) => {
        coverCache.set(key, u);
        if (!cancelled) setUrl(u);
      })
      .catch(() => { coverCache.set(key, null); });
    return () => { cancelled = true; };
  }, [key, artist, album, bandcampUrl]);

  return url;
}

// ── Embed ID cache ─────────────────────────────────────────────────────────

type EmbedInfo = { id: number; type: "album" | "track" };
const embedCache = new Map<string, EmbedInfo | "error">();

// ── Album card ─────────────────────────────────────────────────────────────

function AlbumCard({ imp }: { imp: DigitalImport }) {
  const coverUrl = useCoverArt(imp.artist, imp.album, imp.item_url);
  const year = fmtYear(imp);

  const [embedState, setEmbedState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [embed, setEmbed]           = useState<EmbedInfo | null>(null);
  const [open, setOpen]             = useState(false);

  const canPlay = !!imp.item_url;

  async function handleArtworkClick() {
    if (!canPlay) return;

    if (open) { setOpen(false); return; }
    setOpen(true);

    if (embed) return; // already fetched

    const cached = embedCache.get(imp.item_url!);
    if (cached === "error") { setEmbedState("error"); return; }
    if (cached) { setEmbed(cached); setEmbedState("ready"); return; }

    setEmbedState("loading");
    try {
      const res = await fetch(`/api/digital/bandcamp-embed?url=${encodeURIComponent(imp.item_url!)}`);
      const d = await res.json() as EmbedInfo & { error?: string };
      if (res.ok && d.id) {
        embedCache.set(imp.item_url!, d);
        setEmbed(d);
        setEmbedState("ready");
      } else {
        embedCache.set(imp.item_url!, "error");
        setEmbedState("error");
      }
    } catch {
      embedCache.set(imp.item_url!, "error");
      setEmbedState("error");
    }
  }

  const embedSrc = embed
    ? `https://bandcamp.com/EmbeddedPlayer/${embed.type}=${embed.id}/size=small/bgcol=ffffff/linkcol=${encodeURIComponent(ORANGE)}/transparent=true/`
    : null;

  return (
    <div style={{ background: "#fff", border: `1px solid ${RULE}` }}>
      {/* Cover art — clickable if item_url available */}
      <div
        onClick={handleArtworkClick}
        style={{
          position: "relative", aspectRatio: "1 / 1", background: "#f0ede6", overflow: "hidden",
          cursor: canPlay ? "pointer" : "default",
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: "28px", color: "#c8c4bb" }}>ō</span>
          </div>
        )}

        {/* Play / collapse badge */}
        {canPlay && (
          <div style={{
            position: "absolute", bottom: "6px", right: "6px",
            background: open ? ORANGE : "rgba(0,0,0,0.45)",
            color: "#fff", fontFamily: MONO, fontSize: "9px",
            padding: "3px 6px", letterSpacing: "0.04em",
            transition: "background 0.15s",
          }}>
            {open ? "▲" : "▶"}
          </div>
        )}
      </div>

      {/* Bandcamp player */}
      {open && (
        <div style={{ borderTop: `1px solid ${RULE}` }}>
          {embedState === "loading" && (
            <div style={{ padding: "10px 10px", fontFamily: MONO, fontSize: "9px", color: SUBTLE, letterSpacing: "0.06em" }}>
              Loading…
            </div>
          )}
          {embedState === "error" && (
            <div style={{ padding: "10px 10px", fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>
              Not streamable —{" "}
              <a href={imp.item_url!} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE, textDecoration: "none" }}>
                open on Bandcamp ↗
              </a>
            </div>
          )}
          {embedState === "ready" && embedSrc && (
            <iframe
              src={embedSrc}
              seamless
              style={{ display: "block", width: "100%", height: "42px", border: 0 }}
              allow="autoplay"
              title={`${imp.artist} – ${imp.album}`}
            />
          )}
        </div>
      )}

      <div style={{ padding: "10px 10px 12px" }}>
        <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE, marginBottom: "3px" }}>
          {imp.artist}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: "13px", fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: "4px" }}>
          {imp.album}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {year && <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>{year}</span>}
          {(imp.tags ?? []).slice(0, 2).map(tag => (
            <span key={tag} style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.06em", textTransform: "uppercase", color: SUBTLE, background: "#f0ede6", padding: "1px 5px" }}>
              {tag}
            </span>
          ))}
        </div>
        {imp.item_url && (
          <a
            href={imp.item_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: "6px", fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}
          >
            Bandcamp ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  imports: DigitalImport[];
  hasBandcampUsername: boolean;
};

export default function DigitalClient({ imports, hasBandcampUsername }: Props) {
  const router = useRouter();
  const [query,      setQuery]      = useState("");
  const [filterTag,  setFilterTag]  = useState("");
  const [sortBy,     setSortBy]     = useState<Sort>("artist-az");
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSyncing(false); return; }
    const res = await fetch("/api/deep-dive/bandcamp-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const d = await res.json() as { total?: number; error?: string; message?: string };
    if (res.ok) {
      setSyncMsg(d.message ?? `${d.total ?? 0} albums imported`);
      router.refresh();
    } else {
      setSyncMsg(d.error ?? "Sync failed");
    }
    setSyncing(false);
  }

  // Sorted unique tags derived from all imports
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const imp of imports) {
      for (const tag of imp.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [imports]);

  const filtered = useMemo(() => {
    let result = imports;

    if (filterTag) result = result.filter(imp => imp.tags?.includes(filterTag));

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(imp =>
        imp.artist.toLowerCase().includes(q) || imp.album.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "artist-az":  return a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album);
        case "artist-za":  return b.artist.localeCompare(a.artist) || a.album.localeCompare(b.album);
        case "album-az":   return a.album.localeCompare(b.album);
        case "album-za":   return b.album.localeCompare(a.album);
        case "purchased":  return (b.purchased_at ?? "").localeCompare(a.purchased_at ?? "");
      }
    });
  }, [imports, filterTag, query, sortBy]);

  if (!hasBandcampUsername) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <h1 className="text-4xl mb-2 leading-tight" style={{ fontFamily: SERIF, color: INK }}>
            Connect Bandcamp
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em", marginBottom: "2rem" }}>
            Add your Bandcamp username in your profile settings to sync your digital collection.
          </p>
          <Link
            href="/settings/profile"
            style={{
              fontFamily: MONO, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase",
              background: "#0a0a0a", color: "#fff", textDecoration: "none",
              padding: "15px 28px", display: "inline-block",
            }}
          >
            Go to settings →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#ffffff", maxWidth: 1400, margin: "0 auto", padding: "1.5rem 2rem" }}>

      {/* Sync + search row */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px" }}>
        {imports.length > 0 && (
          <input
            type="search"
            placeholder="Search artist or album…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              fontFamily: MONO, fontSize: "11px", letterSpacing: "0.02em",
              padding: "5px 8px", border: "none",
              borderBottom: `1px solid ${query ? ORANGE : "rgba(0,0,0,0.1)"}`,
              background: "#f8f8f8", color: INK,
              width: "200px", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
            color: syncing ? "#aaaaaa" : ORANGE,
            background: "none", border: "none",
            cursor: syncing ? "default" : "pointer",
            padding: 0, flexShrink: 0,
          }}
        >
          {syncing ? "Syncing…" : "Sync with Bandcamp →"}
        </button>
        {syncMsg && (
          <span style={{ fontFamily: MONO, fontSize: "9px", color: SUBTLE }}>{syncMsg}</span>
        )}
        {imports.length > 0 && (
          <span style={{ fontFamily: MONO, fontSize: "9px", color: "#bbbbbb", letterSpacing: "0.04em", marginLeft: "auto" }}>
            {filtered.length !== imports.length
              ? `${filtered.length} of ${imports.length}`
              : imports.length}{" "}
            {imports.length === 1 ? "album" : "albums"}
          </span>
        )}
      </div>

      {/* Tag filter + sort */}
      {imports.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1.25rem", flexWrap: "wrap", borderBottom: "1px solid rgba(0,0,0,0.08)", paddingBottom: "10px" }}>

          {allTags.length > 0 && (
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
                color: filterTag ? ORANGE : "#888888",
                background: "#ffffff",
                border: `1px solid ${filterTag ? ORANGE : "rgba(0,0,0,0.13)"}`,
                cursor: "pointer", padding: "4px 6px", outline: "none",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              <option value="">Genre / Tag</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "4px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa" }}>
              Sort
            </span>
            {SORT_OPTIONS.map(o => {
              const active = sortBy === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => setSortBy(o.value)}
                  style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: active ? "#ffffff" : "#888888",
                    background: active ? "#0d0d0d" : "none",
                    border: `1px solid ${active ? "#0d0d0d" : "rgba(0,0,0,0.13)"}`,
                    borderRadius: "3px", cursor: "pointer", padding: "3px 8px",
                    whiteSpace: "nowrap", transition: "all 0.15s",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {(filterTag || query) && (
            <button
              onClick={() => { setFilterTag(""); setQuery(""); }}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
                color: ORANGE, background: "none", border: "none",
                cursor: "pointer", padding: 0, marginLeft: "4px",
              }}
            >
              Clear ×
            </button>
          )}
        </div>
      )}

      {imports.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: SUBTLE, marginBottom: "0.5rem" }}>
            No albums yet — hit <strong>Sync with Bandcamp →</strong> above to import your collection.
          </p>
          {syncMsg && <p style={{ fontFamily: MONO, fontSize: "10px", color: SUBTLE, marginTop: "1rem" }}>{syncMsg}</p>}
        </div>
      )}

      {imports.length > 0 && filtered.length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: "11px", color: SUBTLE, padding: "2rem 0" }}>
          No results — <button onClick={() => { setFilterTag(""); setQuery(""); }} style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}>clear filters</button>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1px",
          background: RULE,
          border: `1px solid ${RULE}`,
        }}>
          {filtered.map(imp => (
            <AlbumCard key={imp.id} imp={imp} />
          ))}
        </div>
      )}
    </div>
  );
}
