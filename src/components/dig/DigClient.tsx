"use client";

import { useState, useEffect, useRef } from "react";
import AppNav from "@/components/AppNav";
import { addToWantlist } from "@/app/dig/actions";
import RecordSpinner from "@/components/RecordSpinner";
import SpotifyPlayer from "@/components/SpotifyPlayer";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

type Recommendation = {
  artist: string;
  album:  string;
  year:   number | null;
  reason: string;
  bandcamp_search_url:    string;
  spotify_search_url:     string;
  apple_music_search_url: string;
};

interface Props {
  username:        string;
  displayLabel?:   string;
  avatarUrl?:      string | null;
  collectionCount: number;
  listsCount:      number;
}

// ─── Vinyl disc SVG ───────────────────────────────────────────────────────────

function VinylDisc() {
  return (
    <svg
      viewBox="0 0 420 420"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect width="420" height="420" fill="#0e0e0e" />
      <circle cx="210" cy="210" r="196" fill="#111111" />
      <circle cx="210" cy="210" r="183" fill="none" stroke="#1c1c1c" strokeWidth="1.2" />
      <circle cx="210" cy="210" r="170" fill="none" stroke="#1b1b1b" strokeWidth="1.2" />
      <circle cx="210" cy="210" r="157" fill="none" stroke="#1b1b1b" strokeWidth="1" />
      <circle cx="210" cy="210" r="144" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <circle cx="210" cy="210" r="131" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <circle cx="210" cy="210" r="118" fill="none" stroke="#191919" strokeWidth="1" />
      <circle cx="210" cy="210" r="105" fill="none" stroke="#191919" strokeWidth="0.8" />
      <circle cx="210" cy="210" r="92"  fill="none" stroke="#181818" strokeWidth="0.8" />
      {/* Label area */}
      <circle cx="210" cy="210" r="52"  fill="#1a1a1a" />
      <circle cx="210" cy="210" r="38"  fill="none" stroke="#222222" strokeWidth="0.6" />
      {/* Spindle */}
      <circle cx="210" cy="210" r="6"   fill="#080808" />
    </svg>
  );
}

// ─── Loading — vinyl + tonearm ────────────────────────────────────────────────

function LoadingState({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "32px" }}>
      <svg viewBox="0 0 240 196" width="180" height="147" style={{ display: "block", overflow: "visible" }} aria-hidden="true">
        <g className="dig-vinyl-spin">
          <circle cx="95"  cy="115" r="80" fill="#111111" />
          <circle cx="95"  cy="115" r="74" fill="none" stroke="#222222" strokeWidth="1" />
          <circle cx="95"  cy="115" r="67" fill="none" stroke="#1e1e1e" strokeWidth="1" />
          <circle cx="95"  cy="115" r="60" fill="none" stroke="#1d1d1d" strokeWidth="1" />
          <circle cx="95"  cy="115" r="53" fill="none" stroke="#1c1c1c" strokeWidth="1" />
          <circle cx="95"  cy="115" r="45" fill="none" stroke="#1b1b1b" strokeWidth="1" />
          <circle cx="95"  cy="115" r="37" fill="none" stroke="#1b1b1b" strokeWidth="0.8" />
          <circle cx="95"  cy="115" r="23" fill="#1a1a1a" />
          <circle cx="95"  cy="115" r="15" fill="none" stroke="#2b2b2b" strokeWidth="0.5" />
          <circle cx="95"  cy="115" r="2.5" fill="#060606" />
        </g>
        <g className="dig-arm-lower">
          <circle cx="210" cy="30" r="9"   fill="#333333" />
          <circle cx="210" cy="30" r="4"   fill="#1a1a1a" />
          <line x1="207" y1="37" x2="162" y2="78" stroke="#454545" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="162" y1="78" x2="153" y2="91" stroke="#414141" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="148" y="87" width="11" height="6" rx="1.5" fill="#373737" />
          <circle cx="151" cy="95" r="3.5" fill={ORANGE} />
        </g>
      </svg>
      <p style={{ fontFamily: SERIF, fontSize: "15px", fontStyle: "italic", color: "#888888", margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

// ─── Position indicator ───────────────────────────────────────────────────────

function PositionIndicator({ idx, total, onNav }: { idx: number; total: number; onNav: (i: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 0" }}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onNav(i)}
          aria-label={`Recommendation ${i + 1}`}
          style={{
            width: 7, height: 7, borderRadius: "50%", border: "none", padding: 0,
            cursor: "pointer",
            background: i === idx ? ORANGE : "#d8d8d8",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        />
      ))}
      <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginLeft: "6px" }}>
        {idx + 1} of {total}
      </span>
    </div>
  );
}

