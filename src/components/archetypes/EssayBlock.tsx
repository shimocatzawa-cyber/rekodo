"use client";

import { useState, useEffect } from "react";
import { ARCHETYPES } from "@/lib/archetypes/archetypeConfig";
import type { ComputedSignals } from "@/lib/archetypes/computeArchetypes";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const RULE   = "#e0e0da";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const MUTED  = "#8a7e76";

interface Props {
  primary: string;
  primaryScore: number;
  secondary: string | null;
  shadow: string;
  signals: ComputedSignals;
  recordCount: number;
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div style={{
      height: 14,
      width,
      background: "#e8e4e0",
      borderRadius: 0,
      marginBottom: 10,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

export default function EssayBlock({ primary, primaryScore, secondary, shadow, signals, recordCount }: Props) {
  const [essay, setEssay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!primary) return;
    setLoading(true);
    setError(false);

    fetch("/api/archetypes/essay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary, primaryScore, secondary, shadow, signals, recordCount }),
    })
      .then(r => r.json())
      .then((data: { essay?: string }) => {
        if (data.essay) {
          setEssay(data.essay);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [primary]);

  const primaryDef = ARCHETYPES[primary];

  return (
    <div>
      <div style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, padding: "10px 0", marginBottom: 24 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: ORANGE }}>
          ARCHETYPE NARRATIVE
        </div>
      </div>

      <div style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: INK, marginBottom: 16 }}>
        {primaryDef?.name ?? primary}
      </div>

      {loading && (
        <div>
          <SkeletonLine width="92%" />
          <SkeletonLine width="85%" />
          <SkeletonLine width="78%" />
          <SkeletonLine width="88%" />
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}

      {!loading && error && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>Narrative unavailable.</p>
      )}

      {!loading && essay && (
        <div style={{ fontFamily: SERIF, fontSize: "0.95rem", lineHeight: 1.8, color: INK, whiteSpace: "pre-wrap" }}>
          {essay}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 32 }} />
    </div>
  );
}
