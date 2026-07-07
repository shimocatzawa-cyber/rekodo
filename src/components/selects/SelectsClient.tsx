"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/client";
import { useUrlTab } from "@/lib/useUrlTab";
import SpotlightView from "./SpotlightView";
import SpotlightArchivePicker from "./SpotlightArchivePicker";
import type { Spotlight, SpotlightSummary } from "@/lib/spotlights/types";

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
  buy_url: string | null;
  price: string | null;
  release_date: string | null;
  created_at: string | null;
};

// ─── Selects tabs ─────────────────────────────────────────────────────────────

type SelectsTab = "new_releases" | "artist" | "label" | "live";

const TAB_KEYS: SelectsTab[] = ["artist", "label", "new_releases", "live"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function senderToUrl(sender: string | null): string | null {
  if (!sender) return null;
  const emailMatch = sender.match(/<([^>]+@[^>]+)>/) ?? sender.match(/(\S+@\S+)/);
  if (!emailMatch) return null;
  let domain = ((emailMatch[1] ?? emailMatch[0]).trim()).split("@")[1] ?? "";
  // Strip common transactional subdomains so "newsletter.boomkat.com" → "boomkat.com"
  domain = domain.replace(/^(newsletter|mail|emails?|news|info|noreply|no-reply|hello|support)\./i, "");
  return domain ? `https://${domain}` : null;
}

function senderDisplayName(sender: string | null): string {
  if (!sender) return "";
  const m = sender.match(/^([^<"]+?)\s*</);
  return m ? m[1].trim() : "";
}

// ─── Release row ─────────────────────────────────────────────────────────────

function ReleaseDateBox({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <div style={{ width: "48px", flexShrink: 0 }} />;
  const d = new Date(dateStr);
  const day = d.getDate();
  const mon = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  return (
    <div style={{
      flexShrink: 0, width: "48px", height: "48px",
      border: `1px solid ${RULE}`, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "1px",
    }}>
      <span style={{ fontFamily: MONO, fontSize: "16px", fontWeight: 600, lineHeight: 1, color: INK }}>{day}</span>
      <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", color: "#aaaaaa" }}>{mon}</span>
    </div>
  );
}

function ReleaseRow({ item }: { item: LabelFeedItem }) {
  const [hovered, setHovered] = useState(false);
  const sourceUrl   = senderToUrl(item.sender);
  const sourceName  = senderDisplayName(item.sender);
  const buyHref     = item.buy_url
    ?? sourceUrl
    ?? `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist ?? ""} ${item.album ?? ""}`)}&type=release`;

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
      {/* Date box */}
      <ReleaseDateBox dateStr={item.received_at} />

      {/* Release info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, margin: "0 0 2px 0", lineHeight: 1.2 }}>
          {item.artist}
        </p>
        {item.album && (
          <p style={{ fontFamily: SERIF, fontSize: "0.85rem", fontWeight: 400, fontStyle: "italic", color: INK, margin: "0 0 5px 0", lineHeight: 1.2 }}>
            {item.album}
          </p>
        )}
        {(item.label || item.format) && (
          <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: INK, margin: "0 0 3px 0" }}>
            {[item.label, item.format].filter(Boolean).join(" · ")}
          </p>
        )}
        {item.release_date && (
          <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: "#888", margin: "0 0 3px 0" }}>
            {new Date(item.release_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
        {item.tags && item.tags.length > 0 && (
          <p style={{ fontFamily: MONO, fontSize: "0.55rem", color: ORANGE, margin: 0 }}>
            {item.tags.join(", ")}
          </p>
        )}
      </div>

      {/* Buy link */}
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        {item.price && (
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em", color: INK, margin: "0 0 4px 0" }}>
            {item.price}
          </p>
        )}
        <a
          href={buyHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, textDecoration: "none", display: "block" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
        >
          BUY →
        </a>
        {sourceName && (
          <p style={{ fontFamily: MONO, fontSize: "0.5rem", color: "#aaaaaa", margin: "3px 0 0", letterSpacing: "0.04em" }}>
            {sourceName}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 0", borderBottom: `1px solid ${RULE}` }}>
      <div className="nr-shimmer" style={{ flexShrink: 0, width: "48px", height: "48px", background: "#e8e3dc" }} />
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("label_feed")
      .select("*")
      .not("artist", "is", null)
      .neq("artist", "")
      .not("album", "is", null)
      .neq("album", "")
      .gte("received_at", thirtyDaysAgo)
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

function formatGigDate(localDate?: string, fallback = "Date TBC"): string {
  if (!localDate) return fallback;
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function gigMonthKey(localDate?: string, fallback = "Date TBC"): string {
  if (!localDate) return fallback;
  const [y, m] = localDate.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" })
    .toUpperCase();
}

function groupByMonth(events: GigEvent[], fallback: string): [string, GigEvent[]][] {
  const map = new Map<string, GigEvent[]>();
  for (const ev of events) {
    const key = gigMonthKey(ev.dates?.start?.localDate, fallback);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return [...map.entries()];
}

function LiveSection() {
  const t = useTranslations("selects");
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

  const dateTbc = t("dateTbc");
  const grouped  = data ? groupByMonth(data.events, dateTbc) : [];
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
            <Link href="/settings/profile" style={{ color: ORANGE, textDecoration: "none", borderBottom: `1.5px solid ${ORANGE}` }}>
              profile settings
            </Link>
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
                          {formatGigDate(ev.dates?.start?.localDate, dateTbc)}
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  username:     string;
  displayLabel: string;
  avatarUrl:    string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SpotlightState {
  current: Spotlight | null;
  selected: Spotlight | null;
  archive: SpotlightSummary[];
  loading: boolean;
}

function useSpotlight(type: "artist" | "label", active: boolean) {
  const [state, setState] = useState<SpotlightState>({ current: null, selected: null, archive: [], loading: true });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    fetch(`/api/spotlights?type=${type}`)
      .then(r => r.json())
      .then((data: { current: Spotlight | null; archive: SpotlightSummary[] }) => {
        if (cancelled) return;
        // Check for ?spotlight=<id> in URL
        const params = new URLSearchParams(window.location.search);
        const spotlightParam = params.get("spotlight");
        let selected = data.current;
        if (spotlightParam) {
          const archived = data.archive.find(a => a.id === spotlightParam);
          if (archived) {
            fetch(`/api/spotlights/${spotlightParam}`)
              .then(r => r.json())
              .then((full: Spotlight) => {
                if (!cancelled) setState({ current: data.current, selected: full, archive: data.archive, loading: false });
              })
              .catch(() => { if (!cancelled) setState({ current: data.current, selected, archive: data.archive, loading: false }); });
            return;
          }
        }
        setState({ current: data.current, selected, archive: data.archive, loading: false });
      })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, [type, active]);

  return [state, (s: Spotlight) => setState(prev => ({ ...prev, selected: s }))] as const;
}

export default function SelectsClient({ username, displayLabel, avatarUrl }: Props) {
  const t = useTranslations("selects");
  const TABS: { key: SelectsTab; label: string }[] = [
    { key: "artist",       label: t("artistSpotlight") },
    { key: "label",        label: t("labelSpotlight") },
    { key: "new_releases", label: t("newReleases") },
    { key: "live",         label: t("live") },
  ];
  const [activeTab, setActiveTab] = useUrlTab<SelectsTab>("tab", TAB_KEYS, "artist");

  const [artistState, setArtistSelected] = useSpotlight("artist", activeTab === "artist");
  const [labelState,  setLabelSelected]  = useSpotlight("label",  activeTab === "label");

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
      <div className="rk-selects-tabs" style={{
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

      <main className="rk-selects-main" style={{ padding: "36px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "new_releases" ? (
          <div style={{ maxWidth: 600, margin: "0 auto" }}><NewReleasesSection /></div>
        ) : activeTab === "live" ? (
          <LiveSection />
        ) : activeTab === "artist" ? (
          <>
            {artistState.loading && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>Loading…</p>
            )}
            {!artistState.loading && artistState.selected && (
              <>
                <SpotlightArchivePicker
                  current={artistState.current}
                  currentId={artistState.current?.id ?? null}
                  selectedId={artistState.selected.id}
                  archive={artistState.archive}
                  onSelect={setArtistSelected}
                />
                <SpotlightView spotlight={artistState.selected} />
              </>
            )}
            {!artistState.loading && !artistState.selected && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>No spotlight available.</p>
            )}
          </>
        ) : (
          <>
            {labelState.loading && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>Loading…</p>
            )}
            {!labelState.loading && labelState.selected && (
              <>
                <SpotlightArchivePicker
                  current={labelState.current}
                  currentId={labelState.current?.id ?? null}
                  selectedId={labelState.selected.id}
                  archive={labelState.archive}
                  onSelect={setLabelSelected}
                />
                <SpotlightView spotlight={labelState.selected} />
              </>
            )}
            {!labelState.loading && !labelState.selected && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>No spotlight available.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
