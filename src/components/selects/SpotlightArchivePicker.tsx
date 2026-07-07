"use client";

import type { SpotlightSummary, Spotlight } from "@/lib/spotlights/types";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const INK    = "#0a0a0a";

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

interface Props {
  current: Spotlight | null;
  currentId: string | null;
  selectedId: string | null;
  archive: SpotlightSummary[];
  onSelect: (spotlight: Spotlight) => void;
}

export default function SpotlightArchivePicker({ current, currentId, selectedId, archive, onSelect }: Props) {

  async function handleClick(id: string) {
    if (id === selectedId) return;
    const res = await fetch(`/api/spotlights/${id}`);
    if (!res.ok) return;
    const data = await res.json() as Spotlight;
    onSelect(data);

    const url = new URL(window.location.href);
    url.searchParams.set("spotlight", id);
    window.history.replaceState(null, "", url.toString());
  }

  async function handleCurrentClick() {
    if (!currentId || currentId === selectedId) return;
    const res = await fetch(`/api/spotlights/${currentId}`);
    if (!res.ok) return;
    const data = await res.json() as Spotlight;
    onSelect(data);

    const url = new URL(window.location.href);
    url.searchParams.delete("spotlight");
    window.history.replaceState(null, "", url.toString());
  }

  const isCurrentSelected = selectedId === currentId;

  return (
    <div style={{ width: 110, flexShrink: 0, paddingTop: 4 }}>
      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 12px" }}>
        Edition
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={handleCurrentClick}
          style={{
            fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
            background: "none", border: "none", padding: "2px 0",
            textAlign: "left", cursor: isCurrentSelected ? "default" : "pointer",
            color: isCurrentSelected ? ORANGE : INK,
            borderBottom: isCurrentSelected ? `1px solid ${ORANGE}` : "1px solid transparent",
            width: "fit-content",
          }}
        >
          {current ? formatMonth(current.month) : "Current"}
        </button>
        {archive.map(item => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em",
                background: "none", border: "none", padding: "2px 0",
                textAlign: "left", cursor: active ? "default" : "pointer",
                color: active ? ORANGE : "#888888",
                borderBottom: active ? `1px solid ${ORANGE}` : "1px solid transparent",
                width: "fit-content",
              }}
            >
              {formatMonth(item.month)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
