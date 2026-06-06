"use client";

import { useState, useEffect, useCallback } from "react";
import AppNav from "@/components/AppNav";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

// ── Types ──────────────────────────────────────────────────────────────────────

type Format = "podcast" | "book" | "audible";
type WantlistStatus = "saved" | "in_progress" | "done";

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

interface WantlistItem {
  id: string;
  recommendation_id: string | null;
  format: Format | null;
  title: string | null;
  creator: string | null;
  external_url: string | null;
  affiliate_url: string | null;
  thumbnail_url: string | null;
  match_reason: string | null;
  status: WantlistStatus;
  added_at: string;
}

type View = "discover" | "wantlist";

interface Props {
  username:     string;
  displayLabel?: string;
  avatarUrl?:   string | null;
}

// ── Format labels ──────────────────────────────────────────────────────────────

const FORMAT_META: Record<Format, { label: string; jp: string; actionLabel: string }> = {
  podcast: { label: "Podcasts",  jp: "ポッドキャスト", actionLabel: "Listen →" },
  book:    { label: "Books",     jp: "本",             actionLabel: "Buy →" },
  audible: { label: "Audible",   jp: "オーディブル",    actionLabel: "Listen on Audible →" },
};

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function Thumbnail({ src, format, size = 72 }: { src: string | null; format: Format; size?: number }) {
  const [failed, setFailed] = useState(false);
  const placeholder = format === "podcast" ? "🎙" : format === "audible" ? "🎧" : "📖";
  if (!src || failed) {
    return (
      <div style={{
        width: size, height: size, flexShrink: 0,
        background: "#f4f4f4", borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, userSelect: "none",
      }}>
        {placeholder}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, flexShrink: 0, borderRadius: 4, objectFit: "cover" }}
    />
  );
}

// ── Recommendation card ────────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  savedIds,
  onSave,
}: {
  rec: Recommendation;
  savedIds: Set<string>;
  onSave: (rec: Recommendation) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const isSaved = savedIds.has(rec.id);
  const meta = FORMAT_META[rec.format];
  const actionUrl = rec.affiliate_url || rec.external_url;

  async function handleSave() {
    if (isSaved || saving) return;
    setSaving(true);
    await onSave(rec);
    setSaving(false);
  }

  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 6,
      padding: "20px 20px 16px",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* match_reason — hero element */}
      {rec.match_reason && (
        <p style={{
          fontFamily: MONO,
          fontSize: "12px",
          lineHeight: 1.6,
          color: "#1a1a1a",
          margin: 0,
          borderLeft: `2.5px solid ${ORANGE}`,
          paddingLeft: 12,
        }}>
          {rec.match_reason}
        </p>
      )}

      {/* Thumbnail + metadata row */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Thumbnail src={rec.thumbnail_url} format={rec.format} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: SERIF,
            fontSize: "16px",
            fontWeight: 400,
            color: "#0d0d0d",
            margin: "0 0 4px",
            lineHeight: 1.3,
          }}>
            {rec.title}
          </p>
          {rec.creator && (
            <p style={{
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.06em",
              color: "#888888",
              margin: 0,
              textTransform: "uppercase",
            }}>
              {rec.creator}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={isSaved || saving}
          style={{
            fontFamily: MONO,
            fontSize: "9px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: isSaved ? "#aaaaaa" : "#0d0d0d",
            background: "none",
            border: `1px solid ${isSaved ? "#dddddd" : "rgba(0,0,0,0.15)"}`,
            borderRadius: 3,
            padding: "6px 12px",
            cursor: isSaved ? "default" : "pointer",
            transition: "all 0.15s",
            flexShrink: 0,
          }}
        >
          {isSaved ? "Saved ✓" : saving ? "Saving…" : "Save to Wantlist"}
        </button>
        {actionUrl && (
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: MONO,
              fontSize: "9px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ORANGE,
              textDecoration: "none",
              padding: "6px 0",
              flexShrink: 0,
            }}
          >
            {meta.actionLabel}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  format,
  recommendations,
  savedIds,
  onSave,
}: {
  format: Format;
  recommendations: Recommendation[];
  savedIds: Set<string>;
  onSave: (rec: Recommendation) => Promise<void>;
}) {
  const meta = FORMAT_META[format];
  const recs = recommendations.filter((r) => r.format === format);
  if (recs.length === 0) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
        <h2 style={{
          fontFamily: SERIF,
          fontSize: "22px",
          fontWeight: 400,
          color: "#0d0d0d",
          margin: 0,
          lineHeight: 1,
        }}>
          {meta.label}
        </h2>
        <span style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", letterSpacing: "0.06em" }}>
          {meta.jp}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {recs.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} savedIds={savedIds} onSave={onSave} />
        ))}
      </div>
    </div>
  );
}

