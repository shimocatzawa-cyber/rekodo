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
  currentId: string | null;
  selectedId: string | null;
  archive: SpotlightSummary[];
  onSelect: (spotlight: Spotlight) => void;
}

export default function SpotlightArchivePicker({ currentId, selectedId, archive, onSelect }: Props) {
  if (archive.length === 0) return null;

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
    <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${RULE}` }}>
      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 12px" }}>
        Archive
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleCurrentClick}
          style={{
            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
            background: "none", border: `1px solid ${isCurrentSelected ? ORANGE : RULE}`,
            color: isCurrentSelected ? ORANGE : INK,
            cursor: "pointer", padding: "5px 12px",
          }}
        >
          Current
        </button>
        {archive.map(item => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              style={{
                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                background: "none", border: `1px solid ${active ? ORANGE : RULE}`,
                color: active ? ORANGE : INK,
                cursor: "pointer", padding: "5px 12px",
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
