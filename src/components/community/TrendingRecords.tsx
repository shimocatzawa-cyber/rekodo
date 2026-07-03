"use client";

import { useState, useEffect } from "react";
import type { TrendingRecord } from "@/lib/trendingRecords";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";
const INK   = "#0a0a0a";
const MUTED = "#aaaaaa";

function RecordCard({ rec, rank }: { rec: TrendingRecord; rank: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* Artwork */}
      <div style={{ position: "relative", aspectRatio: "1", background: "#f0ede8", overflow: "hidden" }}>
        {rec.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rec.coverUrl}
            alt={rec.album}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.2s", transform: hovered ? "scale(1.03)" : "scale(1)" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>No cover</span>
          </div>
        )}
        {/* Rank badge */}
        <div style={{
          position: "absolute", top: "8px", left: "8px",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
          padding: "2px 7px",
        }}>
          <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#ffffff" }}>
            #{rank}
          </span>
        </div>
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.82rem", fontWeight: 600, color: INK, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {rec.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "0.75rem", fontStyle: "italic", color: "#555", margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {rec.album}
        </p>
        <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: MUTED }}>
          {rec.collectorCount} collectors
        </span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ aspectRatio: "1", background: "#f0ede8" }} className="nr-shimmer" />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ height: "0.82rem", width: "70%", background: "#f0ede8" }} className="nr-shimmer" />
        <div style={{ height: "0.75rem", width: "55%", background: "#f0ede8" }} className="nr-shimmer" />
      </div>
    </div>
  );
}

export default function TrendingRecords({ initialRecords }: { initialRecords?: TrendingRecord[] }) {
  const [records, setRecords] = useState<TrendingRecord[]>(initialRecords ?? []);
  const [loading, setLoading] = useState(!initialRecords);

  useEffect(() => {
    if (initialRecords) return;
    fetch("/api/community/trending")
      .then(r => r.ok ? r.json() : { records: [] })
      .then(d => setRecords(d.records ?? []))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: "28px 0" }}>
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "16px" }}>
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : records.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, margin: "0 0 8px" }}>Nothing popular yet.</p>
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
            Records shared across multiple collections will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "16px" }}>
          {records.map((rec, i) => (
            <RecordCard key={rec.id} rec={rec} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
