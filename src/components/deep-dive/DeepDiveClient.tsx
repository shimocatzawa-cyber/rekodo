"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import ArtistPlayer from "@/components/deep-dive/ArtistPlayer";
import { useUrlTab } from "@/lib/useUrlTab";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const WARM   = "#FDF6F0";
const SUBTLE = "#f0efea";

type Section = "rankings" | "podcasts" | "books" | "interviews" | "related" | "blindspot";

export type ArtistData = {
  name: string;
  count: number;
  wantlistCount?: number;
  wantlistRecords?: { album: string; year: number | null; cover_url: string | null; source?: string }[];
  fromBandcamp?: boolean;
  records: { album: string; year: number | null; cover_url: string | null; source?: string }[];
};

function BandcampIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      aria-label="Imported from Bandcamp" role="img"
      fill="#1DA0C3"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M0 18.75l7.4373-13.5H24l-7.4373 13.5z" />
    </svg>
  );
}

const TABS: { id: Section; label: string }[] = [
  { id: "rankings",   label: "Essential Albums" },
  { id: "podcasts",   label: "Podcasts" },
  { id: "books",      label: "Books & Audiobooks" },
  { id: "interviews", label: "Interviews" },
  { id: "related",    label: "Related Artists" },
  { id: "blindspot",  label: "Blind Spot" },
];

// ── Shared primitives ──────────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: MONO,
      fontSize: "0.55rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: ORANGE,
      background: WARM,
      border: `1px solid ${ORANGE}`,
      padding: "0.1rem 0.4rem",
      display: "inline-block",
    }}>
      {label}
    </span>
  );
}

function ArtistInitial({ name, size }: { name: string; size: number }) {
  return (
    <div style={{
      width: size, height: size,
      background: WARM,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: MONO,
        fontSize: `${Math.round(size * 0.38)}px`,
        color: ORANGE,
        fontWeight: 600,
        lineHeight: 1,
      }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={{ padding: "2rem 0" }}>
      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.7rem",
        letterSpacing: "0.06em",
        color: "#999999",
        margin: 0,
      }}>
        Rekōdo is thinking
        <span className="thinking-dot">.</span>
        <span className="thinking-dot">.</span>
        <span className="thinking-dot">.</span>
      </p>
      <style>{`
        @keyframes thinking-dot-pulse {
          0%, 66%, 100% { opacity: 0.2; }
          33%            { opacity: 1; }
        }
        .thinking-dot { display: inline-block; }
        .thinking-dot:nth-child(1) { animation: thinking-dot-pulse 1.2s ease-in-out infinite 0s; }
        .thinking-dot:nth-child(2) { animation: thinking-dot-pulse 1.2s ease-in-out infinite 0.4s; }
        .thinking-dot:nth-child(3) { animation: thinking-dot-pulse 1.2s ease-in-out infinite 0.8s; }
      `}</style>
    </div>
  );
}

// ── Tab content renderers ──────────────────────────────────────────────────────

type Album = { rank: number; title: string; year: number; review: string; collectorNote: string };

function RankingsContent({ data }: { data: { albums?: Album[] } }) {
  const albums = data.albums ?? [];
  if (albums.length === 0) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, padding: "2rem 0" }}>
        No information available for this artist.
      </p>
    );
  }
  return (
    <div>
      {albums.map((a) => (
        <div key={a.rank} style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <span style={{ fontFamily: MONO, fontSize: "1.4rem", fontWeight: 500, color: ORANGE, lineHeight: 1, minWidth: 42, flexShrink: 0 }}>
              {String(a.rank).padStart(2, "0")}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
                  {a.title}
                </span>
                <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: INK }}>
                  · {a.year}
                </span>
              </div>
              <div style={{ borderTop: `1px solid ${RULE}`, margin: "0 0 10px" }} />
              <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, lineHeight: 1.7, margin: "0 0 10px" }}>
                {a.review}
              </p>
              <div style={{ borderTop: `1px solid ${RULE}`, margin: "0 0 10px" }} />
              <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: INK, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                {a.collectorNote}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type Episode = { show: string; episode: string; year: number; type: string; note: string };

