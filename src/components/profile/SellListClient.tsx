"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";

type SellItem = {
  id: string;
  artist: string;
  album: string;
  year: number | null;
  cover_url: string | null;
  format: string | null;
  label: string | null;
  media_condition: string | null;
  sleeve_condition: string | null;
  value: number | null;
  price_median: number | null;
  price_currency: string;
};

function sym(code: string): string {
  const map: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "CA$", AUD: "A$",
  };
  return map[code] ?? `${code} `;
}

function formatPrice(value: number | null | undefined, currency: string): string | null {
  if (value == null || value <= 0) return null;
  return `${sym(currency)}${value.toFixed(2)}`;
}

function ConditionBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em",
      textTransform: "uppercase", color: "#666",
      border: `1px solid ${RULE}`, padding: "1px 5px",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function SellListClient({
  profileOwnerId,
  isOwner,
}: {
  profileOwnerId: string;
  isOwner: boolean;
}) {
  const [items, setItems]     = useState<SellItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function loadItems() {
    return fetch(`/api/collection/sell-list?userId=${encodeURIComponent(profileOwnerId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setItems(d.items ?? []);
      })
      .catch(() => setError("Could not load sell list."));
  }

  useEffect(() => {
    loadItems().finally(() => setLoading(false));
  }, [profileOwnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRemove(item: SellItem) {
    setItems(prev => prev.filter(i => i.id !== item.id));
    setRemoveError(null);
    try {
      const res = await fetch("/api/collection/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: item.id, open_to_offers: false }),
      });
      if (!res.ok) throw new Error("Failed to remove");
    } catch {
      setRemoveError("Couldn't remove that item — try again.");
      setTimeout(() => setRemoveError(null), 4000);
      loadItems();
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 6px" }}>
            Sell List
          </p>
          {!loading && !error && (
            <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, margin: 0 }}>
              {items.length} record{items.length !== 1 ? "s" : ""} open to offers
            </p>
          )}
        </div>
        {isOwner && (
          <Link
            href="/collection"
            style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, textDecoration: "none", borderBottom: `1px solid ${ORANGE}`, paddingBottom: "1px" }}
          >
            Manage in Collection →
          </Link>
        )}
      </div>

      {removeError && (
        <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#cc3300", marginBottom: "16px" }}>{removeError}</p>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ borderTop: `1px solid ${RULE}` }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "14px", padding: "14px 0", borderBottom: `1px solid ${RULE}` }}>
              <div style={{ width: 48, height: 48, background: "#f0ede8", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ height: "0.85rem", width: "40%", background: "#e8e3dc" }} />
                <div style={{ height: "0.75rem", width: "60%", background: "#e8e3dc" }} />
                <div style={{ height: "0.6rem",  width: "25%", background: "#e8e3dc" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#cc3300" }}>{error}</p>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div style={{ paddingTop: "20px" }}>
          <p style={{ fontFamily: SERIF, fontSize: "1.05rem", color: INK, margin: "0 0 8px" }}>
            {isOwner ? "Nothing listed yet." : "Nothing listed for sale right now."}
          </p>
          {isOwner && (
            <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, lineHeight: 1.7, margin: 0 }}>
              Open records to offers from your{" "}
              <Link href="/collection" style={{ color: ORANGE, textDecoration: "none", borderBottom: `1px solid ${ORANGE}` }}>
                Collection
              </Link>
              {" "}and they&apos;ll appear here.
            </p>
          )}
        </div>
      )}

      {/* List */}
      {!loading && !error && items.length > 0 && (
        <div style={{ borderTop: `1px solid ${RULE}` }}>
          {items.map(item => {
            const discogs = `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist} ${item.album}`)}&type=release`;
            const currency = item.price_currency ?? "USD";
            const priceLabel = formatPrice(item.price_median ?? item.value, currency);

            return (
              <div
                key={item.id}
                style={{
                  position: "relative", display: "flex", alignItems: "center", gap: "18px",
                  padding: isOwner ? "16px 22px 16px 0" : "16px 0", borderBottom: `1px solid ${RULE}`,
                }}
              >
                {isOwner && (
                  <button
                    onClick={() => handleRemove(item)}
                    aria-label="Remove from sell list"
                    style={{
                      position: "absolute", top: "14px", right: "0",
                      fontFamily: MONO, fontSize: "16px", lineHeight: 1,
                      color: "#cccccc", background: "none", border: "none",
                      cursor: "pointer", padding: "2px 4px",
                    }}
                  >
                    ×
                  </button>
                )}

                {/* Cover */}
                <div style={{ width: 48, height: 48, flexShrink: 0, background: "#f0ede8", overflow: "hidden" }}>
                  {item.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_url} alt={item.album} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 600, color: INK, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.artist}
                  </p>
                  <p style={{ fontFamily: SERIF, fontSize: "0.82rem", fontStyle: "italic", color: INK, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.album}{item.year ? ` (${item.year})` : ""}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    {item.format && (
                      <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
                        {item.format}
                      </span>
                    )}
                    {item.media_condition  && <ConditionBadge label={`Media: ${item.media_condition}`} />}
                    {item.sleeve_condition && <ConditionBadge label={`Sleeve: ${item.sleeve_condition}`} />}
                  </div>
                </div>

                {/* Price + CTA */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 88 }}>
                  {priceLabel != null && (
                    <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: "0 0 6px", letterSpacing: "0.04em" }}>
                      {priceLabel}
                    </p>
                  )}
                  <a
                    href={discogs}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE, textDecoration: "none", borderBottom: `1px solid ${ORANGE}`, paddingBottom: "1px" }}
                  >
                    Discogs ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
