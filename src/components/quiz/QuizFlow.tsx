"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

type DiscogsResult = {
  id:     number;
  title:  string;
  year?:  string;
  thumb?: string;
};

type QuizPick = {
  artist: string;
  album:  string;
  year:   number | null;
};

function parseTitle(title: string): { artist: string; album: string } {
  const idx = title.indexOf(" - ");
  if (idx === -1) return { artist: "", album: title };
  return { artist: title.slice(0, idx), album: title.slice(idx + 3) };
}

const MOOD_OPTIONS = [
  { value: "energised",     label: "Energised & social" },
  { value: "introspective", label: "Introspective & late night" },
  { value: "background",    label: "Background & ambient" },
  { value: "shifting",      label: "Shifting — it depends" },
];

const DEPTH_OPTIONS = [
  { value: "deep",     label: "Deep into one artist at a time" },
  { value: "wide",     label: "Wide across many styles" },
  { value: "scene",    label: "Following a scene or movement" },
  { value: "surprise", label: "Whatever surprises me" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em",
  border: "1px solid #e0e0da", padding: "10px 14px", outline: "none",
  background: "#ffffff", color: "#0d0d0d",
};

const btnPrimary: React.CSSProperties = {
  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
  background: ORANGE, color: "#ffffff", border: "none", padding: "11px 24px",
  cursor: "pointer", display: "inline-block",
};

const btnSecondary: React.CSSProperties = {
  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em",
  background: "none", color: "#aaaaaa", border: "none", padding: "0",
  cursor: "pointer",
};

export default function QuizFlow() {
  const router = useRouter();
  const [step,         setStep]         = useState<1 | 2 | 3>(1);
  const [picks,        setPicks]        = useState<QuizPick[]>([]);
  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState<DiscogsResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [mood,         setMood]         = useState<string | null>(null);
  const [depthBreadth, setDepthBreadth] = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/discogs/search?q=${encodeURIComponent(q.trim())}&mode=record`);
        const json = await res.json() as { results?: DiscogsResult[] };
        setResults(json.results ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  function addPick(r: DiscogsResult) {
    if (picks.length >= 5) return;
    const { artist, album } = parseTitle(r.title);
    if (picks.some(p => p.artist === artist && p.album === album)) return;
    const year = r.year ? parseInt(r.year, 10) : null;
    setPicks(prev => [...prev, { artist, album, year: isNaN(year!) ? null : year }]);
    setQuery("");
    setResults([]);
  }

  function removePick(idx: number) {
    setPicks(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await fetch("/api/collection/quiz-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          top5_releases: picks,
          mood_context:  mood,
          depth_breadth: depthBreadth,
        }),
      });
      router.push("/dig");
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f8f4", display: "flex", flexDirection: "column", alignItems: "center" }}>

      {/* Header */}
      <div style={{ width: "100%", padding: "28px 32px 0", boxSizing: "border-box" }}>
        <a href="/collection" style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: ORANGE, textDecoration: "none" }}>
          rekōdo
        </a>
      </div>

      {/* Content */}
      <div style={{ width: "100%", maxWidth: "560px", padding: "48px 24px 80px", boxSizing: "border-box" }}>

        {/* Step 1 — Pick albums */}
        {step === 1 && (
          <>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px" }}>
              Step 1 of 3
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: "26px", fontWeight: 400, color: "#0d0d0d", margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
              Pick up to 5 records that define your taste.
            </h1>
            <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#aaaaaa", margin: "0 0 36px", lineHeight: 1.7 }}>
              Search by artist or album name. You can skip this if you&apos;re not sure yet.
            </p>

            {/* Picks so far */}
            {picks.length > 0 && (
              <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {picks.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#ffffff", border: "1px solid #e0e0da" }}>
                    <div>
                      <span style={{ fontFamily: MONO, fontSize: "11px", color: "#0d0d0d" }}>{p.artist}</span>
                      <span style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}> — {p.album}</span>
                      {p.year && <span style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", marginLeft: "6px" }}>({p.year})</span>}
                    </div>
                    <button onClick={() => removePick(i)} style={{ ...btnSecondary, fontSize: "11px" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            {picks.length < 5 && (
              <div style={{ position: "relative", marginBottom: "32px" }}>
                <input
                  type="text"
                  placeholder={picks.length === 0 ? "Search for an album or artist…" : `Add another (${picks.length}/5)…`}
                  value={query}
                  onChange={e => search(e.target.value)}
                  style={inputStyle}
                />
                {(searching || results.length > 0) && (
                  <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#ffffff", border: "1px solid #e0e0da", zIndex: 10, maxHeight: "280px", overflowY: "auto" }}>
                    {searching && (
                      <div style={{ padding: "12px 14px", fontFamily: MONO, fontSize: "10px", color: "#aaaaaa" }}>Searching…</div>
                    )}
                    {!searching && results.slice(0, 8).map(r => {
                      const { artist, album } = parseTitle(r.title);
                      return (
                        <button
                          key={r.id}
                          onClick={() => addPick(r)}
                          style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f0f0eb", cursor: "pointer", textAlign: "left" }}
                        >
                          {r.thumb && (
                            <img src={r.thumb} alt="" width={32} height={32} style={{ flexShrink: 0, objectFit: "cover" }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: MONO, fontSize: "11px", color: "#0d0d0d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist}</div>
                            <div style={{ fontFamily: MONO, fontSize: "10px", color: "#aaaaaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album}{r.year ? ` (${r.year})` : ""}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <button
                onClick={() => setStep(2)}
                style={btnPrimary}
              >
                {picks.length > 0 ? "Continue →" : "Skip for now →"}
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Mood context */}
        {step === 2 && (
          <>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px" }}>
              Step 2 of 3
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: "26px", fontWeight: 400, color: "#0d0d0d", margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
              When you spin records, what are you usually in the mood for?
            </h1>
            <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#aaaaaa", margin: "0 0 36px", lineHeight: 1.7 }}>
              Pick the one that feels most true.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "36px" }}>
              {MOOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMood(opt.value)}
                  style={{
                    fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em",
                    padding: "14px 20px", border: "1px solid",
                    borderColor: mood === opt.value ? ORANGE : "#e0e0da",
                    background: mood === opt.value ? "#fff8f4" : "#ffffff",
                    color: mood === opt.value ? ORANGE : "#0d0d0d",
                    cursor: "pointer", textAlign: "left", transition: "all 0.1s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <button onClick={() => setStep(1)} style={btnSecondary}>← Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!mood}
                style={{ ...btnPrimary, opacity: mood ? 1 : 0.4, cursor: mood ? "pointer" : "default" }}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Depth/breadth */}
        {step === 3 && (
          <>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: ORANGE, margin: "0 0 16px" }}>
              Step 3 of 3
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: "26px", fontWeight: 400, color: "#0d0d0d", margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
              How do you tend to explore music?
            </h1>
            <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#aaaaaa", margin: "0 0 36px", lineHeight: 1.7 }}>
              Pick the one that sounds most like you.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "36px" }}>
              {DEPTH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDepthBreadth(opt.value)}
                  style={{
                    fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em",
                    padding: "14px 20px", border: "1px solid",
                    borderColor: depthBreadth === opt.value ? ORANGE : "#e0e0da",
                    background: depthBreadth === opt.value ? "#fff8f4" : "#ffffff",
                    color: depthBreadth === opt.value ? ORANGE : "#0d0d0d",
                    cursor: "pointer", textAlign: "left", transition: "all 0.1s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <button onClick={() => setStep(2)} style={btnSecondary}>← Back</button>
              <button
                onClick={handleSubmit}
                disabled={!depthBreadth || submitting}
                style={{ ...btnPrimary, opacity: (depthBreadth && !submitting) ? 1 : 0.4, cursor: (depthBreadth && !submitting) ? "pointer" : "default" }}
              >
                {submitting ? "Setting up…" : "Get my starter picks →"}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
