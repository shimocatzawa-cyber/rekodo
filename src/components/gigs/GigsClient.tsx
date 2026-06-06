"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";

const SERIF = "var(--font-editorial)";
const MONO = "var(--font-mono)";
const ORANGE = "#CC5500";

type TmVenue = { name: string; city?: { name: string } };
type GigEvent = {
  id: string;
  name: string;
  url: string;
  dates: { start: { localDate?: string; localTime?: string } };
  _embedded?: { venues?: TmVenue[] };
  _artistName: string;
};

type ApiResponse = {
  events: GigEvent[];
  city: string | null;
  artistCount: number;
  totalArtists: number;
};

function formatDate(localDate?: string): string {
  if (!localDate) return "Date TBC";
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function monthKey(localDate?: string): string {
  if (!localDate) return "Date TBC";
  const [y, m] = localDate.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("en-AU", { month: "long", year: "numeric" })
    .toUpperCase();
}

function groupByMonth(events: GigEvent[]): [string, GigEvent[]][] {
  const map = new Map<string, GigEvent[]>();
  for (const ev of events) {
    const key = monthKey(ev.dates?.start?.localDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return [...map.entries()];
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 0", borderBottom: "1px solid #f4f4f4" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 18, background: "#f0f0f0", borderRadius: 2, width: "55%" }} />
        <div style={{ height: 11, background: "#f4f4f4", borderRadius: 2, width: "38%" }} />
      </div>
      <div style={{ height: 11, background: "#f4f4f4", borderRadius: 2, width: 80 }} />
    </div>
  );
}

export default function GigsClient({
  username,
  displayLabel,
  avatarUrl,
}: {
  username: string;
  displayLabel?: string;
  avatarUrl?: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch("/api/gigs")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const grouped = data ? groupByMonth(data.events) : [];
  const hasEvents = (data?.events.length ?? 0) > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "64px 32px 120px" }}>

        {/* Page label */}
        <p style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#bbbbbb",
          marginBottom: 20,
        }}>
          Gigs · 公演
        </p>

        {/* Hero */}
        <div style={{ marginBottom: 64 }}>
          {loading ? (
            <div style={{
              fontFamily: SERIF,
              fontSize: "clamp(30px, 5vw, 50px)",
              lineHeight: 1.15,
              color: "#d0d0d0",
              fontWeight: 600,
            }}>
              Finding gigs near you…
            </div>
          ) : fetchError ? (
            <div style={{
              fontFamily: SERIF,
              fontSize: "clamp(26px, 4vw, 40px)",
              lineHeight: 1.2,
              color: "#0d0d0d",
              fontWeight: 600,
            }}>
              Could not load gigs right now.
            </div>
          ) : !data?.city ? (
            <div style={{
              fontFamily: SERIF,
              fontSize: "clamp(26px, 4vw, 42px)",
              lineHeight: 1.2,
              color: "#0d0d0d",
              fontWeight: 600,
            }}>
              Add your city in{" "}
              <Link href="/settings/profile" style={{ color: ORANGE, textDecoration: "none", borderBottom: `1.5px solid ${ORANGE}` }}>
                profile settings
              </Link>
              {" "}to see local gigs.
            </div>
          ) : data.artistCount > 0 ? (
            <div style={{
              fontFamily: SERIF,
              fontSize: "clamp(30px, 5vw, 50px)",
              lineHeight: 1.15,
              color: "#0d0d0d",
              fontWeight: 600,
            }}>
              <span style={{ color: ORANGE }}>{data.artistCount}</span>
              {" upcoming gig"}{data.artistCount !== 1 ? "s" : ""}
              <br />near <span style={{ color: ORANGE }}>{data.city}</span>
            </div>
          ) : (
            <div style={{
              fontFamily: SERIF,
              fontSize: "clamp(26px, 4vw, 42px)",
              lineHeight: 1.2,
              color: "#0d0d0d",
              fontWeight: 600,
            }}>
              No upcoming gigs<br />near <span style={{ color: ORANGE }}>{data.city}</span>
            </div>
          )}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ height: 9, background: "#f0f0f0", borderRadius: 2, width: 120 }} />
              <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
            </div>
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && data?.city && !hasEvents && (
          <p style={{
            fontFamily: MONO,
            fontSize: 12,
            color: "#aaaaaa",
            lineHeight: 1.9,
            letterSpacing: "0.03em",
          }}>
            No upcoming music events found near {data.city} right now.
          </p>
        )}

        {/* Event list grouped by month */}
        {!loading && hasEvents && (
          <div style={{ display: "flex", flexDirection: "column", gap: 52 }}>
            {grouped.map(([month, events]) => (
              <section key={month}>
                {/* Month divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                  <span style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "#aaaaaa",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {month}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
                </div>

                {/* Events */}
                <div>
                  {events.map((ev, idx) => {
                    const venue = ev._embedded?.venues?.[0];
                    const venueName = venue?.name ?? "";
                    const venueCity = venue?.city?.name ?? "";
                    const locationStr = [venueName, venueCity].filter(Boolean).join(" · ");

                    return (
                      <div
                        key={ev.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "18px 0",
                          borderBottom: idx < events.length - 1 ? "1px solid #f4f4f4" : "none",
                        }}
                      >
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: SERIF,
                            fontSize: 19,
                            fontWeight: 600,
                            color: "#0d0d0d",
                            lineHeight: 1.2,
                            marginBottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {ev._artistName}
                          </div>
                          {locationStr && (
                            <div style={{
                              fontFamily: MONO,
                              fontSize: 11,
                              color: "#888888",
                              letterSpacing: "0.04em",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {locationStr}
                            </div>
                          )}
                          <div style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            color: "#bbbbbb",
                            letterSpacing: "0.04em",
                            marginTop: 2,
                          }}>
                            {formatDate(ev.dates?.start?.localDate)}
                          </div>
                        </div>

                        {/* Ticket CTA */}
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: MONO,
                            fontSize: 10,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: ORANGE,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            borderBottom: `1px solid ${ORANGE}`,
                            paddingBottom: 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          Get tickets ↗
                        </a>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