// ── Discover view ─────────────────────────────────────────────────────────────

function DiscoverView({ onSave }: { onSave: (rec: Recommendation) => Promise<void> }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    const res = await fetch("/api/library/recommendations");
    if (!res.ok) {
      setError("Could not load recommendations.");
      setLoading(false);
      return;
    }
    const data = await res.json() as {
      recommendations: Recommendation[];
      is_stale: boolean;
      generated_at: string | null;
    };
    setRecommendations(data.recommendations ?? []);
    setLoading(false);
    return data.is_stale || data.recommendations.length === 0;
  }, []);

  // Load existing first, then generate if stale
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const needsGeneration = await fetchRecs();
      if (cancelled) return;
      if (needsGeneration) {
        setGenerating(true);
        const genRes = await fetch("/api/library/recommendations", { method: "POST" });
        if (!cancelled && genRes.ok) {
          const genData = await genRes.json() as { recommendations: Recommendation[] };
          setRecommendations(genData.recommendations ?? []);
        } else if (!cancelled) {
          // Non-fatal — existing results (if any) stay visible
        }
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [fetchRecs]);

  // Load wantlist IDs for saved state
  useEffect(() => {
    fetch("/api/library/wantlist")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.items) {
          setSavedIds(new Set(
            (data.items as WantlistItem[])
              .filter((i) => i.recommendation_id)
              .map((i) => i.recommendation_id!)
          ));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave(rec: Recommendation) {
    const res = await fetch("/api/library/wantlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation_id: rec.id }),
    });
    if (res.ok) {
      setSavedIds((prev) => new Set([...prev, rec.id]));
      onSave(rec);
    }
  }

  if (loading && recommendations.length === 0) {
    return (
      <div style={{ padding: "0 32px 80px", maxWidth: 760, margin: "0 auto" }}>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.08em" }}>
          Loading your library…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "0 32px 80px", maxWidth: 760, margin: "0 auto" }}>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px 80px" }}>
      {generating && (
        <p style={{
          fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
          textTransform: "uppercase", color: ORANGE,
          margin: "0 0 32px", animation: "pulse 1.5s ease-in-out infinite",
        }}>
          {recommendations.length > 0 ? "Refreshing recommendations…" : "Generating your library — this takes a moment…"}
        </p>
      )}

      {recommendations.length === 0 && !generating && (
        <div>
          <p style={{ fontFamily: SERIF, fontSize: "17px", fontStyle: "italic", color: "#aaaaaa", lineHeight: 1.7 }}>
            Add records to your collection to unlock Library recommendations.
          </p>
        </div>
      )}

      {(["podcast", "book", "audible"] as Format[]).map((fmt) => (
        <Section
          key={fmt}
          format={fmt}
          recommendations={recommendations}
          savedIds={savedIds}
          onSave={handleSave}
        />
      ))}
    </div>
  );
}

// ── Wantlist view ─────────────────────────────────────────────────────────────