// ─── Sleeve card ──────────────────────────────────────────────────────────────

function SleeveCard({ rec, mode, onAddToWantlist, wantlistAdded }: {
  rec: Recommendation; mode: DigMode;
  onAddToWantlist: () => void; wantlistAdded: boolean;
}) {
  // Component remounts on every rec change (key prop), so useState resets naturally.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [spotifyPreview, setSpotifyPreview] = useState<{
    previewUrl: string | null; trackUri: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(`${rec.artist} ${rec.album}`);
    fetch(`/api/discogs/search?q=${q}&mode=record`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const first = data?.results?.[0];
        if (!first) return;
        const url =
          (first.cover_image && !first.cover_image.includes("spacer"))
            ? first.cover_image
            : (first.thumb && !first.thumb.includes("spacer") ? first.thumb : null);
        if (url) setCoverUrl(url);
      })
      .catch(() => { /* fall back to vinyl disc */ });
    return () => { cancelled = true; };
  }, [rec.artist, rec.album]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ artist: rec.artist, title: rec.album });
    fetch(`/api/spotify/preview?${params.toString()}`)
      .then(r => r.json() as Promise<{ preview_url: string | null; track_uri: string | null }>)
      .then(data => {
        if (cancelled) return;
        setSpotifyPreview({ previewUrl: data.preview_url, trackUri: data.track_uri });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rec.artist, rec.album]);

  const q = encodeURIComponent(`${rec.artist} ${rec.album}`);

  const STREAM = [
    { label: "Open in Apple Music ↗", href: `https://music.apple.com/search?term=${q}` },
    { label: "Open in Tidal ↗",       href: `https://tidal.com/search?q=${q}` },
    { label: "Open in Spotify ↗",     href: `https://open.spotify.com/search/${q}` },
  ];
  const BUY = [
    { label: "Buy on Discogs ↗",     href: `https://www.discogs.com/search/?q=${q}&type=release` },
    { label: "Search Bandcamp ↗",    href: `https://bandcamp.com/search?q=${q}` },
  ];

  const sectionLabel: React.CSSProperties = {
    fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
    textTransform: "uppercase", color: ORANGE, margin: "0 0 6px 0", display: "block",
  };
  const link: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em",
    color: "#444444", textDecoration: "none", display: "block", lineHeight: 2,
  };

  return (
    <div
      className="dig-rec-enter dig-sleeve-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "400px",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
      }}
    >
      {/* ── Left: album artwork, falls back to vinyl disc ── */}
      <div className="dig-sleeve-art" style={{ background: "#0e0e0e", overflow: "hidden", minHeight: "400px" }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`${rec.album} by ${rec.artist}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <VinylDisc />
        )}
      </div>

      {/* ── Right: text ── */}
      <div className="dig-sleeve-text" style={{ padding: "18px 22px", display: "flex", flexDirection: "column" }}>

        {/* Top row: mode tag (left) + Wantlist button (right) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px", minHeight: "20px" }}>
          <div>
            {mode === "explore" && (
              <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, margin: 0 }}>
                In your collection
              </p>
            )}
            {mode === "hallucinations" && (
              <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#b30042", margin: 0 }}>
                ⚡ Way outside your taste
              </p>
            )}
          </div>
          <button
            onClick={onAddToWantlist}
            disabled={wantlistAdded}
            style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
              color: wantlistAdded ? "#aaaaaa" : ORANGE,
              background: "none",
              border: `1px ${wantlistAdded ? "solid" : "dashed"} ${wantlistAdded ? "#aaaaaa" : ORANGE}`,
              cursor: wantlistAdded ? "default" : "pointer",
              padding: "5px 10px", flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
            {wantlistAdded ? "Added ✓" : "+ Wantlist"}
          </button>
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: "#0d0d0d", lineHeight: 1.25, margin: "0 0 6px 0" }}>
          {rec.album}
        </h2>

        {/* Artist · year */}
        <p className="dig-artist-lbl" style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#888888", margin: 0 }}>
          {rec.artist}
          {rec.year && <span style={{ color: "#cccccc" }}> · {rec.year}</span>}
        </p>

        {/* Rule */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "16px 0" }} />

        {/* AI reasoning — full text, no truncation */}
        <p
          className="dig-reason-txt"
          style={{
            fontFamily: SERIF,
            fontSize: "13px",
            fontStyle: "italic",
            color: "#505050",
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {rec.reason}
        </p>

        {/* Spacer — pushes links to the bottom */}
        <div style={{ flex: 1 }} />

        {/* Spotify Player */}
        {(spotifyPreview?.previewUrl || spotifyPreview?.trackUri) && (
          <div style={{ marginBottom: "12px" }}>
            <SpotifyPlayer
              mode="dig"
              previewUrl={spotifyPreview.previewUrl ?? undefined}
              spotifyTrackUri={spotifyPreview.trackUri ?? undefined}
            />
          </div>
        )}

        {/* Links */}
        <div style={{ flexShrink: 0, paddingTop: "16px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {mode === "explore" ? (
            <div>
              <span style={sectionLabel}>Stream</span>
              {STREAM.map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="dig-link-item" style={link}>{l.label}</a>
              ))}
            </div>
          ) : (
            <div className="dig-links-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={sectionLabel}>Stream</span>
                {STREAM.map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="dig-link-item" style={link}>{l.label}</a>
                ))}
              </div>
              <div>
                <span style={sectionLabel}>Buy</span>
                {BUY.map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="dig-link-item" style={link}>{l.label}</a>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Nav bar — single row ─────────────────────────────────────────────────────

function NavBar({ idx, total, onNav, onDigAgain }: {
  idx:        number;
  total:      number;
  onNav:      (dir: -1 | 1) => void;
  onDigAgain: () => void;
}) {
  const btn: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
    background: "none", border: "none", cursor: "pointer", padding: "12px 0", color: "#0d0d0d",
  };
  const btnOff: React.CSSProperties = { ...btn, color: "#d0d0d0", cursor: "default" };

  return (
    <div className="dig-navbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px" }}>
      <button onClick={() => onNav(-1)} disabled={idx === 0} className="dig-nav-btn" style={idx === 0 ? btnOff : btn}>
        ← Previous
      </button>
      <button onClick={onDigAgain} className="dig-nav-btn" style={{ ...btn, color: ORANGE }}>
        Dig again ↺
      </button>
      <button onClick={() => onNav(1)} disabled={idx === total - 1} className="dig-nav-btn" style={idx === total - 1 ? btnOff : btn}>
        Next →
      </button>
    </div>
  );
}


// ─── Mode toggle ─────────────────────────────────────────────────────────────

type DigMode = "discover" | "explore" | "hallucinations";

function ModeToggle({ mode, onChange, disabled }: {
  mode:     DigMode;
  onChange: (m: DigMode) => void;
  disabled: boolean;
}) {
  const item = (m: DigMode, label: string) => {
    const active = mode === m;
    return (
      <button
        key={m}
        onClick={() => { if (!disabled && mode !== m) onChange(m); }}
        disabled={disabled}
        className="dig-mode-btn"
        style={{
          fontFamily: MONO,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "none",
          border: "none",
          borderBottom: `1.5px solid ${active ? ORANGE : "transparent"}`,
          padding: "6px 0",
          cursor: disabled || active ? "default" : "pointer",
          color: active ? "#0d0d0d" : "#bbbbbb",
          transition: "color 0.15s, border-color 0.15s",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="dig-mode-toggle" style={{ display: "flex", justifyContent: "center", gap: "24px", paddingTop: "14px" }}>
      {item("discover",      "Discover · Outside Collection")}
      {item("explore",       "Explore · Inside Collection")}
      {item("hallucinations","Hallucinations · Take the Trip")}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function DigClient({ username, displayLabel, avatarUrl, collectionCount, listsCount }: Props) {
  const [recs,          setRecs]          = useState<Recommendation[] | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [idx,           setIdx]           = useState(0);
  const [mode,          setMode]          = useState<DigMode>("discover");
  const [wantlistAdded, setWantlistAdded] = useState<Set<string>>(new Set());

  // Accumulates artists already shown this session so the API can exclude them
  const shownArtists = useRef<string[]>([]);

  // fetchKey drives all fetches. Incrementing `n` re-triggers the effect for
  // "dig again" without changing mode; swapping `mode` handles mode changes.
  const [fetchKey, setFetchKey] = useState<{ mode: DigMode; n: number }>({ mode: "discover", n: 0 });

  // All setState calls inside the effect are in async callbacks, never synchronously
  // in the effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: fetchKey.mode, previousArtists: shownArtists.current }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to get recommendations");
        const newRecs: Recommendation[] = data.recommendations;
        // Accumulate artists for future exclusion — reset only when mode changes
        for (const r of newRecs) {
          if (r.artist && !shownArtists.current.includes(r.artist)) {
            shownArtists.current.push(r.artist);
          }
        }
        setRecs(newRecs);
        setIdx(0);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchKey]);

  function handleModeChange(newMode: DigMode) {
    shownArtists.current = [];
    setMode(newMode);
    setLoading(true);
    setError(null);
    setRecs(null);
    setFetchKey({ mode: newMode, n: 0 });
  }

  function handleDigAgain() {
    setLoading(true);
    setError(null);
    setRecs(null);
    setFetchKey(prev => ({ ...prev, n: prev.n + 1 }));
  }

  function navigate(dir: -1 | 1) {
    const total = recs?.length ?? 1;
    setIdx(i => Math.min(Math.max(i + dir, 0), total - 1));
  }

  async function handleAddToWantlist(rec: Recommendation) {
    const key = `${rec.artist}||${rec.album}`;
    setWantlistAdded(prev => new Set(prev).add(key));
    const result = await addToWantlist(rec.artist, rec.album, rec.year);
    if (result?.error) {
      console.error(result.error);
      setWantlistAdded(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  const statNum: React.CSSProperties = {
    fontFamily: SERIF, fontSize: "24px", fontWeight: 400, color: "#0d0d0d",
  };
  const statLbl: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: "#aaaaaa", marginLeft: "9px",
  };

  return (
    <div className="dig-outer" style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#ffffff", overflow: "hidden" }}>

      <style>{`
        @keyframes dig-vinyl-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dig-arm-lower {
          0%, 22% { transform: rotate(-28deg); }
          100%    { transform: rotate(0deg); }
        }
        @keyframes dig-rec-enter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dig-vinyl-spin {
          transform-origin: 95px 115px;
          animation: dig-vinyl-spin 2.6s linear infinite;
        }
        .dig-arm-lower {
          transform-origin: 210px 30px;
          animation: dig-arm-lower 8s cubic-bezier(0.08, 0, 0.04, 1) forwards;
        }
        .dig-rec-enter {
          animation: dig-rec-enter 0.25s ease-out both;
        }

        /* ── Mobile responsive ── */
        @media (max-width: 767px) {
          /* Page scrolls on mobile instead of fixed-height viewport */
          .dig-outer {
            height: auto !important;
            min-height: 100dvh;
            overflow-x: hidden !important;
            overflow-y: auto !important;
          }
          .dig-main { overflow: visible !important; flex: none !important; }
          .dig-main-inner {
            padding-left: 16px !important;
            padding-right: 16px !important;
            overflow: visible !important;
            flex: none !important;
            max-width: 100% !important;
          }

          /* Header: title stacks on top, stats row below */
          .dig-header-inner {
            flex-wrap: wrap !important;
            padding: 14px 16px !important;
            gap: 6px 20px !important;
          }
          /* Title spans full width and moves to the top via order */
          .dig-header-title {
            order: -1 !important;
            flex: 0 0 100% !important;
            padding: 0 !important;
          }
          .dig-header-title h1 { font-size: 18px !important; }
          .dig-header-title p  { font-size: 8px !important; }
          /* Rules between stats and title disappear */
          .dig-header-rule { display: none !important; }
          /* Stat blocks shed padding and sit side-by-side */
          .dig-stat-side { padding: 0 !important; }
          .dig-stat-num  { font-size: 18px !important; }
          .dig-stat-lbl  { font-size: 9px !important; }

          /* Mode toggle: buttons share full width equally */
          .dig-mode-toggle {
            gap: 0 !important;
            padding-top: 10px !important;
          }
          .dig-mode-btn {
            flex: 1 !important;
            text-align: center !important;
            padding: 10px 6px !important;
            font-size: 8px !important;
            letter-spacing: 0.08em !important;
          }

          /* Sleeve card: single column, art on top */
          .dig-sleeve-card {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }
          .dig-sleeve-art {
            width: 100% !important;
            min-height: 0 !important;
            aspect-ratio: 1 / 1;
            max-height: 400px;
            overflow: hidden;
          }
          .dig-sleeve-text {
            padding: 20px 18px !important;
          }
          .dig-sleeve-text h2   { font-size: 18px !important; }
          .dig-artist-lbl        { font-size: 12px !important; }
          .dig-reason-txt        { font-size: 14px !important; }

          /* Links: single column, comfortable tap targets */
          .dig-links-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .dig-link-item  { font-size: 12px !important; line-height: 2.4 !important; min-height: 36px; display: flex !important; align-items: center !important; }

          /* Nav bar: equal thirds, 44px minimum tap height */
          .dig-navbar {
            padding-top: 14px !important;
            padding-bottom: 16px !important;
          }
          .dig-nav-btn {
            flex: 1 !important;
            min-height: 44px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 8px !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Main ── */}
      <main className="dig-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="dig-main-inner" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", padding: "0 40px 72px", overflow: "hidden" }}>

          <ModeToggle mode={mode} onChange={handleModeChange} disabled={loading} />

          {loading && <RecordSpinner />}

          {error && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "16px" }}>
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: 0 }}>{error}</p>
              <button onClick={handleDigAgain} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, cursor: "pointer", padding: "8px 16px" }}>
                Try again
              </button>
            </div>
          )}

          {recs && !loading && (
            <>
              <PositionIndicator idx={idx} total={recs.length} onNav={setIdx} />
              <SleeveCard
                key={`${idx}-${mode}`}
                rec={recs[idx]}
                mode={mode}
                onAddToWantlist={() => handleAddToWantlist(recs[idx])}
                wantlistAdded={wantlistAdded.has(`${recs[idx].artist}||${recs[idx].album}`)}
              />
              <NavBar idx={idx} total={recs.length} onNav={navigate} onDigAgain={handleDigAgain} />
            </>
          )}

        </div>
      </main>

    </div>
  );
}