function PodcastsContent({ data, artist }: { data: { episodes?: Episode[] }; artist: string }) {
  // Sort episodes by year descending, cap at 10
  const eps = [...(data.episodes ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 10);

  // Apple Podcasts: episode-level lookup via iTunes, falls back to show then search
  const [appleUrls, setAppleUrls] = useState<Record<number, string>>({});
  // Spotify: episode lookup via server route (client credentials, hides secret)
  const [spotifyUrls, setSpotifyUrls] = useState<Record<number, string>>({});

  const epsKey = eps.map((e, i) => `${i}:${e.show}:${e.episode}`).join("|");

  useEffect(() => {
    if (eps.length === 0) return;
    let cancelled = false;

    // Apple Podcasts — two-step iTunes lookup:
    // 1. Resolve each unique show name → collectionId + show URL (batched, one req per show)
    // 2. Fetch up to 200 episodes for each show via /lookup, fuzzy-match episode title
    // Falls back to the show page when no episode match is found.
    (async () => {
      try {
        // Step 1: resolve unique shows
        const uniqueShows = [...new Set(eps.map((e) => e.show))];
        type ShowMeta = { collectionId: number; showUrl: string };
        const showMeta: Record<string, ShowMeta> = {};
        await Promise.all(
          uniqueShows.map(async (show) => {
            try {
              const res = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(show)}&media=podcast&entity=podcast&limit=1`
              );
              if (!res.ok) return;
              const json = await res.json() as { results?: { collectionId?: number; collectionViewUrl?: string }[] };
              const r = json.results?.[0];
              if (r?.collectionId && r.collectionViewUrl) {
                showMeta[show] = { collectionId: r.collectionId, showUrl: r.collectionViewUrl };
              }
            } catch { /* skip */ }
          })
        );

        // Step 2: fetch episodes for each resolved show
        type EpMeta = { trackName?: string; trackViewUrl?: string };
        const showEps: Record<string, EpMeta[]> = {};
        await Promise.all(
          Object.entries(showMeta).map(async ([show, { collectionId }]) => {
            try {
              const res = await fetch(
                `https://itunes.apple.com/lookup?id=${collectionId}&entity=podcastEpisode&limit=200`
              );
              if (!res.ok) return;
              const json = await res.json() as { results?: EpMeta[] };
              // first result is the show itself — skip it
              showEps[show] = json.results?.slice(1) ?? [];
            } catch { /* skip */ }
          })
        );

        if (cancelled) return;

        // Step 3: match each episode by title (fuzzy — handles slight wording differences)
        const map: Record<number, string> = {};
        eps.forEach((ep, i) => {
          const candidates = showEps[ep.show] ?? [];
          const target = ep.episode.toLowerCase();
          const slug = target.slice(0, 40);
          const matched = candidates.find((c) => {
            const name = (c.trackName ?? "").toLowerCase();
            return name.includes(slug) || target.includes(name.slice(0, 40));
          });
          const url = matched?.trackViewUrl ?? showMeta[ep.show]?.showUrl;
          if (url) map[i] = url;
        });
        setAppleUrls(map);
      } catch { /* silent */ }
    })();

    // Spotify — server-side route to keep client secret hidden
    fetch("/api/deep-dive/podcast-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodes: eps.map((e) => ({ show: e.show, episode: e.episode })) }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { urls?: Record<number, string> } | null) => {
        if (!cancelled && d?.urls) setSpotifyUrls(d.urls);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epsKey]);

  const appleHref = (i: number, ep: Episode) =>
    appleUrls[i] ?? `https://podcasts.apple.com/search?term=${encodeURIComponent(`${ep.show} ${ep.episode}`)}`;

  const linkStyle = { fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", color: ORANGE, textDecoration: "none" };
  const hoverOn  = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.textDecoration = "underline"; };
  const hoverOff = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.textDecoration = "none"; };

  return (
    <div>
      {eps.map((ep, i) => (
        <div key={i} style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
          <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 600, color: INK, margin: "0 0 6px" }}>
            {ep.show}
          </p>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 8px" }}>
            {ep.episode}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em", color: INK }}>{ep.year}</span>
            <Badge label={ep.type} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: INK, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 8px" }}>
            {ep.note}
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href={appleHref(i, ep)} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              Apple Podcasts →
            </a>
            {spotifyUrls[i] && (
              <a href={spotifyUrls[i]} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                Spotify →
              </a>
            )}
          </div>
        </div>
      ))}
      {eps.length === 0 && (
        <div style={{ padding: "2rem 0" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 10px" }}>
            No documented episodes found.
          </p>
          <a
            href={`https://podcasts.apple.com/search?term=${encodeURIComponent(artist)}`}
            target="_blank" rel="noopener noreferrer"
            style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            Search Apple Podcasts →
          </a>
        </div>
      )}
    </div>
  );
}