function WantlistView({ refreshSignal }: { refreshSignal: number }) {
  const [items, setItems] = useState<WantlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<WantlistStatus>("saved");
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/library/wantlist");
    if (res.ok) {
      const data = await res.json() as { items: WantlistItem[] };
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshSignal]);

  async function updateStatus(id: string, status: WantlistStatus) {
    const res = await fetch(`/api/library/wantlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    }
  }

  async function removeItem(id: string) {
    const res = await fetch(`/api/library/wantlist/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  const STATUS_TABS: Array<{ key: WantlistStatus; label: string }> = [
    { key: "saved",       label: "Saved" },
    { key: "in_progress", label: "In Progress" },
    { key: "done",        label: "Done" },
  ];

  const filtered = items.filter((i) => i.status === activeTab);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px 80px" }}>
      {/* Status tabs */}
      <div style={{ display: "flex", gap: 24, marginBottom: 32, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 0 }}>
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: activeTab === key ? "#0d0d0d" : "#bbbbbb",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === key ? ORANGE : "transparent"}`,
              padding: "0 0 12px",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
            <span style={{ marginLeft: 6, color: "#dddddd" }}>
              {items.filter((i) => i.status === key).length}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa" }}>Loading…</p>
      )}

      {!loading && filtered.length === 0 && (
        <p style={{
          fontFamily: SERIF, fontSize: "16px", fontStyle: "italic",
          color: "#cccccc", lineHeight: 1.7,
        }}>
          {activeTab === "saved" ? "Nothing saved yet — browse Discover and add to your list." :
           activeTab === "in_progress" ? "Nothing in progress." :
           "Nothing done yet."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((item) => (
          <WantlistCard
            key={item.id}
            item={item}
            onStatusChange={updateStatus}
            onRemove={removeItem}
          />
        ))}
      </div>
    </div>
  );
}

function WantlistCard({
  item,
  onStatusChange,
  onRemove,
}: {
  item: WantlistItem;
  onStatusChange: (id: string, status: WantlistStatus) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const format = (item.format ?? "book") as Format;
  const actionUrl = item.affiliate_url || item.external_url;

  async function handleStatus(status: WantlistStatus) {
    setBusy(true);
    await onStatusChange(item.id, status);
    setBusy(false);
  }

  async function handleRemove() {
    setBusy(true);
    await onRemove(item.id);
    setBusy(false);
  }

  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 6,
      padding: "16px 18px",
      background: "#ffffff",
      display: "flex",
      gap: 14,
      alignItems: "flex-start",
    }}>
      <Thumbnail src={item.thumbnail_url} format={format} size={56} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {item.match_reason && (
          <p style={{
            fontFamily: MONO,
            fontSize: "11px",
            lineHeight: 1.55,
            color: "#1a1a1a",
            margin: "0 0 8px",
            borderLeft: `2px solid ${ORANGE}`,
            paddingLeft: 10,
          }}>
            {item.match_reason}
          </p>
        )}
        <p style={{
          fontFamily: SERIF,
          fontSize: "15px",
          color: "#0d0d0d",
          margin: "0 0 2px",
          lineHeight: 1.3,
        }}>
          {item.title}
        </p>
        {item.creator && (
          <p style={{
            fontFamily: MONO,
            fontSize: "9px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#999999",
            margin: "0 0 10px",
          }}>
            {item.creator}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {actionUrl && (
            <a
              href={actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: MONO,
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: ORANGE,
                textDecoration: "none",
              }}
            >
              {FORMAT_META[format].actionLabel}
            </a>
          )}
          {item.status === "saved" && (
            <button
              onClick={() => handleStatus("in_progress")}
              disabled={busy}
              style={smallBtn}
            >
              Mark In Progress
            </button>
          )}
          {item.status === "in_progress" && (
            <button
              onClick={() => handleStatus("done")}
              disabled={busy}
              style={smallBtn}
            >
              Mark as Done
            </button>
          )}
          {item.status !== "saved" && (
            <button
              onClick={() => handleStatus("saved")}
              disabled={busy}
              style={{ ...smallBtn, color: "#cccccc" }}
            >
              Move back
            </button>
          )}
          <button
            onClick={handleRemove}
            disabled={busy}
            style={{ ...smallBtn, color: "#dddddd", marginLeft: "auto" }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "9px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#888888",
  background: "none",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 3,
  padding: "4px 10px",
  cursor: "pointer",
};

// ── Root ──────────────────────────────────────────────────────────────────────

export default function LibraryClient({ username, displayLabel, avatarUrl }: Props) {
  const [view, setView] = useState<View>("discover");
  const [wantlistRefresh, setWantlistRefresh] = useState(0);

  async function handleSaved(_rec: Recommendation) {
    setWantlistRefresh((n) => n + 1);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 0" }}>
        <p style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#bbbbbb",
          margin: "0 0 16px",
        }}>
          Library · ライブラリ
        </p>

        <h1 style={{
          fontFamily: SERIF,
          fontSize: "clamp(32px, 5vw, 52px)",
          fontWeight: 400,
          color: "#0d0d0d",
          lineHeight: 1.1,
          margin: "0 0 32px",
        }}>
          Your listening library.
        </h1>

        {/* View toggle */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          marginBottom: 40,
        }}>
          {(["discover", "wantlist"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily: MONO,
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: view === v ? "#0d0d0d" : "#bbbbbb",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${view === v ? ORANGE : "transparent"}`,
                padding: "0 0 12px",
                marginRight: 28,
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {v === "discover" ? "Discover" : "Wantlist"}
            </button>
          ))}
        </div>
      </div>

      {view === "discover"
        ? <DiscoverView onSave={handleSaved} />
        : <WantlistView refreshSignal={wantlistRefresh} />
      }
    </div>
  );
}
