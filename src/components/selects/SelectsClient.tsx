"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AppNav from "@/components/AppNav";
import { useUrlTab } from "@/lib/useUrlTab";
import SpotlightView from "./SpotlightView";
import SpotlightArchivePicker from "./SpotlightArchivePicker";
import type { Spotlight, SpotlightSummary } from "@/lib/spotlights/types";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

// ─── Selects tabs ─────────────────────────────────────────────────────────────

type SelectsTab = "artist" | "label" | "live";

const TAB_KEYS: SelectsTab[] = ["artist", "label", "live"];

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

// ─── Shared spotlight section (handles mobile select + desktop picker) ────────

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function SpotlightSection({
  state,
  onSelect,
}: {
  state: SpotlightState;
  onSelect: (s: Spotlight) => void;
}) {
  async function handleEditionChange(id: string) {
    if (id === state.selected?.id) return;
    const res = await fetch(`/api/spotlights/${id}`);
    if (!res.ok) return;
    const data = await res.json() as Spotlight;
    onSelect(data);
    const url = new URL(window.location.href);
    if (id === state.current?.id) url.searchParams.delete("spotlight");
    else url.searchParams.set("spotlight", id);
    window.history.replaceState(null, "", url.toString());
  }

  if (state.loading) return <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>Loading…</p>;
  if (!state.selected) return <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>No spotlight available.</p>;

  const allOptions = [
    ...(state.current ? [{ id: state.current.id, label: formatMonth(state.current.month) }] : []),
    ...state.archive.map(a => ({ id: a.id, label: formatMonth(a.month) })),
  ];

  return (
    <>
      {/* Mobile edition selector — hidden on desktop via CSS */}
      <div className="spotlight-mobile-select" style={{ display: "none", marginBottom: 24 }}>
        <label style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", display: "block", marginBottom: 8 }}>
          Edition
        </label>
        <select
          value={state.selected.id}
          onChange={e => handleEditionChange(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em",
            color: INK, background: "#ffffff",
            border: `1px solid ${RULE}`, padding: "6px 10px",
            cursor: "pointer", appearance: "auto", width: "100%",
          }}
        >
          {allOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop + mobile content */}
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        <div className="archive-picker-desktop">
          <SpotlightArchivePicker
            current={state.current}
            currentId={state.current?.id ?? null}
            selectedId={state.selected.id}
            archive={state.archive}
            onSelect={onSelect}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SpotlightView spotlight={state.selected} />
        </div>
      </div>
    </>
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
    { key: "artist", label: t("artistSpotlight") },
    { key: "label",  label: t("labelSpotlight") },
    { key: "live",   label: t("live") },
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
          .archive-picker-desktop { display: none !important; }
          .spotlight-mobile-select { display: block !important; }
          .nr-date-picker-desktop { display: none !important; }
          .nr-mobile-date-select { display: block !important; }
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
        {activeTab === "live" ? (
          <LiveSection />
        ) : activeTab === "artist" ? (
          <SpotlightSection state={artistState} onSelect={setArtistSelected} />
        ) : (
          <SpotlightSection state={labelState} onSelect={setLabelSelected} />
        )}
      </main>
    </div>
  );
}
