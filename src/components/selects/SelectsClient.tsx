"use client";

import { useState, useEffect } from "react";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

// ─── Label feed types ─────────────────────────────────────────────────────────

type LabelFeedItem = {
  id: string;
  gmail_message_id: string | null;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  artist: string | null;
  album: string | null;
  release_type: "new_release" | "repress" | "preorder" | "announcement" | "unknown" | null;
  format: string | null;
  label: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string | null;
};

// ─── Selects tabs ─────────────────────────────────────────────────────────────

type SelectsTab = "new_releases" | "artist" | "label" | "live";

const TABS: { key: SelectsTab; label: string }[] = [
  { key: "artist",       label: "Artist Spotlight" },
  { key: "label",        label: "Label Spotlight"  },
  { key: "new_releases", label: "New Releases"      },
  { key: "live",         label: "Live"              },
];

// ─── Release row ─────────────────────────────────────────────────────────────

function ReleaseRow({ item }: { item: LabelFeedItem }) {
  const [hovered, setHovered] = useState(false);
  const buyHref = `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist ?? ""} ${item.album ?? ""}`)}&type=release`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "14px 0", borderBottom: `1px solid ${RULE}`,
        background: hovered ? "#f7f5f0" : "transparent",
      }}
    >
      {/* Release info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, margin: "0 0 2px 0", lineHeight: 1.2 }}>
          {item.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "0.85rem", fontWeight: 400, fontStyle: "italic", color: INK, margin: "0 0 5px 0", lineHeight: 1.2 }}>
          {item.album}
        </p>
        {(item.label || item.format) && (
          <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: INK, margin: "0 0 3px 0" }}>
            {[item.label, item.format].filter(Boolean).join(" · ")}
          </p>
        )}
        {item.tags && item.tags.length > 0 && (
          <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: ORANGE, margin: 0 }}>
            {item.tags.join(", ")}
          </p>
        )}
      </div>

      {/* Buy link */}
      <a
        href={buyHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none", flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
      >
        BUY →
      </a>
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 0", borderBottom: `1px solid ${RULE}` }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "7px" }}>
        <div className="nr-shimmer" style={{ height: "0.95rem", width: "32%", background: "#e8e3dc" }} />
        <div className="nr-shimmer" style={{ height: "0.85rem", width: "48%", background: "#e8e3dc" }} />
        <div className="nr-shimmer" style={{ height: "0.6rem",  width: "22%", background: "#e8e3dc" }} />
      </div>
    </div>
  );
}

// ─── New Releases section ─────────────────────────────────────────────────────

function NewReleasesSection() {
  const [items, setItems]         = useState<LabelFeedItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("label_feed")
      .select("*")
      .not("artist", "is", null)
      .neq("artist", "")
      .not("album", "is", null)
      .neq("album", "")
      .order("received_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setFetchError(error.message);
        else setItems((data as unknown as LabelFeedItem[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section>
        <div style={{ borderTop: `1px solid ${RULE}` }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </section>
    );
  }

  if (fetchError) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#cc3300", textAlign: "center", padding: "4rem 0", margin: 0 }}>
        Feed error: {fetchError}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 0" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: "0 0 6px 0" }}>No releases yet.</p>
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: 0 }}>
          rekōdo checks your label subscriptions daily — new releases will appear here.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div style={{ borderTop: `1px solid ${RULE}` }}>
        {items.map(item => <ReleaseRow key={item.id} item={item} />)}
      </div>
    </section>
  );
}

// ─── Live / Gigs section ─────────────────────────────────────────────────────

type TmVenue = { name: string; city?: { name: string } };
type GigEvent = {
  id: string;
  name: string;
  url: string;
  dates: { start: { localDate?: string; localTime?: string } };
  _embedded?: { venues?: TmVenue[] };
  _artistName: string;
};
type GigsApiResponse = {
  events: GigEvent[];
  city: string | null;
  artistCount: number;
  totalArtists: number;
};

function formatGigDate(localDate?: string): string {
  if (!localDate) return "Date TBC";
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function gigMonthKey(localDate?: string): string {
  if (!localDate) return "Date TBC";
  const [y, m] = localDate.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("en-AU", { month: "long", year: "numeric" })
    .toUpperCase();
}

function groupByMonth(events: GigEvent[]): [string, GigEvent[]][] {
  const map = new Map<string, GigEvent[]>();
  for (const ev of events) {
    const key = gigMonthKey(ev.dates?.start?.localDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return [...map.entries()];
}

function LiveSection() {
  const [data, setData]           = useState<GigsApiResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch("/api/gigs")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const grouped  = data ? groupByMonth(data.events) : [];
  const hasEvents = (data?.events.length ?? 0) > 0;

  return (
    <section>
      {/* Hero heading */}
      <div style={{ marginBottom: 48 }}>
        {loading ? (
          <div style={{ fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.15, color: "#d0d0d0", fontWeight: 600 }}>
            Finding gigs near you…
          </div>
        ) : fetchError ? (
          <div style={{ fontFamily: SERIF, fontSize: "clamp(22px, 3vw, 36px)", lineHeight: 1.2, color: INK, fontWeight: 600 }}>
            Could not load gigs right now.
          </div>
        ) : !data?.city ? (
          <div style={{ fontFamily: SERIF, fontSize: "clamp(22px, 3vw, 38px)", lineHeight: 1.2, color: INK, fontWeight: 600 }}>
            Add your city in{" "}
            <a href="/settings/profile" style={{ color: ORANGE, textDecoration: "none", borderBottom: `1.5px solid ${ORANGE}` }}>
              profile settings
            </a>
            {" "}to see local gigs.
          </div>
        ) : data.artistCount > 0 ? (
          <div style={{ fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.15, color: INK, fontWeight: 600 }}>
            <span style={{ color: ORANGE }}>{data.artistCount}</span>
            {" upcoming gig"}{data.artistCount !== 1 ? "s" : ""}
            <br />near <span style={{ color: ORANGE }}>{data.city}</span>
          </div>
        ) : (
          <div style={{ fontFamily: SERIF, fontSize: "clamp(22px, 3vw, 38px)", lineHeight: 1.2, color: INK, fontWeight: 600 }}>
            No upcoming gigs<br />near <span style={{ color: ORANGE }}>{data.city}</span>
          </div>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ height: 9, background: "#f0f0f0", width: 120 }} />
            <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 0", borderBottom: `1px solid ${RULE}` }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="nr-shimmer" style={{ height: 18, background: "#f0ede8", width: "55%" }} />
                <div className="nr-shimmer" style={{ height: 11, background: "#f0ede8", width: "38%" }} />
              </div>
              <div className="nr-shimmer" style={{ height: 11, background: "#f0ede8", width: 80 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data?.city && !hasEvents && (
        <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: "#aaaaaa", lineHeight: 1.9, letterSpacing: "0.03em" }}>
          No upcoming music events found near {data.city} right now.
        </p>
      )}

      {/* Events grouped by month */}
      {!loading && hasEvents && (
        <div style={{ display: "flex", flexDirection: "column", gap: 52 }}>
          {grouped.map(([month, events]) => (
            <div key={month}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", color: "#aaaaaa", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {month}
                </span>
                <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
              </div>
              <div>
                {events.map((ev, idx) => {
                  const venue       = ev._embedded?.venues?.[0];
                  const locationStr = [venue?.name, venue?.city?.name].filter(Boolean).join(" · ");
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "18px 0",
                        borderBottom: idx < events.length - 1 ? `1px solid ${RULE}` : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: INK, lineHeight: 1.2, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev._artistName}
                        </div>
                        {locationStr && (
                          <div style={{ fontFamily: MONO, fontSize: 11, color: "#888888", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {locationStr}
                          </div>
                        )}
                        <div style={{ fontFamily: MONO, fontSize: 11, color: "#bbbbbb", letterSpacing: "0.04em", marginTop: 2 }}>
                          {formatGigDate(ev.dates?.start?.localDate)}
                        </div>
                      </div>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0, borderBottom: `1px solid ${ORANGE}`, paddingBottom: 1 }}
                      >
                        Get tickets ↗
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Placeholder image ────────────────────────────────────────────────────────

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", minHeight: "inherit",
      background: "#0e0e0e",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg viewBox="0 0 400 400" width="100%" height="100%"
        preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: "block" }}>
        <rect width="400" height="400" fill="#0e0e0e" />
        {Array.from({ length: 32 }, (_, i) => (
          <line key={i} x1="0" y1={i * 13} x2="400" y2={i * 13}
            stroke="#161616" strokeWidth="0.6" />
        ))}
        <text x="200" y="218" textAnchor="middle"
          fontFamily="var(--font-editorial)" fontSize="64"
          fill="#1e1e1e" letterSpacing="-2">
          {label.slice(0, 2).toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

// ─── Content data ─────────────────────────────────────────────────────────────

type SpotlightData = {
  eyebrow:  string;
  name:     string;
  meta:     string[];
  body:     string[];
  links:    { label: string; href: string }[];
  imageUrl: string | null;
};

const SPOTLIGHT: Record<"artist" | "label", SpotlightData> = {
  artist: {
    eyebrow:  "ARTIST SELECT - JUNE",
    name:     "Alice Coltrane",
    meta:     ["Jazz · Spiritual · Avant-Garde", "1937 – 2007 · Detroit"],
    body: [
      "Few artists reshaped the grammar of the instrument as radically as Alice Coltrane. Moving from hard bop to free jazz to a transcendent spiritual music all her own, her recordings for Impulse! in the early 1970s — Ptah, the El Daoud; Journey in Satchidananda; A Monastic Trio — remain among the most singular documents in the American catalogue.",
      "Her later work, produced privately for her Sai Anantam Ashram in California and distributed almost by hand, has become one of the great rediscoveries of recent years. The archival compilations Astral Meditations and World Spirituality Classics 1: The Ecstatic Music of Alice Coltrane Turiyasangitananda introduced these recordings to a new generation.",
    ],
    links: [
      { label: "Discogs ↗",    href: "https://www.discogs.com/artist/266049-Alice-Coltrane" },
      { label: "Wikipedia ↗",  href: "https://en.wikipedia.org/wiki/Alice_Coltrane" },
    ],
    imageUrl: null,
  },
  label: {
    eyebrow:  "LABEL SELECT - JUNE",
    name:     "Blue Note Records",
    meta:     ["Jazz · Soul · Funk · Avant-Garde", "Founded 1939 · New York"],
    body: [
      "Blue Note was not merely a record label — it was a commitment to a particular idea about what jazz could be. Founded by Alfred Lion and Francis Wolff in 1939, it became the home of hard bop, post-bop, and some of the most celebrated album artwork in recorded music history, under the eye of designer Reid Miles.",
      "Sonny Rollins, Thelonious Monk, Miles Davis, Lee Morgan, Herbie Hancock, Wayne Shorter — the Blue Note catalogue reads like a map of an entire era. Its pressings, particularly the original New York issues with Van Gelder's lacquer etchings, remain among the most sought-after in any crate.",
    ],
    links: [
      { label: "Discogs ↗",       href: "https://www.discogs.com/label/39-Blue-Note-Records" },
      { label: "Official site ↗", href: "https://www.bluenote.com" },
    ],
    imageUrl: null,
  },
};

// ─── Main spotlight card ──────────────────────────────────────────────────────

function SpotlightCard({ data, tab }: { data: SpotlightData; tab: "artist" | "label" }) {
  return (
    <div
      className="selects-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
        minHeight: 460,
      }}
    >
      {/* ── Left: photo ── */}
      <div className="selects-img" style={{ background: "#0e0e0e", overflow: "hidden", minHeight: 460 }}>
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.imageUrl}
            alt={data.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <PlaceholderPanel label={data.name} />
        )}
      </div>

      {/* ── Right: editorial ── */}
      <div
        className="selects-text"
        style={{ padding: "28px 32px", display: "flex", flexDirection: "column", background: "#ffffff" }}
      >
        {/* Eyebrow */}
        <p style={{
          fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.16em",
          textTransform: "uppercase", color: ORANGE, margin: "0 0 20px",
        }}>
          {data.eyebrow}
        </p>

        {/* Name */}
        <h2 style={{
          fontFamily: SERIF, fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)", fontWeight: 400,
          color: INK, lineHeight: 1.1, letterSpacing: "-0.02em",
          margin: "0 0 14px",
        }}>
          {data.name}
        </h2>

        {/* Meta tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
          {data.meta.map((m, i) => (
            <p key={i} style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em",
              color: "#888888", margin: 0,
            }}>
              {m}
            </p>
          ))}
        </div>

        {/* Rule */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", marginBottom: "20px" }} />

        {/* Body */}
        <div style={{ flex: 1 }}>
          {data.body.map((para, i) => (
            <p key={i} style={{
              fontFamily: SERIF, fontSize: "0.85rem", fontStyle: "italic",
              color: "#505050", lineHeight: 1.75,
              margin: i < data.body.length - 1 ? "0 0 14px" : 0,
            }}>
              {para}
            </p>
          ))}
        </div>

        {/* Links — pinned to bottom */}
        <div style={{
          marginTop: "24px", paddingTop: "16px",
          borderTop: `1px solid ${RULE}`,
          display: "flex", gap: "20px", flexWrap: "wrap",
        }}>
          {data.links.map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em",
                color: ORANGE, textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  username:     string;
  displayLabel: string;
  avatarUrl:    string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SelectsClient({ username, displayLabel, avatarUrl }: Props) {
  const [activeTab, setActiveTab] = useState<SelectsTab>("artist");

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <style>{`
        @keyframes nr-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .nr-shimmer { animation: nr-pulse 1.4s ease-in-out infinite; }

        @media (max-width: 767px) {
          .selects-card {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }
          .selects-img {
            min-height: 0 !important;
            aspect-ratio: 1 / 1;
            max-height: 360px;
          }
          .selects-text {
            padding: 24px 20px !important;
          }
        }
      `}</style>

      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* ── Sub-navigation ── */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "24px",
        paddingTop: "14px", paddingBottom: "2px",
        background: "#ffffff",
      }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", background: "none", border: "none",
              borderBottom: `1.5px solid ${activeTab === key ? ORANGE : "transparent"}`,
              padding: "6px 0",
              color: activeTab === key ? INK : "#bbbbbb",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <main style={{ padding: "36px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "new_releases" ? (
          <div style={{ maxWidth: 600, margin: "0 auto" }}><NewReleasesSection /></div>
        ) : activeTab === "live" ? (
          <LiveSection />
        ) : (
          <>
            <SpotlightCard data={SPOTLIGHT[activeTab]} tab={activeTab} />

            {/* Coming next */}
            <div style={{
              marginTop: "48px",
              paddingTop: "24px",
              borderTop: `1px solid ${RULE}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <p style={{
                fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.12em",
                textTransform: "uppercase", color: "#bbbbbb", margin: 0,
              }}>
                More {activeTab === "artist" ? "artist" : "label"} spotlights coming soon
              </p>
              <span style={{
                fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em",
                textTransform: "uppercase", color: INK,
                border: `1px solid ${RULE}`,
                padding: "0.2rem 0.6rem",
              }}>
                01 / —
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
