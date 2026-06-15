"use client";

import { SIGNALS } from "@/lib/archetypes/signalConfig";
import type { ComputedSignals, SignalResult } from "@/lib/archetypes/computeArchetypes";

const MONO   = "var(--font-mono)";
const RULE   = "#e0e0da";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const MUTED  = "#8a7e76";
const WARM   = "#FDF6F0";

interface Props {
  signals: ComputedSignals;
}

function SignalCell({ signal, result }: { signal: typeof SIGNALS[number]; result: SignalResult }) {
  const unavail = result.unavailable === true;

  return (
    <div style={{
      padding: "18px 16px",
      background: unavail ? WARM : "transparent",
    }}>
      <div style={{
        fontFamily: MONO,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: ORANGE,
        marginBottom: 6,
      }}>
        {signal.label} · {signal.japaneseLabel}
      </div>

      <div style={{
        fontFamily: "var(--font-editorial)",
        fontSize: "1rem",
        fontWeight: 700,
        color: unavail ? MUTED : INK,
        marginBottom: 8,
      }}>
        {unavail ? "—" : result.label}
      </div>

      {/* Bar */}
      <div style={{ width: "100%", height: 2, background: RULE, marginBottom: 6 }}>
        <div style={{
          width: `${unavail ? 0 : result.score}%`,
          height: "100%",
          background: ORANGE,
        }} />
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
        {result.subtext ?? signal.description}
      </div>
    </div>
  );
}

export default function SignalGrid({ signals }: Props) {
  return (
    <div style={{ marginBottom: 48 }}>
      {/* Eyebrow */}
      <div style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, padding: "10px 0", marginBottom: 0 }}>
        <div style={{
          fontFamily: MONO,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: ORANGE,
        }}>
          {SIGNALS.length} Taste Signals · テイストシグナル
        </div>
      </div>

      {/* Grid */}
      <style>{`
        .signal-grid {
          display: grid;
          grid-template-columns: 1fr;
          border-bottom: 1px solid ${RULE};
        }
        @media (min-width: 640px) {
          .signal-grid { grid-template-columns: repeat(2, 1fr); }
          .signal-grid .signal-cell:nth-child(odd) { border-left: none; }
          .signal-grid .signal-cell:nth-child(even) { border-left: 1px solid ${RULE}; }
        }
        @media (min-width: 900px) {
          .signal-grid { grid-template-columns: repeat(3, 1fr); }
          .signal-grid .signal-cell { border-left: none; }
          .signal-grid .signal-cell:nth-child(3n+2),
          .signal-grid .signal-cell:nth-child(3n+3) { border-left: 1px solid ${RULE}; }
        }
      `}</style>
      <div className="signal-grid">
        {SIGNALS.map((signal) => {
          const result = signals[signal.id as keyof ComputedSignals] as SignalResult;
          return (
            <div
              key={signal.id}
              className="signal-cell"
              style={{ borderTop: `1px solid ${RULE}` }}
            >
              <SignalCell signal={signal} result={result} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
