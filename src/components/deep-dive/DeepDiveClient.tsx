"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import ArtistPlayer from "@/components/deep-dive/ArtistPlayer";
import { useUrlTab } from "@/lib/useUrlTab";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const WARM   = "#FDF6F0";
const SUBTLE = "#f0efea";

type Section = "rankings" | "podcasts" | "books" | "interviews" | "related" | "blindspot" | "pressings";

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

const TAB_IDS: Section[] = ["rankings", "pressings", "blindspot", "podcasts", "books", "interviews", "related"];

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

type Album = { rank: number; title: string; year: number; review: string };

function RankingsContent({
  data,
  onAddToWantlist,
  wantlistAdded,
  collectionSet,
  wantlistSet,
}: {
  data: { albums?: Album[] };
  onAddToWantlist?: (album: Album) => void;
  wantlistAdded?: Set<string>;
  collectionSet?: Set<string>;
  wantlistSet?: Set<string>;
}) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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
      {albums.map((a) => {
        const key          = norm(a.title);
        const inCollection = collectionSet?.has(key) ?? false;
        const inWantlist   = wantlistSet?.has(key) ?? wantlistAdded?.has(a.title) ?? false;

        const statusTag = inCollection
          ? <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em", color: "#aaa", border: "1px solid #ddd", padding: "2px 7px", flexShrink: 0 }}>In Collection</span>
          : inWantlist
          ? <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em", color: ORANGE, border: `1px solid ${ORANGE}`, padding: "2px 7px", flexShrink: 0, opacity: 0.6 }}>In Wantlist</span>
          : onAddToWantlist
          ? (
            <button
              type="button"
              onClick={() => onAddToWantlist(a)}
              style={{
                fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em",
                color: ORANGE, background: "none",
                border: `1px dashed ${ORANGE}`,
                padding: "2px 7px", cursor: "pointer", flexShrink: 0,
              }}
            >
              + Wantlist
            </button>
          )
          : null;

        return (
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
                  {statusTag}
                </div>
                <div style={{ borderTop: `1px solid ${RULE}`, margin: "0 0 10px" }} />
                <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, lineHeight: 1.7, margin: 0 }}>
                  {a.review}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Episode = { show: string; episode: string; year: number; type: string; note: string; appleUrl?: string; spotifyUrl?: string };

function PodcastsContent({ data, artist }: { data: { episodes?: Episode[] }; artist: string }) {
  // Sort episodes by year descending, cap at 10
  const eps = [...(data.episodes ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 10);

  // Apple Podcasts: episode-level lookup via iTunes, falls back to show then search.
  // Only used for episodes the generation step couldn't verify a real URL for (ep.appleUrl).
  const [appleUrls, setAppleUrls] = useState<Record<number, string>>({});
  // Spotify: episode lookup via server route (client credentials, hides secret).
  // Same — only a fallback for episodes missing ep.spotifyUrl.
  const [spotifyUrls, setSpotifyUrls] = useState<Record<number, string>>({});

  const epsKey = eps.map((e, i) => `${i}:${e.show}:${e.episode}`).join("|");

  useEffect(() => {
    // Only chase down links the generation step didn't already verify via web search.
    // Keep original eps indices so map keys still line up with the rendered list.
    const appleIdx   = eps.map((e, i) => [e, i] as const).filter(([e]) => !e.appleUrl);
    const spotifyIdx = eps.map((e, i) => [e, i] as const).filter(([e]) => !e.spotifyUrl);
    if (appleIdx.length === 0 && spotifyIdx.length === 0) return;
    let cancelled = false;

    // Apple Podcasts — two-step iTunes lookup:
    // 1. Resolve each unique show name → collectionId (batched, one req per show)
    // 2. Fetch up to 200 episodes for each show via /lookup, fuzzy-match episode title
    // No confident match → leave unset, so appleHref's own fallback (a search URL,
    // honestly labeled as a search) takes over rather than a show-page link that
    // looks like the episode and isn't.
    if (appleIdx.length > 0) (async () => {
      try {
        // Step 1: resolve unique shows
        const uniqueShows = [...new Set(appleIdx.map(([e]) => e.show))];
        type ShowMeta = { collectionId: number };
        const showMeta: Record<string, ShowMeta> = {};
        await Promise.all(
          uniqueShows.map(async (show) => {
            try {
              const res = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(show)}&media=podcast&entity=podcast&limit=1`
              );
              if (!res.ok) return;
              const json = await res.json() as { results?: { collectionId?: number }[] };
              const r = json.results?.[0];
              if (r?.collectionId) {
                showMeta[show] = { collectionId: r.collectionId };
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

        // Step 3: match each episode by title — substring match wins immediately,
        // otherwise require 2+ overlapping significant words (same bar as the
        // Spotify route) to avoid confidently linking to the wrong episode.
        const map: Record<number, string> = {};
        appleIdx.forEach(([ep, i]) => {
          const candidates = showEps[ep.show] ?? [];
          const target = ep.episode.toLowerCase();
          const slug = target.slice(0, 40);

          let best: EpMeta | null = null;
          let bestScore = 0;
          for (const c of candidates) {
            const name = (c.trackName ?? "").toLowerCase();
            if (name.includes(slug) || target.includes(name.slice(0, 40))) {
              best = c;
              break;
            }
            const targetWords = target.split(/\W+/).filter((w) => w.length > 3);
            const score = targetWords.filter((w) => name.includes(w)).length;
            if (score > bestScore) { bestScore = score; best = c; }
          }

          const confident = best && (
            target.includes((best.trackName ?? "").toLowerCase().slice(0, 40)) ||
            (best.trackName ?? "").toLowerCase().includes(slug) ||
            bestScore >= 2
          );
          if (confident && best?.trackViewUrl) map[i] = best.trackViewUrl;
        });
        setAppleUrls(map);
      } catch { /* silent */ }
    })();

    // Spotify — server-side route to keep client secret hidden
    if (spotifyIdx.length > 0) fetch("/api/deep-dive/podcast-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodes: spotifyIdx.map(([e]) => ({ show: e.show, episode: e.episode })) }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { urls?: Record<number, string> } | null) => {
        if (cancelled || !d?.urls) return;
        // Response keys are indices into the subset we sent — remap to original eps indices.
        const remapped: Record<number, string> = {};
        spotifyIdx.forEach(([, originalI], sentI) => {
          if (d.urls![sentI]) remapped[originalI] = d.urls![sentI];
        });
        setSpotifyUrls(remapped);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epsKey]);

  const appleHref = (i: number, ep: Episode) =>
    ep.appleUrl ?? appleUrls[i] ?? `https://podcasts.apple.com/search?term=${encodeURIComponent(`${ep.show} ${ep.episode}`)}`;
  const spotifyHref = (i: number, ep: Episode) => ep.spotifyUrl ?? spotifyUrls[i];

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
            {spotifyHref(i, ep) && (
              <a href={spotifyHref(i, ep)} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
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

type BookItem = { title: string; author: string; year: number; type: string; format: string; isbn13?: string; note: string; written_by_artist?: boolean; amazonUrl?: string; audibleUrl?: string };

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
    // Prefer the direct product URL Claude found and verified via web search.
    // OneLink (loaded in layout) rewrites amazon.com links to each visitor's local store.
    if (b.amazonUrl) {
      if (!tag) return b.amazonUrl;
      return `${b.amazonUrl}${b.amazonUrl.includes("?") ? "&" : "?"}tag=${tag}`;
    }
    // field-isbn targets Amazon's book ISBN index directly (much more reliable than k=ISBN).
    if (b.isbn13) {
      const base = `https://www.amazon.com/s?field-isbn=${encodeURIComponent(b.isbn13)}&search-alias=books`;
      return tag ? `${base}&tag=${tag}` : base;
    }
    const q = encodeURIComponent(`${b.title} ${b.author}`);
    return tag ? `https://www.amazon.com/s?k=${q}&search-alias=books&tag=${tag}` : `https://www.amazon.com/s?k=${q}&search-alias=books`;
  }

  function audibleHref(b: BookItem) {
    // Prefer the direct page Claude found and verified via web search.
    // OneLink handles regional routing (audible.co.uk, audible.com.au, etc.) via the layout script.
    if (b.audibleUrl) return b.audibleUrl;
    // Audible uses its own ASIN system — ISBN lookup doesn't map. Title+author is more reliable.
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
  const t = useTranslations("deepDive");
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
              {direct ? t("readArticle") : t("findArticle")}
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

function CollectionStrip({ records, wantlistRecords = [], tileSize = 80 }: { records: ArtistData["records"]; wantlistRecords?: ArtistData["wantlistRecords"]; artist?: string; tileSize?: number }) {
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
        </div>
      ))}
    </div>
  );
}

// ── Pressing Explorer ──────────────────────────────────────────────────────────

type PressingVariant = {
  releaseId: number;
  country: string;
  year: string;
  label: string;
  catno: string;
  format: string;
  inCollection: number;
  inWantlist: number;
  wantHaveRatio: number;
  lowestPrice: number | null;
  numForSale: number;
};

type PressingsAlbum = {
  album: string;
  year: number;
  masterId: number;
  variants: PressingVariant[];
};

type PriceEntry = { lowestPrice: number | null; currency: string; numForSale: number };

function detectCurrency(): string {
  try {
    const region = (navigator.language || "en-US").split("-").pop()?.toUpperCase() ?? "";
    const map: Record<string, string> = {
      US: "USD", GB: "GBP", AU: "AUD", CA: "CAD", NZ: "NZD",
      DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
      AT: "EUR", BE: "EUR", FI: "EUR", IE: "EUR", PT: "EUR",
      JP: "JPY", SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF",
      MX: "MXN", BR: "BRL", ZA: "ZAR", SG: "SGD", PL: "PLN",
    };
    return map[region] ?? "USD";
  } catch {
    return "USD";
  }
}

function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(navigator.language, {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function PressingsContent({ data, onRetry }: { data: { pressings?: PressingsAlbum[] }; onRetry?: () => void }) {
  const albums = (data.pressings ?? []).filter(a => a.variants.length > 0);

  if (albums.length === 0) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK, padding: "2rem 0" }}>
        No vinyl pressing data available for this artist on Discogs.{" "}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: ORANGE, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
          >
            Retry
          </button>
        )}
      </p>
    );
  }

  // Column definitions: label, width (px), alignment
  const COLS: { label: string; w: number; align: "left" | "right" }[] = [
    { label: "Format",  w: 110, align: "left"  },
    { label: "Country", w: 80,  align: "left"  },
    { label: "Year",    w: 50,  align: "right" },
    { label: "Label",   w: 120, align: "left"  },
    { label: "Cat#",    w: 100, align: "left"  },
    { label: "Wants",   w: 58,  align: "right" },
    { label: "Have",    w: 58,  align: "right" },
    { label: "Ratio",   w: 60,  align: "right" },
    { label: "Price",   w: 80,  align: "right" },
    { label: "",        w: 64,  align: "left"  },
  ];
  const tableWidth = COLS.reduce((s, c) => s + c.w, 0);

  return (
    <div>
      {albums.map((a, ai) => {
        const hasVariants = a.variants.length > 0;
        return (
          <div key={ai} style={{ padding: "1.5rem 0", borderBottom: `1px solid ${RULE}` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: hasVariants ? 14 : 0 }}>
              <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
                {a.album}
              </span>
              <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: INK }}>
                · {a.year}
              </span>
            </div>

            {!hasVariants && (
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: "#aaa", margin: "8px 0 0" }}>
                No vinyl pressings found on Discogs.
              </p>
            )}

            {hasVariants && (
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: tableWidth }}>
                  <colgroup>
                    {COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      {COLS.map((c, i) => (
                        <th key={i} style={{
                          fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "0.12em",
                          textTransform: "uppercase", color: ORANGE,
                          textAlign: c.align,
                          padding: "0 8px 6px 0",
                          borderBottom: `1px solid ${RULE}`,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.variants.map((v, vi) => {
                      const priceStr = v.lowestPrice != null
                        ? formatPrice(v.lowestPrice, detectCurrency())
                        : "—";
                      const discogsUrl = `https://www.discogs.com/release/${v.releaseId}`;
                      const tdBase: React.CSSProperties = {
                        fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.03em", color: INK,
                        padding: "7px 8px 7px 0", borderBottom: `1px solid ${RULE}`,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      };
                      return (
                        <tr key={vi}>
                          <td style={{ ...tdBase, fontSize: "0.62rem" }}>{v.format || "Vinyl"}</td>
                          <td style={tdBase}>{v.country}</td>
                          <td style={{ ...tdBase, textAlign: "right" }}>{v.year || "—"}</td>
                          <td style={{ ...tdBase, fontSize: "0.65rem" }}>{v.label}</td>
                          <td style={{ ...tdBase, fontSize: "0.62rem", color: "#777" }}>{v.catno || "—"}</td>
                          <td style={{ ...tdBase, textAlign: "right" }}>{v.inWantlist.toLocaleString()}</td>
                          <td style={{ ...tdBase, textAlign: "right" }}>{v.inCollection.toLocaleString()}</td>
                          <td style={{ ...tdBase, textAlign: "right", color: v.wantHaveRatio >= 2 ? ORANGE : INK }}>
                            {v.wantHaveRatio.toFixed(2)}×
                          </td>
                          <td style={{ ...tdBase, textAlign: "right" }}>{priceStr}</td>
                          <td style={{ padding: "7px 0 7px 4px", borderBottom: `1px solid ${RULE}` }}>
                            <a
                              href={discogsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: ORANGE, textDecoration: "none", whiteSpace: "nowrap" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
                            >
                              Discogs →
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: "#aaa", marginTop: 16 }}>
        Ratio = wants ÷ haves. Price = current lowest Discogs listing. Data via Discogs.
      </p>
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

// ── Error classification ────────────────────────────────────────────────────
// Distinguishes "you've hit today's Deep Dive cap" from a genuine failure —
// both used to collapse into the same generic "No information available"
// message, which was actively misleading once the cap was hit (every artist
// and every tab would show it, with Retry just burning another blocked call).

type TabErrorKind = { kind: "rate_limit"; used: number; limit: number } | { kind: "error" };

async function classifyFetchError(res: Response): Promise<TabErrorKind> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (res.status === 429 && body?.error === "daily_limit_reached") {
    return { kind: "rate_limit", used: Number(body.used) || 0, limit: Number(body.limit) || 0 };
  }
  return { kind: "error" };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeepDiveClient({
  artists,
  userId,
  wantlistListId,
  initialFavorites = [],
}: {
  artists: ArtistData[];
  userId: string;
  wantlistListId: string | null;
  initialFavorites?: string[];
}) {
  const t = useTranslations("deepDive");
  const TABS: { id: Section; label: string }[] = [
    { id: "rankings",   label: t("essentialAlbums") },
    { id: "pressings",  label: t("pressings") },
    { id: "blindspot",  label: t("blindSpot") },
    { id: "podcasts",   label: t("podcasts") },
    { id: "books",      label: t("books") },
    { id: "interviews", label: t("interviews") },
    { id: "related",    label: t("relatedArtists") },
  ];
  const [query, setQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(initialFavorites));
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favoriteTogglingRef = useRef(new Set<string>());
  const [activeTab, setActiveTab] = useUrlTab<Section>("tab", TAB_IDS, "rankings");
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [cache, setCache] = useState<Record<string, Record<string, unknown>>>({});
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({});
  const [errorTabs, setErrorTabs] = useState<Record<string, TabErrorKind>>({});

  // Outside Collection mode
  const [searchMode, setSearchMode] = useState<"inside" | "outside">("inside");
  const [isExternalArtist, setIsExternalArtist] = useState(false);
  const [discogsResults, setDiscogsResults] = useState<{ id: number; name: string; thumb: string | null }[]>([]);
  const [discogsSearching, setDiscogsSearching] = useState(false);
  const discogsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wantlist additions from Essential Albums
  const [wantlistAdded, setWantlistAdded] = useState<Set<string>>(new Set());
  const [wantlistError, setWantlistError] = useState<string | null>(null);

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

  const filtered = mergedArtists
    .filter((a) => !favoritesOnly || favorites.has(a.name))
    .filter((a) => !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase()));

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
      .then(async (r) => (r.ok ? (r.json() as Promise<{ data: unknown }>) : Promise.reject(await classifyFetchError(r))))
      .then((json) => {
        setCache((prev) => ({
          ...prev,
          [artist]: { ...(prev[artist] ?? {}), [section]: json.data ?? {} },
        }));
      })
      .catch((err: TabErrorKind | undefined) => {
        startedRef.current.delete(key); // allow retry
        setErrorTabs((prev) => ({ ...prev, [key]: err?.kind ? err : { kind: "error" } }));
      })
      .finally(() => {
        setLoadingTabs((prev) => { const n = { ...prev }; delete n[key]; return n; });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtist, activeTab]);

  function selectArtist(name: string) {
    if (selectedArtist !== name) {
      setIsExternalArtist(false);
      setSelectedArtist(name);
      setActiveTab("rankings");
    }
  }

  function selectExternalArtist(name: string) {
    setIsExternalArtist(true);
    setSelectedArtist(name);
    if (activeTab === "blindspot") setActiveTab("rankings");
    setDiscogsResults([]);
    setQuery("");
    if (!imageMap[name]) {
      fetch(`/api/deep-dive/artist-image?artist=${encodeURIComponent(name)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { url?: string } | null) => {
          if (d?.url) setImageMap((prev) => ({ ...prev, [name]: d.url! }));
        })
        .catch(() => {});
    }
  }

  function handleSearchModeSwitch(mode: "inside" | "outside") {
    setSearchMode(mode);
    setQuery("");
    setDiscogsResults([]);
    if (discogsTimerRef.current) clearTimeout(discogsTimerRef.current);
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (searchMode === "outside") {
      if (discogsTimerRef.current) clearTimeout(discogsTimerRef.current);
      if (!val.trim() || val.trim().length < 2) { setDiscogsResults([]); return; }
      setDiscogsSearching(true);
      discogsTimerRef.current = setTimeout(() => {
        fetch(`/api/deep-dive/artist-search?q=${encodeURIComponent(val.trim())}`)
          .then((r) => (r.ok ? r.json() : { results: [] }))
          .then((d: { results?: { id: number; name: string; thumb: string | null }[] }) => {
            setDiscogsResults(d.results ?? []);
          })
          .catch(() => setDiscogsResults([]))
          .finally(() => setDiscogsSearching(false));
      }, 400);
    }
  }

  async function addAlbumToWantlist(album: Album) {
    if (!selectedArtist) return;
    const key = album.title;
    setWantlistAdded((prev) => new Set(prev).add(key));

    // Fetch cover art best-effort
    let coverUrl: string | null = null;
    try {
      const r = await fetch(`/api/deep-dive/album-art?artist=${encodeURIComponent(selectedArtist)}&album=${encodeURIComponent(album.title)}`);
      if (r.ok) { const d = await r.json() as { url?: string }; coverUrl = d.url ?? null; }
    } catch { /* no cover — fine */ }

    const supabase = createClient();
    try {
      // Find or create wantlist
      let listId = wantlistListId;
      if (!listId) {
        const { data: existing, error: findErr } = await supabase
          .from("lists").select("id").eq("user_id", userId).eq("slug", "wantlist").single();
        if (findErr && findErr.code !== "PGRST116") throw new Error(findErr.message);
        if (existing) {
          listId = existing.id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from("lists")
            .insert({ user_id: userId, title: "Wantlist", slug: "wantlist", is_public: true, list_type: "personal" })
            .select("id").single();
          if (createErr || !created) throw new Error(createErr?.message ?? "Could not create wantlist");
          listId = created.id;
        }
      }
      // Next position
      const { data: posRow } = await supabase
        .from("list_items").select("position").eq("list_id", listId)
        .order("position", { ascending: false }).limit(1).maybeSingle();
      const nextPos = (posRow?.position ?? 0) + 1;
      // Insert
      const { error: insertErr } = await supabase.from("list_items").insert({
        list_id: listId, position: nextPos, item_type: "song",
        song_title: album.title, song_artist: selectedArtist,
        song_album: album.title, song_year: album.year ?? null,
        song_cover_url: coverUrl, source: "deep-dive",
      });
      if (insertErr) throw new Error(insertErr.message);
    } catch (e) {
      setWantlistAdded((prev) => { const s = new Set(prev); s.delete(key); return s; });
      setWantlistError(e instanceof Error ? e.message : "Failed to add to wantlist");
      setTimeout(() => setWantlistError(null), 5000);
    }
  }

  async function toggleFavorite(artist: string) {
    if (favoriteTogglingRef.current.has(artist)) return;
    favoriteTogglingRef.current.add(artist);
    const wasFavorite = favorites.has(artist);

    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(artist); else next.add(artist);
      return next;
    });

    try {
      const supabase = createClient() as any;
      // insert()/delete() resolve with { data, error } rather than throwing on
      // a DB-level failure (RLS rejection, constraint violation, etc.) — a
      // bare try/catch never sees that, so the optimistic state looked saved
      // even when nothing actually landed in the table. Check error explicitly.
      const { error } = wasFavorite
        ? await supabase.from("deep_dive_favorites").delete().eq("user_id", userId).eq("artist", artist)
        : await supabase.from("deep_dive_favorites").insert({ user_id: userId, artist });
      if (error) throw error;
    } catch (err) {
      console.error("toggleFavorite failed:", err);
      // Revert on failure
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(artist); else next.delete(artist);
        return next;
      });
    } finally {
      favoriteTogglingRef.current.delete(artist);
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
      body: JSON.stringify({ artist, section, force: true, ...(ownedAlbums && { ownedAlbums }) }),
    })
      .then(async (r) => (r.ok ? (r.json() as Promise<{ data: unknown }>) : Promise.reject(await classifyFetchError(r))))
      .then((json) => {
        setCache((prev) => ({
          ...prev,
          [artist]: { ...(prev[artist] ?? {}), [section]: json.data ?? {} },
        }));
      })
      .catch((err: TabErrorKind | undefined) => {
        startedRef.current.delete(key);
        setErrorTabs((prev) => ({ ...prev, [key]: err?.kind ? err : { kind: "error" } }));
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

    const tabError = errorTabs[key];
    if (tabError?.kind === "rate_limit") {
      return (
        <div style={{ padding: "2rem 0" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK }}>
            You&rsquo;ve reached today&rsquo;s Deep Dive limit ({tabError.used}/{tabError.limit}) — try again tomorrow.
          </span>
        </div>
      );
    }
    if (tabError) {
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

    if (tab === "rankings") {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const artistData = mergedArtists.find((a) => a.name === selectedArtist);
      const collectionSet = new Set((artistData?.records ?? []).map((r) => norm(r.album)));
      const wantlistSet   = new Set([
        ...(artistData?.wantlistRecords ?? []).map((r) => norm(r.album)),
        ...[...wantlistAdded].map(norm),
      ]);
      return <RankingsContent
        data={data as { albums?: Album[] }}
        onAddToWantlist={addAlbumToWantlist}
        wantlistAdded={wantlistAdded}
        collectionSet={collectionSet}
        wantlistSet={wantlistSet}
      />;
    }
    if (tab === "podcasts")   return <PodcastsContent   data={data as { episodes?: Episode[] }} artist={selectedArtist} />;
    if (tab === "books")      return <BooksContent      data={data as { items?: BookItem[] }} />;
    if (tab === "interviews") return <InterviewsContent data={data as { interviews?: InterviewItem[] }} artist={selectedArtist} />;
    if (tab === "related")    return <RelatedArtistsContent data={data as { artists?: RelatedArtist[] }} />;
    if (tab === "blindspot")  return <BlindSpotContent  data={data as { albums?: BlindSpotAlbum[] }} artist={selectedArtist} />;
    if (tab === "pressings")  return <PressingsContent  data={data as { pressings?: PressingsAlbum[] }} onRetry={() => retryFetch(selectedArtist, "pressings")} />;
    return null;
  }

  const selectedData = mergedArtists.find((a) => a.name === selectedArtist);

  function RightPanelContent() {
    if (!selectedArtist) return <EmptyPanel />;

    // External artist — no collection data, full tab bar (minus Blind Spot)
    if (isExternalArtist && !selectedData) {
      const imgUrl = imageMap[selectedArtist];
      const externalTabs = TABS.filter((tab) => tab.id !== "blindspot");
      return (
        <div>
          <div className="hidden md:block"><ArtistPlayer artist={selectedArtist} /></div>
          <div className="dd-panel-content" style={{ padding: "2.5rem" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
              {imgUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={imgUrl} alt="" aria-hidden style={{ width: 96, height: 96, objectFit: "cover", flexShrink: 0, display: "block" }} />
                : <ArtistInitial name={selectedArtist} size={96} />
              }
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <h2 className="dd-artist-name" style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 600, color: INK, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>
                    {selectedArtist}
                  </h2>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(selectedArtist)}
                    title={favorites.has(selectedArtist) ? t("removeFromFavourites") : t("addToFavourites")}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      lineHeight: 1, fontSize: "1.6rem",
                      color: favorites.has(selectedArtist) ? ORANGE : "#cccccc",
                    }}
                  >
                    {favorites.has(selectedArtist) ? "♥" : "♡"}
                  </button>
                </div>
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.06em", color: "#aaa", margin: 0 }}>
                  Outside your collection
                </p>
              </div>
            </div>
            <div style={{ borderBottom: `1px solid ${RULE}` }} />

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

            {wantlistError && (
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "red", margin: "1rem 0 0" }}>{wantlistError}</p>
            )}

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
              {externalTabs.map((tab) => (
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
              {externalTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </select>

            <div style={{ marginTop: 24 }}>
              {renderTabContent()}
            </div>
          </div>
        </div>
      );
    }

    if (!selectedData) return <EmptyPanel />;

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
              <button
                type="button"
                onClick={() => toggleFavorite(selectedArtist)}
                title={favorites.has(selectedArtist) ? "Remove from favourites" : "Add to favourites"}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  lineHeight: 1, fontSize: "1.6rem",
                  color: favorites.has(selectedArtist) ? ORANGE : "#cccccc",
                }}
              >
                {favorites.has(selectedArtist) ? "♥" : "♡"}
              </button>
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

        {wantlistError && (
          <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "red", margin: "0 0 1rem" }}>{wantlistError}</p>
        )}

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
          {/* Top row: randomiser (left) + ♥ favourites (right) */}
          <div style={{ padding: "8px 1rem", borderBottom: `1px solid ${RULE}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {mergedArtists.length > 0 ? (
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
            ) : <span />}
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              title={favoritesOnly ? t("showAllArtists") : t("favouritesOnly")}
              style={{
                fontSize: "1.6rem", lineHeight: 1,
                color: favoritesOnly ? ORANGE : "#666",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              {favoritesOnly ? "♥" : "♡"}
            </button>
          </div>

          {/* Inside / Outside Collection toggle */}
          <div style={{ padding: "8px 1rem", borderBottom: `1px solid ${RULE}`, display: "flex", gap: 16 }}>
            {(["inside", "outside"] as const).map((m) => {
              const active = searchMode === m;
              const label  = m === "inside" ? "Inside Collection" : "Outside Collection";
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSearchModeSwitch(m)}
                  style={{
                    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: active ? INK : "#bbb",
                    background: "none", border: "none",
                    borderBottom: `1.5px solid ${active ? ORANGE : "transparent"}`,
                    padding: "4px 0", cursor: active ? "default" : "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={searchMode === "inside" ? t("searchYourArtists") : t("searchAnyArtist")}
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

          {/* Outside Collection: Discogs search results */}
          {searchMode === "outside" && (
            <>
              {discogsSearching && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: "#aaa", padding: "0.75rem 1rem", margin: 0 }}>
                  Searching…
                </p>
              )}
              {!discogsSearching && discogsResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectExternalArtist(r.name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", textAlign: "left",
                    padding: "0.6rem 1rem",
                    background: selectedArtist === r.name ? WARM : "none",
                    border: "none", borderBottom: `1px solid ${RULE}`,
                    cursor: "pointer",
                  }}
                >
                  {r.thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.thumb} alt="" aria-hidden style={{ width: 32, height: 32, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, background: SUBTLE, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "10px", color: "#aaa" }}>{r.name[0]}</div>
                  }
                  <span style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK }}>{r.name}</span>
                </button>
              ))}
              {!discogsSearching && query.trim().length >= 2 && discogsResults.length === 0 && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "0.75rem 1rem", margin: 0 }}>
                  No artists found for &ldquo;{query}&rdquo;
                </p>
              )}
              {!query.trim() && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: "#aaa", padding: "0.75rem 1rem", margin: 0, lineHeight: 1.6 }}>
                  Search any artist to explore their essential albums.
                </p>
              )}
            </>
          )}

          {/* Inside Collection: existing artist list */}
          {searchMode === "inside" && (
            <>
              {filtered.map((a) => (
                <ArtistRow
                  key={a.name}
                  artist={a}
                  isSelected={selectedArtist === a.name && !isExternalArtist}
                  imageUrl={imageMap[a.name]}
                  onSelect={selectArtist}
                />
              ))}
              {filtered.length === 0 && query && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "1rem" }}>
                  No artists match &ldquo;{query}&rdquo;
                </p>
              )}
              {filtered.length === 0 && !query && favoritesOnly && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "1rem" }}>
                  No favourites yet — click ♡ next to an artist&rsquo;s name to add one.
                </p>
              )}
              {mergedArtists.length === 0 && (
                <div style={{ padding: "1.5rem 1rem" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, lineHeight: 1.6, margin: 0 }}>
                    Sync your Discogs collection first to unlock Deep Dive.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {RightPanelContent()}
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Artist selector */}
        <div style={{ borderBottom: `1px solid ${RULE}` }}>

          {/* Inside / Outside toggle */}
          <div style={{ padding: "8px 1rem 0", display: "flex", gap: 16 }}>
            {(["inside", "outside"] as const).map((m) => {
              const active = searchMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSearchModeSwitch(m)}
                  style={{
                    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: active ? INK : "#bbb",
                    background: "none", border: "none",
                    borderBottom: `1.5px solid ${active ? ORANGE : "transparent"}`,
                    padding: "4px 0", cursor: active ? "default" : "pointer",
                  }}
                >
                  {m === "inside" ? "Inside Collection" : "Outside Collection"}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={searchMode === "inside" ? t("searchYourArtists") : t("searchAnyArtist")}
            style={{
              width: "100%",
              fontFamily: MONO,
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              color: INK,
              background: "#ffffff",
              border: "none",
              borderBottom: `1px solid ${RULE}`,
              padding: "0.6rem 1rem",
              outline: "none",
              display: "block",
              boxSizing: "border-box",
            }}
          />

          {/* Inside Collection: filtered artist list */}
          {searchMode === "inside" && mergedArtists.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.map((a) => (
                <ArtistRow
                  key={a.name}
                  artist={a}
                  isSelected={selectedArtist === a.name && !isExternalArtist}
                  imageUrl={imageMap[a.name]}
                  onSelect={selectArtist}
                />
              ))}
              {filtered.length === 0 && query && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "0.75rem 1rem", margin: 0 }}>
                  No artists match &ldquo;{query}&rdquo;
                </p>
              )}
              {filtered.length === 0 && !query && favoritesOnly && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "0.75rem 1rem", margin: 0 }}>
                  No favourites yet — click ♡ next to an artist&rsquo;s name to add one.
                </p>
              )}
            </div>
          )}

          {searchMode === "inside" && mergedArtists.length === 0 && (
            <div style={{ padding: "1rem" }}>
              <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, lineHeight: 1.6, margin: 0 }}>
                Sync your Discogs collection first to unlock Deep Dive.
              </p>
            </div>
          )}

          {/* Outside Collection: Discogs results */}
          {searchMode === "outside" && (
            <div>
              {discogsSearching && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: "#aaa", padding: "0.75rem 1rem", margin: 0 }}>
                  Searching…
                </p>
              )}
              {!discogsSearching && discogsResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectExternalArtist(r.name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", textAlign: "left",
                    padding: "0.6rem 1rem",
                    background: selectedArtist === r.name ? WARM : "none",
                    border: "none", borderBottom: `1px solid ${RULE}`,
                    cursor: "pointer",
                  }}
                >
                  {r.thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.thumb} alt="" aria-hidden style={{ width: 32, height: 32, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, background: SUBTLE, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "10px", color: "#aaa" }}>{r.name[0]}</div>
                  }
                  <span style={{ fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em", color: INK }}>{r.name}</span>
                </button>
              ))}
              {!discogsSearching && query.trim().length >= 2 && discogsResults.length === 0 && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: INK, padding: "0.75rem 1rem", margin: 0 }}>
                  No artists found for &ldquo;{query}&rdquo;
                </p>
              )}
              {!query.trim() && (
                <p style={{ fontFamily: MONO, fontSize: "0.68rem", letterSpacing: "0.06em", color: "#aaa", padding: "0.75rem 1rem", margin: 0, lineHeight: 1.6 }}>
                  Search any artist to explore their essential albums.
                </p>
              )}
            </div>
          )}

          {/* Randomiser — inside mode only */}
          {searchMode === "inside" && mergedArtists.length > 0 && (
            <div style={{ padding: "6px 1rem 8px" }}>
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
        </div>

        {/* Mobile content panel */}
        {RightPanelContent()}
      </div>
    </div>
  );
}
