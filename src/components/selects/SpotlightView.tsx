"use client";

import { useState, useEffect } from "react";
import type { Spotlight } from "@/lib/spotlights/types";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em",
      textTransform: "uppercase", color: ORANGE, margin: "0 0 16px", fontWeight: 400,
    }}>
      {children}
    </p>
  );
}

function SpotlightPanel({ spotlight }: { spotlight: Spotlight }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgUrl(null);
    setFailed(false);

    // Use manual image override when set in meta
    if (spotlight.meta.image_url) {
      setImgUrl(`/api/image-proxy?url=${encodeURIComponent(spotlight.meta.image_url)}`);
      return;
    }

    let cancelled = false;
    fetch(`/api/selects/spotlight-image?type=${spotlight.type}&id=${spotlight.discogs_id}`)
      .then(res => {
        if (!res.ok) throw new Error("spotlight fetch failed");
        return res.json();
      })
      .then((data: { url: string | null }) => {
        if (cancelled) return;
        if (data.url) setImgUrl(`/api/image-proxy?url=${encodeURIComponent(data.url)}`);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [spotlight.discogs_id, spotlight.type, spotlight.meta.image_url]);

  const { meta } = spotlight;

  return (
    <div className="rk-spotlight-panel" style={{ width: 260, flexShrink: 0, position: "sticky", top: 24, alignSelf: "flex-start" }}>
      <div className="rk-spotlight-img" style={{ width: "100%", aspectRatio: "1 / 1", background: "#f7f7f5", overflow: "hidden" }}>
        {imgUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={spotlight.name}
            onError={() => setFailed(true)}
            style={{
              width: "100%", height: "100%", display: "block",
              objectFit: spotlight.type === "label" ? "contain" : "cover",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "12px", color: "#aaaaaa" }}>{spotlight.name}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 16, paddingTop: 12 }}>
        <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: INK, margin: "0 0 6px" }}>
          {spotlight.name}
        </p>

        {spotlight.type === "artist" ? (
          <>
            {meta.label_affiliation && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: "0 0 4px", fontWeight: 400 }}>
                {meta.label_affiliation}
              </p>
            )}
            {(meta.location || meta.active_period) && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0, fontWeight: 400 }}>
                {[meta.location, meta.active_period ? `Active ${meta.active_period}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        ) : (
          <>
            {(meta.founded || meta.location) && (
              <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: "0 0 4px", fontWeight: 400 }}>
                {[meta.founded ? `Founded ${meta.founded}` : null, meta.location].filter(Boolean).join(" · ")}
              </p>
            )}
            {meta.website && (
              <a
                href={`https://${meta.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, fontWeight: 400, textDecoration: "none" }}
              >
                {meta.website}
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function monthLabel(month: string, type: "artist" | "label"): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const formatted = date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${type === "artist" ? "Artist Spotlight" : "Label Spotlight"} · ${formatted}`;
}

export default function SpotlightView({ spotlight }: { spotlight: Spotlight }) {
  const pick = spotlight.rekoodos_pick;
  const releasesLabel = spotlight.type === "artist" ? "Discography" : "Landmark Releases";
  const notesLabel    = spotlight.type === "artist" ? "Pressing Intelligence" : "Collector's Notes";
  const ownsLabel     = spotlight.type === "artist"
    ? `If you own ${spotlight.name}`
    : `If ${spotlight.name} is in your collection`;
  const ownsSubtitle  = spotlight.type === "artist" ? "You might also reach for" : "You might also explore";

  return (
    <div className="rk-spotlight-outer" style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
      <SpotlightPanel spotlight={spotlight} />

      <div style={{ flex: 1, minWidth: 0 }}>

        {/* 1. Header */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>{monthLabel(spotlight.month, spotlight.type)}</SectionEyebrow>
          <h1 style={{
            fontFamily: SERIF, fontSize: "48px", fontWeight: 600,
            letterSpacing: "-0.03em", color: INK, margin: "0 0 16px", lineHeight: 1.05,
          }}>
            {spotlight.name}
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "12px", color: INK, lineHeight: 1.7, maxWidth: 560, margin: 0, fontWeight: 400 }}>
            {spotlight.subtitle}
          </p>
        </div>

        {/* 2. Bio / About */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>About</SectionEyebrow>
          {spotlight.bio.map((para, i) => (
            <p key={i} style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 1.75, color: INK, margin: i < spotlight.bio.length - 1 ? "0 0 14px" : 0, fontWeight: 400 }}>
              {para}
            </p>
          ))}
        </div>

        {/* 3. Releases */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>{releasesLabel}</SectionEyebrow>
          <div>
            {spotlight.releases.map((row, i) => (
              <div
                key={`${row.year}-${row.title}`}
                style={{
                  display: "flex", gap: 16, padding: "16px 0",
                  borderBottom: i < spotlight.releases.length - 1 ? `1px solid ${RULE}` : "none",
                }}
              >
                <div style={{ width: 48, flexShrink: 0, fontFamily: MONO, fontSize: "12px", color: ORANGE, fontWeight: 400 }}>
                  {row.year}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 600, color: INK, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}>
                    {row.title}
                    {pick && row.title === pick && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: SERIF, fontSize: "16px", color: "#B8860B", lineHeight: 1 }}>ō</span>
                        <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8860B", fontWeight: 400 }}>
                          Rekōdo&rsquo;s Pick
                        </span>
                      </span>
                    )}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 6px", fontWeight: 400 }}>
                    {row.artist ?? row.label}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, lineHeight: 1.6, margin: 0, fontWeight: 400 }}>
                    {row.note}
                  </p>
                </div>
                {row.badge && (
                  <div className="rk-disc-badge" style={{ flexShrink: 0 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: "10px", color: INK,
                      border: `1px solid ${RULE}`, padding: "2px 8px",
                      whiteSpace: "nowrap", fontWeight: 400,
                    }}>
                      {row.badge}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Collector notes grid */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>{notesLabel}</SectionEyebrow>
          {spotlight.type === "label" && (
            <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 16px", fontWeight: 400 }}>
              What makes a {spotlight.name} pressing worth owning
            </p>
          )}
          <div className="rk-pressing-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${RULE}` }}>
            {spotlight.collector_notes.map((cell, i) => (
              <div
                key={cell.title}
                style={{
                  padding: 16,
                  borderRight: i % 2 === 0 ? `1px solid ${RULE}` : "none",
                  borderBottom: i < spotlight.collector_notes.length - 2 ? `1px solid ${RULE}` : "none",
                }}
              >
                <p style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 500, color: INK, margin: "0 0 8px" }}>
                  {cell.title}
                </p>
                <p style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 400, color: INK, lineHeight: 1.6, margin: 0 }}>
                  {cell.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Neighbors */}
        <div>
          {spotlight.type === "label" ? (
            <>
              <SectionEyebrow>Start Here</SectionEyebrow>
              <div style={{ border: `1px solid ${RULE}` }}>
                {spotlight.neighbors.map((n, i) => (
                  <div
                    key={n.artist}
                    style={{
                      display: "flex", alignItems: "baseline", gap: 16, padding: "12px 16px",
                      borderBottom: i < spotlight.neighbors.length - 1 ? `1px solid ${RULE}` : "none",
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: "10px", textTransform: "uppercase", color: MUTED, letterSpacing: "0.06em", flexShrink: 0, width: 140 }}>
                      {n.tag}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, flexShrink: 0 }}>→</span>
                    <span style={{ fontFamily: SERIF, fontSize: "14px", color: INK, fontWeight: 600 }}>
                      {n.album}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, fontWeight: 400 }}>
                      {n.artist}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <SectionEyebrow>{ownsLabel}</SectionEyebrow>
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 16px", fontWeight: 400 }}>
                {ownsSubtitle}
              </p>
              <div className="rk-neighbors-flex" style={{ display: "flex", border: `1px solid ${RULE}` }}>
                {spotlight.neighbors.map((n, i) => (
                  <div
                    key={n.artist}
                    style={{
                      flex: 1, padding: 16,
                      borderLeft: i > 0 ? `1px solid ${RULE}` : "none",
                    }}
                  >
                    <p style={{ fontFamily: MONO, fontSize: "10px", textTransform: "uppercase", color: ORANGE, margin: "0 0 8px", fontWeight: 400 }}>
                      {n.tag}
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: INK, margin: "0 0 3px" }}>
                      {n.artist}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 8px", fontWeight: 400 }}>
                      {n.album}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, lineHeight: 1.6, margin: 0, fontWeight: 400 }}>
                      {n.reason}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
