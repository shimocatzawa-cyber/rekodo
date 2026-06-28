"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";
const INK   = "#0a0a0a";
const MUTED = "#aaaaaa";

type OfferItem = {
  id: string;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  record: { id: string; artist: string; album: string; coverUrl: string | null; year: number | null };
  profile: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

function OfferCard({ item }: { item: OfferItem }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/@${item.profile.username}`}
      style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: "10px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Artwork */}
      <div style={{ position: "relative", aspectRatio: "1", background: "#f0ede8", overflow: "hidden" }}>
        {item.record.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.record.coverUrl}
            alt={item.record.album}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.2s", transform: hovered ? "scale(1.03)" : "scale(1)" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>No cover</span>
          </div>
        )}
        {/* User avatar badge */}
        <div style={{ position: "absolute", bottom: "6px", right: "6px", width: 26, height: 26, borderRadius: "50%", background: "#f0ede8", overflow: "hidden", border: "2px solid #fff", flexShrink: 0 }}>
          {item.profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.profile.avatarUrl} alt={item.profile.displayName ?? item.profile.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: "8px", color: "#666" }}>
                {(item.profile.displayName ?? item.profile.username)[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: SERIF, fontSize: "0.78rem", fontWeight: 600, color: INK, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.record.artist}
        </p>
        <p style={{ fontFamily: SERIF, fontSize: "0.72rem", fontStyle: "italic", color: "#555", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.record.album}
        </p>
        <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: MUTED, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @{item.profile.username}
        </p>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ aspectRatio: "1", background: "#f0ede8" }} className="nr-shimmer" />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ height: "0.78rem", width: "70%", background: "#f0ede8" }} className="nr-shimmer" />
        <div style={{ height: "0.72rem", width: "55%", background: "#f0ede8" }} className="nr-shimmer" />
      </div>
    </div>
  );
}

export default function OpenToOffers() {
  const [items, setItems] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/community/offers")
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "28px 0" }}>
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "16px" }}>
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <p style={{ fontFamily: SERIF, fontSize: "1.1rem", color: INK, margin: "0 0 8px" }}>Nothing listed yet.</p>
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7 }}>
            Mark a record as Open to Offers in your collection to list it here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "16px" }}>
          {items.map(item => <OfferCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
