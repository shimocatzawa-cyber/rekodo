"use client";

import { useState, useEffect, useCallback } from "react";
import AppNav from "@/components/AppNav";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

// ── Types ──────────────────────────────────────────────────────────────────────

type Format      = "podcast" | "book" | "audible";
type StackStatus = "saved" | "in_progress" | "done";
type ContentTab  = "podcast" | "audible" | "book";

interface Recommendation {
  id: string;
  format: Format;
  title: string;
  creator: string | null;
  description: string | null;
  match_reason: string | null;
  match_artists: string[] | null;
  match_labels: string[] | null;
  external_url: string | null;
  affiliate_url: string | null;
  thumbnail_url: string | null;
  artist_coverage_depth: string | null;
  relevance_score: number | null;
  created_at: string;
}

interface StackItem {
  id: string;
  recommendation_id: string | null;
  format: Format | null;
  title: string | null;
  creator: string | null;
  external_url: string | null;
  affiliate_url: string | null;
  thumbnail_url: string | null;
  match_reason: string | null;
  status: StackStatus;
  added_at: string;
}

interface Props {
  username:      string;
  displayLabel?: string;
  avatarUrl?:    string | null;
}

// ── Format meta ───────────────────────────────────────────────────────────────

const FORMAT_META: Record<Format, { label: string; actionLabel: string }> = {
  podcast: { label: "Podcasts",   actionLabel: "Listen →" },
  audible: { label: "Audiobooks", actionLabel: "Listen →" },
  book:    { label: "Books",      actionLabel: "Find →"   },
};

const CONTENT_TABS: ContentTab[] = ["podcast", "audible", "book"];

// ── SVG icons ─────────────────────────────────────────────────────────────────

function MicIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="52" height="52" fill="#0d0d0d" />
      <rect x="21" y="10" width="10" height="18" rx="5" stroke={ORANGE} strokeWidth="1.5" />
      <path d="M15 27c0 6.075 4.925 11 11 11s11-4.925 11-11" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26" y1="38" x2="26" y2="43" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="43" x2="31" y2="43" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HeadphonesIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="52" height="52" fill="#0d0d0d" />
      <path d="M13 28c0-7.18 5.82-13 13-13s13 5.82 13 13" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="10" y="28" width="6" height="10" rx="2" stroke={ORANGE} strokeWidth="1.5" />
      <rect x="36" y="28" width="6" height="10" rx="2" stroke={ORANGE} strokeWidth="1.5" />
    </svg>
  );
}

function BookIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="52" height="52" fill="#0d0d0d" />
      <rect x="15" y="12" width="22" height="28" rx="1" stroke={ORANGE} strokeWidth="1.5" />
      <line x1="20" y1="12" x2="20" y2="40" stroke={ORANGE} strokeWidth="1.5" />
      <line x1="23" y1="18" x2="34" y2="18" stroke={ORANGE} strokeWidth="1" strokeLinecap="round" />
      <line x1="23" y1="22" x2="34" y2="22" stroke={ORANGE} strokeWidth="1" strokeLinecap="round" />
      <line x1="23" y1="26" x2="31" y2="26" stroke={ORANGE} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function StackLayersIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="9.5" width="12" height="2" rx="1" fill={color} />
      <rect x="1" y="6"   width="12" height="2" rx="1" fill={color} />
      <rect x="1" y="2.5" width="12" height="2" rx="1" fill={color} />
    </svg>
  );
}

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.5 6A4.5 4.5 0 1 1 6 1.5a4.5 4.5 0 0 1 3.18 1.32L10.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <polyline points="10.5,1.5 10.5,4 8,4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatIcon(format: Format, size: number) {
  if (format === "podcast") return <MicIcon size={size} />;
  if (format === "audible") return <HeadphonesIcon size={size} />;
  return <BookIcon size={size} />;
}

