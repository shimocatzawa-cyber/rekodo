"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useUrlTab } from "@/lib/useUrlTab";
import AppNav from "@/components/AppNav";
import ArchetypeHero from "./ArchetypeHero";
import SignalGrid from "./SignalGrid";
import EssayBlock from "./EssayBlock";
import ArchetypeShareModal from "./ArchetypeShareModal";

const CardsTab   = dynamic(() => import("@/components/cards/CardsClient"),        { ssr: false });
const EchoesTab  = dynamic(() => import("@/components/archetypes/EchoesClient"),  { ssr: false });
import type { ComputedSignals } from "@/lib/archetypes/computeArchetypes";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const RULE   = "#e0e0da";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const MUTED  = "#8a7e76";

interface ArchetypeData {
  data: ComputedSignals;
  scores: Record<string, number>;
  primary: string;
  secondary: string | null;
  shadow: string;
  primaryScore: number;
  secondaryScore: number;
  namedPairing?: string | null;
  recordCount: number;
  currentCount?: number;
  cached: boolean;
}

interface Props {
  userId: string;
  username: string;
  displayLabel?: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  isSupporter?: boolean;
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div style={{ height, background: "#ede9e4", marginBottom: 16, animation: "pulse 1.5s ease-in-out infinite" }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      {/* Hero skeleton */}
      <div style={{ display: "flex", gap: 32, marginBottom: 48 }}>
        <div className="hidden md:block" style={{ flexShrink: 0 }}>
          <SkeletonBlock height={460} />
          <div style={{ width: 340 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <SkeletonBlock height={120} />
            <SkeletonBlock height={120} />
            <SkeletonBlock height={120} />
          </div>
          <SkeletonBlock height={48} />
          <SkeletonBlock height={72} />
        </div>
      </div>
      {/* Signal grid skeleton — 3 columns × 5 rows */}
      <div className="rk-signal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: RULE }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ background: "#fff", padding: 16 }}>
            <SkeletonBlock height={64} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArchetypesClient({ userId, username, displayLabel, avatarUrl, isAdmin, isSupporter }: Props) {
  const t = useTranslations("archetypes");
  const [tab, setTab] = useUrlTab<"archetypes" | "cards" | "echoes">("tab", ["archetypes", "cards", "echoes"], "archetypes");
  const [data, setData] = useState<ArchetypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    try {
      const res = await fetch("/api/archetypes", { method: force ? "POST" : "GET" });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? "Failed to load");
        return;
      }
      const json = await res.json() as ArchetypeData;
      setData(json);
      setError(null);
    } catch {
      setError("Failed to load");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(false).finally(() => setLoading(false));
  }, [fetchData]);

  async function handleRegenerate() {
    setRegenerating(true);
    await fetchData(true);
    setRegenerating(false);
  }

  const MIN_RECORDS = 20;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      {/* Sub-tab bar — supporters see Archetypes + Echoes; admins also see Cards */}
      {(isAdmin || isSupporter) && (
        <div className="rk-profile-tabs" style={{ display: "flex", justifyContent: "center", gap: "24px", paddingTop: "14px", paddingBottom: "2px", background: "#ffffff" }}>
          {(["archetypes", "echoes", ...(isAdmin ? ["cards"] : [])] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
                textTransform: "uppercase", background: "none", border: "none",
                borderBottom: `1.5px solid ${tab === id ? ORANGE : "transparent"}`,
                padding: "6px 0",
                color: tab === id ? INK : "#bbbbbb",
                cursor: "pointer", display: "inline-block",
              }}
            >
              {id === "archetypes" ? "Archetypes" : id === "echoes" ? "Echoes" : "Cards"}
            </button>
          ))}
        </div>
      )}

      <main className="rk-arch-main" style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>

        {/* Page header — archetypes tab only */}
        <div style={{ marginBottom: 32, display: tab === "archetypes" || (!isAdmin && !isSupporter) ? undefined : "none" }}>
          <div className="rk-arch-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 400, color: INK, margin: 0 }}>
                {t("subtitle")}
              </h1>
              {data && (
                <button
                  onClick={() => setShowShare(true)}
                  style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.06em", flexShrink: 0 }}
                >
                  {t("share")}
                </button>
              )}
            </div>
            {data && (
              <div className="rk-arch-stat" style={{ textAlign: "right", flexShrink: 0, paddingLeft: 24 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginBottom: 6 }}>
                  {t("recordsAnalysed", { count: data.currentCount ?? data.recordCount })}
                </div>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: regenerating ? MUTED : ORANGE,
                    background: "none",
                    border: "none",
                    cursor: regenerating ? "default" : "pointer",
                    padding: 0,
                    letterSpacing: "0.06em",
                  }}
                >
                  {regenerating ? "Regenerating…" : t("regenerate")}
                </button>
              </div>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20 }} />
        </div>

        {tab === "echoes" && (isAdmin || isSupporter) && (
          <EchoesTab userId={userId} isAdmin={isAdmin} />
        )}

        {tab === "cards" && isAdmin && (
          <CardsTab userId={userId} />
        )}

        {/* States */}
        {tab === "archetypes" && loading && <LoadingSkeleton />}

        {tab === "archetypes" && !loading && error && (
          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, textAlign: "center", padding: "80px 0" }}>
            {error}
          </div>
        )}

        {tab === "archetypes" && !loading && data && data.recordCount < MIN_RECORDS && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>
              Import at least {MIN_RECORDS} records to generate your Archetype profile.{" "}
              <Link href="/collection" style={{ color: ORANGE, textDecoration: "none" }}>
                Go to Collection →
              </Link>
            </p>
          </div>
        )}

        {showShare && data && (
          <ArchetypeShareModal
            onClose={() => setShowShare(false)}
            archetypeId={data.primary}
            score={data.primaryScore}
            shadowId={data.shadow}
            shadowScore={data.scores[data.shadow] ?? 0}
            username={username}
          />
        )}

        {tab === "archetypes" && !loading && data && data.recordCount >= MIN_RECORDS && (
          <>
            <ArchetypeHero
              primary={data.primary}
              primaryScore={data.primaryScore}
              secondary={data.secondary}
              secondaryScore={data.secondaryScore}
              shadow={data.shadow}
              shadowScore={data.scores[data.shadow] ?? 0}
              namedPairing={data.namedPairing ?? null}
            />

            <EssayBlock
              primary={data.primary}
              primaryScore={data.primaryScore}
              secondary={data.secondary}
              shadow={data.shadow}
              signals={data.data}
              recordCount={data.recordCount}
            />

            <SignalGrid signals={data.data} />
          </>
        )}
      </main>
    </div>
  );
}