type BookItem = { title: string; author: string; year: number; type: string; format: string; isbn13?: string; note: string; written_by_artist?: boolean };

function BooksContent({ data }: { data: { items?: BookItem[] } }) {
  // Sort by year ascending (oldest first), preserving written_by_artist grouping
  const raw = data.items ?? [];
  const byArtist = [...raw.filter(b => b.written_by_artist === true)].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const about    = [...raw.filter(b => b.written_by_artist !== true)].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const items = [...byArtist, ...about];

  if (items.length === 0) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, padding: "2rem 0" }}>
        No information available for this artist.
      </p>
    );
  }

  const firstAboutIndex = byArtist.length > 0 ? byArtist.length : -1;

  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;

  function amazonHref(b: BookItem) {
    // field-isbn targets Amazon's book ISBN index directly (much more reliable than k=ISBN).
    // OneLink (loaded in layout) rewrites amazon.com links to each visitor's local store.
    // PA API will replace this with a direct /dp/ASIN URL once credentials are available.
    if (b.isbn13) {
      const base = `https://www.amazon.com/s?field-isbn=${encodeURIComponent(b.isbn13)}&search-alias=books`;
      return tag ? `${base}&tag=${tag}` : base;
    }
    const q = encodeURIComponent(`${b.title} ${b.author}`);
    return tag ? `https://www.amazon.com/s?k=${q}&search-alias=books&tag=${tag}` : `https://www.amazon.com/s?k=${q}&search-alias=books`;
  }

  function audibleHref(b: BookItem) {
    // Audible uses its own ASIN system — ISBN lookup doesn't map. Title+author is more reliable.
    // OneLink handles regional routing (audible.co.uk, audible.com.au, etc.) via the layout script.
    const q = encodeURIComponent(`${b.title} ${b.author}`);
    return `https://www.audible.com/search?keywords=${q}`;
  }

  const hasAudiobook = (b: BookItem) => b.format === "audiobook" || b.format === "both";

  const linkStyle = { fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", color: ORANGE, textDecoration: "none" };
  const hoverOn  = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.textDecoration = "underline"; };
  const hoverOff = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.textDecoration = "none"; };

  return (
    <div>
      {items.map((b, i) => (
        <div key={i}>
          {i === firstAboutIndex && (
            <div style={{ margin: "0.5rem 0 1.25rem" }}>
              <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "0.75rem" }} />
              <p style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.14em", textTransform: "uppercase", color: INK, margin: 0 }}>
                ABOUT THE ARTIST
              </p>
            </div>
          )}
          <div style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
            {b.written_by_artist === true && (
              <p style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 0.3rem 0" }}>
                BY THE ARTIST
              </p>
            )}
            <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 600, color: INK, margin: "0 0 4px" }}>
              {b.title}
            </p>
            <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 8px" }}>
              {b.author} · {b.year}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <Badge label={b.type} />
              <Badge label={b.format} />
            </div>
            <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: INK, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 8px" }}>
              {b.note}
            </p>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {b.format !== "audiobook" && (
                <a href={amazonHref(b)} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  Buy on Amazon →
                </a>
              )}
              {hasAudiobook(b) && (
                <a href={audibleHref(b)} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  Listen on Audible →
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type InterviewItem = { publication: string; domain?: string; title: string; year: number; date?: string; note: string; url?: string };

function interviewHref(iv: InterviewItem, artist: string): { href: string; direct: boolean } {
  if (iv.url?.startsWith("https://")) return { href: iv.url, direct: true };
  // Domain-scoped search is a better fallback than a generic query
  if (iv.domain) {
    const q = encodeURIComponent(`${artist} ${iv.title} site:${iv.domain}`);
    return { href: `https://www.google.com/search?q=${q}`, direct: false };
  }
  const q = encodeURIComponent(`"${artist}" "${iv.title}" interview`);
  return { href: `https://www.google.com/search?q=${q}`, direct: false };
}

function InterviewsContent({ data, artist }: { data: { interviews?: InterviewItem[] }; artist: string }) {
  // Sort by date desc (YYYY-MM or YYYY-MM-DD) when available, fall back to year
  const items = [...(data.interviews ?? [])]
    .sort((a, b) => {
      const aKey = a.date ?? String(a.year ?? 0);
      const bKey = b.date ?? String(b.year ?? 0);
      return bKey.localeCompare(aKey);
    })
    .slice(0, 10);

  const linkStyle = { fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", color: ORANGE, textDecoration: "none" };
  const hoverOn  = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.textDecoration = "underline"; };
  const hoverOff = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.textDecoration = "none"; };

  if (items.length === 0) {
    return (
      <div style={{ padding: "2rem 0" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 10px" }}>
          No documented interviews found.
        </p>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`"${artist}" interview`)}`}
          target="_blank" rel="noopener noreferrer"
          style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          Search the web →
        </a>
      </div>
    );
  }

  return (
    <div>
      {items.map((iv, i) => {
        const { href, direct } = interviewHref(iv, artist);
        return (
          <div key={i} style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
            <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 600, color: INK, margin: "0 0 6px" }}>
              {iv.publication}
            </p>
            <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, margin: "0 0 8px" }}>
              {iv.title}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em", color: INK }}>{iv.year}</span>
            </div>
            <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: INK, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 8px" }}>
              {iv.note}
            </p>
            <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              {direct ? "Read article →" : "Find article →"}
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ── Collection strip (artwork tiles above tabs) ────────────────────────────────

function VinylFallback({ size = 80 }: { size?: number }) {
  const svgSize = Math.round(size * 0.44);
  return (
    <div style={{ width: size, height: size, background: WARM, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={svgSize} height={svgSize} viewBox="0 0 34 34" fill="none" aria-hidden>
        <circle cx="17" cy="17" r="15" stroke={ORANGE} strokeWidth="1.5" />
        <circle cx="17" cy="17" r="5" stroke={ORANGE} strokeWidth="1.5" />
        <circle cx="17" cy="17" r="1.5" fill={ORANGE} />
      </svg>
    </div>
  );
}

function CollectionStrip({ records, wantlistRecords = [], artist, tileSize = 80 }: { records: ArtistData["records"]; wantlistRecords?: ArtistData["wantlistRecords"]; artist: string; tileSize?: number }) {
  const wl = wantlistRecords ?? [];
  return (
    <div>
      <style>{`.dd-strip::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="dd-strip"
        style={{ display: "flex", overflowX: "auto", gap: "0.5rem", paddingBottom: "0.25rem", scrollbarWidth: "none" as const, alignItems: "flex-start" }}
      >
        {records.map((r, i) => (
          <div key={i} style={{ flexShrink: 0, width: tileSize }}>
            {r.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.cover_url}
                alt={r.album}
                style={{ width: tileSize, height: tileSize, objectFit: "cover", display: "block" }}
              />
            ) : (
              <VinylFallback size={tileSize} />
            )}
            <p style={{
              fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.04em", color: INK,
              margin: "3px 0 1px", lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {r.album}
            </p>
            {r.year && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.04em", color: "#aaaaaa", margin: 0 }}>
                {r.year}
              </p>
            )}
            {r.source === "bandcamp" && (
              <div style={{ marginTop: 3 }}>
                <BandcampIcon size={10} />
              </div>
            )}
          </div>
        ))}

        {wl.length > 0 && records.length > 0 && (
          <div style={{ flexShrink: 0, width: 1, background: "#d0cdc8", alignSelf: "stretch", margin: "0 4px" }} />
        )}

        {wl.map((r, i) => (
          <div key={`wl-${i}`} style={{ flexShrink: 0, width: tileSize, opacity: 0.85 }}>
            {r.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.cover_url}
                alt={r.album}
                style={{ width: tileSize, height: tileSize, objectFit: "cover", display: "block" }}
              />
            ) : (
              <VinylFallback size={tileSize} />
            )}
            <p style={{
              fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.04em", color: "#aaaaaa",
              margin: "3px 0 1px", lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {r.album}
            </p>
            {r.year && (
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.04em", color: "#cccccc", margin: 0 }}>
                {r.year}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Related Artists ────────────────────────────────────────────────────────────

type RelatedArtist = { name: string; genre: string; reason: string; mustHear: string };

function RelatedArtistsContent({ data }: { data: { artists?: RelatedArtist[] } }) {
  const related = data.artists ?? [];
  if (related.length === 0) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, padding: "2rem 0" }}>
        No information available for this artist.
      </p>
    );
  }
  return (
    <div>
      {related.map((a, i) => (
        <div key={i} style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
              {a.name}
            </span>
            <Badge label={a.genre} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, lineHeight: 1.7, margin: "0 0 8px" }}>
            {a.reason}
          </p>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: INK, fontStyle: "italic", margin: 0 }}>
            Start with: <span style={{ fontStyle: "normal" }}>{a.mustHear}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Blind Spot ─────────────────────────────────────────────────────────────────

type BlindSpotAlbum = { title: string; year: number; why: string; tip: string };

function BlindSpotContent({ data, artist }: { data: { albums?: BlindSpotAlbum[] }; artist: string }) {
  const albums = data.albums ?? [];
  const [artMap, setArtMap] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const a of albums) {
      fetch(`/api/deep-dive/album-art?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(a.title)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { url?: string } | null) => {
          if (d?.url) setArtMap((prev) => ({ ...prev, [a.title]: d.url! }));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist, albums.length]);

  if (albums.length === 0) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, padding: "2rem 0" }}>
        No significant gaps found — your collection covers the essential releases.
      </p>
    );
  }
  return (
    <div>
      {albums.map((a, i) => (
        <div key={i} style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
          {/* Title row with artwork */}
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 10 }}>
            {artMap[a.title] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artMap[a.title]} alt="" aria-hidden style={{ width: 64, height: 64, objectFit: "cover", flexShrink: 0, display: "block" }} />
            ) : (
              <VinylFallback size={64} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
                  {a.title}
                </span>
                <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: INK }}>
                  · {a.year}
                </span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, lineHeight: 1.7, margin: 0 }}>
                {a.why}
              </p>
            </div>
          </div>
          {a.tip && (
            <>
              <div style={{ borderTop: `1px solid ${RULE}`, margin: "0 0 10px" }} />
              <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.04em", color: INK, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                {a.tip}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Artist row (sidebar) ───────────────────────────────────────────────────────

function ArtistRow({
  artist,
  isSelected,
  imageUrl,
  onSelect,
}: {
  artist: ArtistData;
  isSelected: boolean;
  imageUrl: string | undefined;
  onSelect: (name: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(artist.name)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(artist.name); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: isSelected ? "0.6rem calc(1rem - 2px)" : "0.6rem 1rem",
        borderBottom: `1px solid ${SUBTLE}`,
        borderLeft: isSelected ? `2px solid ${ORANGE}` : "2px solid transparent",
        background: isSelected ? WARM : "#ffffff",
        cursor: "pointer",
        minHeight: 64,
        userSelect: "none",
      }}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = WARM; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0, display: "block" }}
        />
      ) : (
        <ArtistInitial name={artist.name} size={40} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <p style={{ fontFamily: SERIF, fontSize: "0.85rem", fontWeight: 600, color: INK, margin: 0, lineHeight: 1.2, wordBreak: "break-word" }}>
            {artist.name}
          </p>
          {artist.fromBandcamp && <BandcampIcon size={12} />}
        </div>
        <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.08em", color: INK, margin: 0 }}>
          {(() => {
            const total = (artist.count ?? 0) + (artist.wantlistCount ?? 0);
            return total > 0 ? `${total} ${total === 1 ? "item" : "items"}` : "";
          })()}
        </p>
      </div>
    </div>
  );
}

// ── Right panel ────────────────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "5rem 2.5rem" }}>
      <p style={{ fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.08em", color: INK }}>
        Select an artist from your collection to begin.
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeepDiveClient({
  artists,
  userId,
  wantlistListId,
}: {
  artists: ArtistData[];
  userId: string;
  wantlistListId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useUrlTab<Section>("tab", TABS.map(t => t.id), "rankings");
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [cache, setCache] = useState<Record<string, Record<string, unknown>>>({});
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({});
  const [errorTabs, setErrorTabs] = useState<Record<string, boolean>>({});

  // Track which artist:section combos have been requested to prevent duplicates
  const startedRef = useRef(new Set<string>());

  // Live wantlist counts (null = use server-provided counts from props)
  const [liveWantlistCounts, setLiveWantlistCounts] = useState<Record<string, number> | null>(null);
  const [liveExtraArtists, setLiveExtraArtists] = useState<ArtistData[]>([]);

  // Merge server artists with live wantlist data
  const mergedArtists = useMemo((): ArtistData[] => {
    if (liveWantlistCounts === null) return artists;
    const collectionNames = new Set(artists.map((a) => a.name.toLowerCase().trim()));
    const withLive = artists
      .map((a) => ({ ...a, wantlistCount: liveWantlistCounts[a.name.toLowerCase().trim()] ?? 0 }))
      .filter((a) => a.count > 0 || (liveWantlistCounts[a.name.toLowerCase().trim()] ?? 0) > 0);
    const extras = liveExtraArtists.filter((a) => !collectionNames.has(a.name.toLowerCase().trim()));
    return [...withLive, ...extras].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [artists, liveWantlistCounts, liveExtraArtists]);

  // Real-time wantlist subscription — re-reads all three wantlist sources on any change
  useEffect(() => {
    if (!wantlistListId) return;
    const supabase = createClient();

    async function refetch() {
      const counts: Record<string, number> = {};
      const caseMap: Record<string, string> = {};

      function add(name: string | null | undefined) {
        const key = (name ?? "").toLowerCase().trim();
        if (!key) return;
        counts[key] = (counts[key] ?? 0) + 1;
        if (!caseMap[key]) caseMap[key] = name!;
      }

      // Source 1: wantlist table (Discogs OAuth sync)
      const { data: dw } = await supabase.from("wantlist").select("artist").eq("user_id", userId);
      for (const r of dw ?? []) add(r.artist as string);

      // Source 2 & 3: list_items
      const { data: li } = await supabase
        .from("list_items")
        .select("song_artist, record_id")
        .eq("list_id", wantlistListId!);

      const recordIds: string[] = [];
      for (const item of li ?? []) {
        if ((item as { song_artist: string | null }).song_artist) {
          add((item as { song_artist: string }).song_artist);
        } else if ((item as { record_id: string | null }).record_id) {
          recordIds.push((item as { record_id: string }).record_id);
        }
      }
      if (recordIds.length > 0) {
        const { data: recs } = await supabase.from("records").select("artist").in("id", recordIds);
        for (const r of recs ?? []) add(r.artist as string);
      }

      setLiveWantlistCounts(counts);
      const collNames = new Set(artists.map((a) => a.name.toLowerCase().trim()));
      setLiveExtraArtists(
        Object.entries(counts)
          .filter(([key, c]) => !collNames.has(key) && c > 0)
          .map(([key, c]) => ({
            name: caseMap[key] ?? key,
            count: 0,
            wantlistCount: c,
            fromBandcamp: false,
            records: [],
          }))
      );
    }

    const channel = supabase
      .channel("wantlist-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${wantlistListId}` },
        () => { void refetch(); }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, wantlistListId]);

  const filtered = query.trim()
    ? mergedArtists.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()))
    : mergedArtists;

  // Auto-select a random artist on first load
  useEffect(() => {
    if (artists.length > 0) {
      const pick = artists[Math.floor(Math.random() * Math.min(artists.length, 20))];
      setSelectedArtist(pick.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire all artist image fetches on mount (best-effort, progressive)
  useEffect(() => {
    for (const a of artists) {
      fetch(`/api/deep-dive/artist-image?artist=${encodeURIComponent(a.name)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { url?: string } | null) => {
          if (d?.url) {
            setImageMap((prev) => ({ ...prev, [a.name]: d.url! }));
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // artists is stable (server-provided)

  // Auto-trigger intelligence fetch when artist or tab changes
  useEffect(() => {
    if (!selectedArtist) return;
    const key = `${selectedArtist}:${activeTab}`;
    if (startedRef.current.has(key)) return;
    startedRef.current.add(key);

    const artist = selectedArtist;
    const section = activeTab;
    const artistData = artists.find((a) => a.name === selectedArtist);
    const ownedAlbums = (section === "blindspot" || section === "rankings")
      ? (artistData?.records.map((r) => r.year ? `${r.album} (${r.year})` : r.album) ?? [])
      : undefined;

    setLoadingTabs((prev) => ({ ...prev, [key]: true }));
    setErrorTabs((prev) => { const n = { ...prev }; delete n[key]; return n; });

    fetch("/api/deep-dive/intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist, section, ...(ownedAlbums && { ownedAlbums }) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("API error"))))
      .then((json: { data: unknown }) => {
        setCache((prev) => ({
          ...prev,
          [artist]: { ...(prev[artist] ?? {}), [section]: json.data ?? {} },
        }));
      })
      .catch(() => {
        startedRef.current.delete(key); // allow retry
        setErrorTabs((prev) => ({ ...prev, [key]: true }));
      })
      .finally(() => {
        setLoadingTabs((prev) => { const n = { ...prev }; delete n[key]; return n; });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtist, activeTab]);

  function selectArtist(name: string) {
    if (selectedArtist !== name) {
      setSelectedArtist(name);
      setActiveTab("rankings");
    }
  }

  function retryFetch(artist: string, section: Section) {
    const key = `${artist}:${section}`;
    startedRef.current.delete(key);
    setErrorTabs((prev) => { const n = { ...prev }; delete n[key]; return n; });

    setLoadingTabs((prev) => ({ ...prev, [key]: true }));
    startedRef.current.add(key);

    const artistData = artists.find((a) => a.name === artist);
    const ownedAlbums = (section === "blindspot" || section === "rankings")
      ? (artistData?.records.map((r) => r.year ? `${r.album} (${r.year})` : r.album) ?? [])
      : undefined;

    fetch("/api/deep-dive/intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist, section, ...(ownedAlbums && { ownedAlbums }) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("API error"))))
      .then((json: { data: unknown }) => {
        setCache((prev) => ({
          ...prev,
          [artist]: { ...(prev[artist] ?? {}), [section]: json.data ?? {} },
        }));
      })
      .catch(() => {
        startedRef.current.delete(key);
        setErrorTabs((prev) => ({ ...prev, [key]: true }));
      })
      .finally(() => {
        setLoadingTabs((prev) => { const n = { ...prev }; delete n[key]; return n; });
      });
  }

  function renderTabContent() {
    if (!selectedArtist) return null;
    const key = `${selectedArtist}:${activeTab}`;
    const artist = selectedArtist;
    const tab = activeTab;

    if (loadingTabs[key]) return <SkeletonRows />;

    if (errorTabs[key]) {
      return (
        <div style={{ padding: "2rem 0" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK }}>
            No information available for this artist.{" "}
          </span>
          <button
            onClick={() => retryFetch(artist, tab)}
            style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: ORANGE, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
          >
            Retry
          </button>
        </div>
      );
    }

    const data = cache[selectedArtist]?.[activeTab];
    if (!data) return <SkeletonRows />;

    if (tab === "rankings")   return <RankingsContent   data={data as { albums?: Album[] }} />;
    if (tab === "podcasts")   return <PodcastsContent   data={data as { episodes?: Episode[] }} artist={selectedArtist} />;
    if (tab === "books")      return <BooksContent      data={data as { items?: BookItem[] }} />;
    if (tab === "interviews") return <InterviewsContent data={data as { interviews?: InterviewItem[] }} artist={selectedArtist} />;
    if (tab === "related")    return <RelatedArtistsContent data={data as { artists?: RelatedArtist[] }} />;
    if (tab === "blindspot")  return <BlindSpotContent  data={data as { albums?: BlindSpotAlbum[] }} artist={selectedArtist} />;
    return null;
  }

  const selectedData = mergedArtists.find((a) => a.name === selectedArtist);

  function RightPanelContent() {
    if (!selectedArtist || !selectedData) return <EmptyPanel />;

    const imgUrl = imageMap[selectedArtist];

    return (
      <div>
        {/* Artist player — flush at top, same horizontal padding as content. Desktop only — too cramped on mobile. */}
        <div className="hidden md:block">
          <ArtistPlayer artist={selectedArtist} />
        </div>

      <div className="dd-panel-content" style={{ padding: "2.5rem" }}>
        {/* Artist header */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt="" aria-hidden style={{ width: 96, height: 96, objectFit: "cover", flexShrink: 0, display: "block" }} />
          ) : (
            <ArtistInitial name={selectedArtist} size={96} />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h2 className="dd-artist-name" style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 600, color: INK, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>
                {selectedArtist}
              </h2>
              {selectedData?.fromBandcamp && <BandcampIcon size={16} />}
            </div>
            <p style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.06em", color: INK, margin: "0 0 12px" }}>
              {[
                selectedData.count > 0 ? `${selectedData.count} ${selectedData.count === 1 ? "item" : "items"} in your collection` : "",
                (selectedData.wantlistCount ?? 0) > 0 ? `${selectedData.wantlistCount} ${selectedData.wantlistCount === 1 ? "item" : "items"} in your wantlist` : "",
              ].filter(Boolean).join(" · ")}
            </p>
            <CollectionStrip records={selectedData.records} wantlistRecords={selectedData.wantlistRecords ?? []} artist={selectedArtist} tileSize={36} />
          </div>
        </div>

        <div style={{ borderBottom: `1px solid ${RULE}` }} />

        {/* Tabs */}
        <style>{`
          .dd-tabbar::-webkit-scrollbar { display: none; }
          .dd-tab-select { display: none; }
          @media (max-width: 767px) {
            .dd-panel-content { padding: 1.25rem 1rem !important; }
            .dd-artist-name   { font-size: 1.4rem !important; }
            .dd-tabbar        { display: none !important; }
            .dd-tab-select    { display: block !important; }
          }
        `}</style>

        {/* Desktop tab bar */}
        <div
          className="dd-tabbar"
          style={{
            display: "flex",
            borderBottom: `1px solid ${RULE}`,
            overflowX: "auto",
            scrollbarWidth: "none" as const,
            WebkitOverflowScrolling: "touch",
            gap: 0,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: MONO,
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: activeTab === tab.id ? ORANGE : INK,
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? `2px solid ${ORANGE}` : "2px solid transparent",
                padding: "1rem 1rem 10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile section picker */}
        <select
          className="dd-tab-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as Section)}
          style={{
            width: "100%",
            fontFamily: MONO,
            fontSize: "0.75rem",
            letterSpacing: "0.06em",
            color: INK,
            background: "#ffffff",
            border: "none",
            borderBottom: `2px solid ${ORANGE}`,
            padding: "0.75rem 0",
            outline: "none",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            marginBottom: "1rem",
          }}
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>

        {/* Tab content */}
        <div style={{ marginTop: 24 }}>
          {renderTabContent()}
        </div>
      </div>
      </div>
    );
  }

  return (
    <div>

      {/* ── Desktop layout ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex">
        {/* Left sidebar */}
        <div style={{
          width: 260,
          borderRight: `1px solid ${RULE}`,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          alignSelf: "flex-start",
        }}>
          {/* Randomiser */}
          {mergedArtists.length > 0 && (
            <div style={{ padding: "8px 1rem", borderBottom: `1px solid ${RULE}` }}>
              <button
                type="button"
                onClick={() => {
                  const idx = Math.floor(Math.random() * mergedArtists.length);
                  selectArtist(mergedArtists[idx].name);
                }}
                style={{
                  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                  color: ORANGE, background: "none", border: "none",
                  cursor: "pointer", padding: 0,
                }}
              >
                ↺ Randomiser
              </button>
            </div>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists..."
            style={{
              width: "100%",
              fontFamily: MONO,
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              color: INK,
              background: "#ffffff",
              border: "none",
              borderBottom: `1px solid ${RULE}`,
              padding: "0.75rem 1rem",
              outline: "none",
              display: "block",
              boxSizing: "border-box",
            }}
          />
          {filtered.map((a) => (
            <ArtistRow
              key={a.name}
              artist={a}
              isSelected={selectedArtist === a.name}
              imageUrl={imageMap[a.name]}
              onSelect={selectArtist}
            />
          ))}
          {filtered.length === 0 && query && (
            <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "1rem" }}>
              No artists match &ldquo;{query}&rdquo;
            </p>
          )}
          {mergedArtists.length === 0 && (
            <div style={{ padding: "1.5rem 1rem" }}>
              <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, lineHeight: 1.6, margin: 0 }}>
                Sync your Discogs collection first to unlock Deep Dive.
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {RightPanelContent()}
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Artist picker */}
        {mergedArtists.length > 0 && (
          <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${RULE}` }}>
            <select
              value={selectedArtist ?? ""}
              onChange={(e) => selectArtist(e.target.value)}
              style={{
                width: "100%",
                fontFamily: MONO,
                fontSize: "0.75rem",
                letterSpacing: "0.06em",
                color: selectedArtist ? ORANGE : INK,
                background: "#ffffff",
                border: "none",
                borderBottom: `2px solid ${ORANGE}`,
                padding: "0.5rem 0",
                outline: "none",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
              }}
            >
              <option value="" disabled>Select artist…</option>
              {mergedArtists.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const idx = Math.floor(Math.random() * mergedArtists.length);
                selectArtist(mergedArtists[idx].name);
              }}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                color: ORANGE, background: "none", border: "none",
                cursor: "pointer", padding: 0, marginTop: "10px",
              }}
            >
              ↺ Randomiser
            </button>
          </div>
        )}

        {mergedArtists.length === 0 && (
          <div style={{ padding: "2rem 1rem" }}>
            <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.06em", color: INK, lineHeight: 1.6 }}>
              Sync your Discogs collection first to unlock Deep Dive.
            </p>
          </div>
        )}

        {/* Mobile content panel */}
        {RightPanelContent()}
      </div>
    </div>
  );
}