// ── Loading dots ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "64px 32px" }}>
      <style>{`
        @keyframes lib-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
          40%            { opacity: 1;   transform: scale(1.1);  }
        }
      `}</style>
      <div style={{ display: "flex", gap: 7 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 9, height: 9, borderRadius: "50%", background: ORANGE,
              animation: `lib-pulse 1.2s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
      <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", color: "#aaaaaa" }}>
        Reading your collection…
      </span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: ContentTab }) {
  const noun: Record<ContentTab, string> = {
    podcast: "podcasts",
    audible: "audiobooks",
    book:    "books",
  };
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "72px 32px", textAlign: "center", gap: 14,
    }}>
      {formatIcon(tab, 64)}
      <p style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 400, color: "#0d0d0d", margin: "6px 0 0" }}>
        No recommendations yet.
      </p>
      <p style={{
        fontFamily: MONO, fontSize: "11px", color: "#aaaaaa",
        letterSpacing: "0.04em", lineHeight: 1.75, maxWidth: 380, margin: 0,
      }}>
        Hit Generate Recommendations and rekōdo will read your collection and surface matched {noun[tab]}.
      </p>
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  stackIds,
  onAddToStack,
}: {
  rec: Recommendation;
  stackIds: Set<string>;
  onAddToStack: (rec: Recommendation) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const inStack    = stackIds.has(rec.id);
  const actionUrl  = rec.affiliate_url || rec.external_url;
  const actionLabel = FORMAT_META[rec.format].actionLabel;

  async function handleAdd() {
    if (inStack || saving) return;
    setSaving(true);
    await onAddToStack(rec);
    setSaving(false);
  }

  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.07)", borderRadius: 6,
      background: "#ffffff", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Match reason — hero */}
      {rec.match_reason && (
        <div style={{ borderLeft: `3px solid ${ORANGE}`, background: "#faf9f8", padding: "13px 16px" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.63rem", lineHeight: 1.65,
            color: "#1a1a1a", margin: 0, letterSpacing: "0.02em",
          }}>
            {rec.match_reason}
          </p>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "16px 18px 12px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        {formatIcon(rec.format, 52)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: SERIF, fontSize: "16px", fontWeight: 400,
            color: "#0d0d0d", margin: "0 0 5px", lineHeight: 1.3,
          }}>
            {rec.title}
          </p>
          {rec.creator && (
            <p style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
              color: "#999999", margin: 0, textTransform: "uppercase",
            }}>
              {rec.creator}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "0 18px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleAdd}
          disabled={inStack || saving}
          style={{
            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: inStack ? "#aaaaaa" : "#0d0d0d",
            background: "none",
            border: `1px solid ${inStack ? "#dddddd" : "rgba(0,0,0,0.18)"}`,
            borderRadius: 3, padding: "6px 12px",
            cursor: inStack ? "default" : "pointer",
            transition: "all 0.15s", flexShrink: 0,
          }}
        >
          {inStack ? "In Stack ✓" : saving ? "Adding…" : "Add to Stack"}
        </button>
        {actionUrl && (
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: ORANGE,
              textDecoration: "none", flexShrink: 0,
            }}
          >
            {actionLabel}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Stack item card ───────────────────────────────────────────────────────────

function StackItemCard({
  item,
  onStatusChange,
}: {
  item: StackItem;
  onStatusChange: (id: string, status: StackStatus) => Promise<void>;
}) {
  const format = (item.format ?? "book") as Format;

  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.07)", borderRadius: 6,
      padding: "12px 14px", background: "#ffffff",
      display: "flex", gap: 12, alignItems: "center",
    }}>
      {formatIcon(format, 40)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: SERIF, fontSize: "14px", color: "#0d0d0d",
          margin: "0 0 2px", lineHeight: 1.3,
        }}>
          {item.title}
        </p>
        {item.creator && (
          <p style={{
            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em",
            textTransform: "uppercase", color: "#999999", margin: 0,
          }}>
            {item.creator}
          </p>
        )}
      </div>
      <select
        value={item.status}
        onChange={(e) => onStatusChange(item.id, e.target.value as StackStatus)}
        style={{
          fontFamily: MONO, fontSize: "9px", letterSpacing: "0.05em",
          color: "#888888", background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.12)", borderRadius: 3,
          padding: "4px 8px", cursor: "pointer", flexShrink: 0,
          outline: "none",
        }}
      >
        <option value="saved">To Read / Listen</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>
  );
}

// ── My Stack panel ────────────────────────────────────────────────────────────

function StackPanel({ refreshSignal }: { refreshSignal: number }) {
  const [items, setItems]   = useState<StackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/library/wantlist");
    if (res.ok) {
      const data = await res.json() as { items: StackItem[] };
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems, refreshSignal]);

  async function updateStatus(id: string, status: StackStatus) {
    const res = await fetch(`/api/library/wantlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 32px" }}>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px 80px" }}>
      <h2 style={{
        fontFamily: SERIF, fontSize: "20px", fontWeight: 400,
        color: "#0d0d0d", margin: "0 0 24px", lineHeight: 1.2,
      }}>
        My Stack
      </h2>

      {items.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 0", gap: 12, textAlign: "center",
        }}>
          <StackLayersIcon size={40} color="#dddddd" />
          <p style={{ fontFamily: SERIF, fontSize: "16px", fontStyle: "italic", color: "#0d0d0d", margin: 0 }}>
            Your stack is empty.
          </p>
          <p style={{
            fontFamily: MONO, fontSize: "10px", color: "#aaaaaa",
            letterSpacing: "0.04em", lineHeight: 1.65, margin: 0,
          }}>
            Add recommendations from Podcasts, Audiobooks, or Books.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <StackItemCard key={item.id} item={item} onStatusChange={updateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function LibraryClient({ username, displayLabel, avatarUrl }: Props) {
  const [activeTab,       setActiveTab]       = useState<ContentTab>("podcast");
  const [showStack,       setShowStack]       = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [hasGenerated,    setHasGenerated]    = useState(false);
  const [generating,      setGenerating]      = useState(false);
  const [genError,        setGenError]        = useState<string | null>(null);
  const [stackIds,        setStackIds]        = useState<Set<string>>(new Set());
  const [stackItems,      setStackItems]      = useState<StackItem[]>([]);
  const [stackRefresh,    setStackRefresh]    = useState(0);

  // Load existing recs on mount — no auto-generate
  useEffect(() => {
    fetch("/api/library/recommendations")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.recommendations?.length > 0) {
          setRecommendations(data.recommendations);
          setHasGenerated(true);
        }
      })
      .catch(() => {});
  }, []);

  // Load stack items + IDs
  useEffect(() => {
    fetch("/api/library/wantlist")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.items) {
          const items = data.items as StackItem[];
          setStackItems(items);
          setStackIds(new Set(
            items.filter((i) => i.recommendation_id).map((i) => i.recommendation_id!)
          ));
        }
      })
      .catch(() => {});
  }, [stackRefresh]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/library/recommendations", { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { recommendations: Recommendation[] };
        setRecommendations(data.recommendations ?? []);
        setHasGenerated(true);
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setGenError(err.error ?? `Generation failed (${res.status})`);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddToStack(rec: Recommendation) {
    const res = await fetch("/api/library/wantlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation_id: rec.id }),
    });
    if (res.ok) {
      setStackIds((prev) => new Set([...prev, rec.id]));
      setStackRefresh((n) => n + 1);
    }
  }

  const stackCount = stackItems.length;
  const tabRecs    = recommendations.filter((r) => r.format === activeTab);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* Hero */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 0" }}>
        <h1 style={{
          fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400,
          color: "#0d0d0d", lineHeight: 1.1, margin: "0 0 12px",
        }}>
          Welcome to the Library.
        </h1>
        <p style={{
          fontFamily: MONO, fontSize: "12px", color: "#aaaaaa",
          letterSpacing: "0.03em", lineHeight: 1.75,
          margin: "0 0 36px", maxWidth: 520,
        }}>
          Recommendations drawn directly from your collection — podcasts, books, and audiobooks matched to what you own.
        </p>

        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          borderBottom: "1px solid rgba(0,0,0,0.08)", marginBottom: 40,
        }}>
          {/* Left: content tabs */}
          <div style={{ display: "flex" }}>
            {CONTENT_TABS.map((tab) => {
              const active = !showStack && activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setShowStack(false); }}
                  style={{
                    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: active ? "#0d0d0d" : "#bbbbbb",
                    background: "none", border: "none",
                    borderBottom: `2px solid ${active ? ORANGE : "transparent"}`,
                    padding: "0 0 12px", marginRight: 24,
                    cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {FORMAT_META[tab].label}
                </button>
              );
            })}
          </div>

          {/* Right: My Stack + Generate */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 12 }}>
            <button
              onClick={() => setShowStack((v) => !v)}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: showStack ? ORANGE : "#888888",
                background: "none",
                border: `1px solid ${showStack ? ORANGE : "rgba(0,0,0,0.15)"}`,
                borderRadius: 3, padding: "5px 10px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              <StackLayersIcon size={12} color={showStack ? ORANGE : "#888888"} />
              My Stack
              {stackCount > 0 && (
                <span style={{
                  background: ORANGE, color: "#ffffff",
                  borderRadius: "50%", width: 15, height: 15,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "8px", fontFamily: MONO, letterSpacing: 0,
                  marginLeft: 1, flexShrink: 0,
                }}>
                  {stackCount}
                </span>
              )}
            </button>

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#ffffff",
                background: generating ? "#d96020" : ORANGE,
                border: "none", borderRadius: 3,
                padding: "6px 12px",
                cursor: generating ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "background 0.15s",
              }}
            >
              <RefreshIcon size={11} />
              {hasGenerated ? "Regenerate" : "Generate Recommendations"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {genError && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px 16px" }}>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", lineHeight: 1.5, margin: 0 }}>
            {genError}
          </p>
        </div>
      )}

      {/* Content area */}
      {showStack ? (
        <StackPanel refreshSignal={stackRefresh} />
      ) : generating ? (
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <LoadingDots />
        </div>
      ) : tabRecs.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px 80px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tabRecs.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                stackIds={stackIds}
                onAddToStack={handleAddToStack}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
