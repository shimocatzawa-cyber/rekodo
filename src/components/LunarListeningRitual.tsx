// components/LunarListeningRitual.tsx

function getLunarPhase() {
  const knownNewMoon = new Date("2024-01-11T11:57:00Z");
  const lunarCycle = 29.53058770576;
  const now = new Date();
  const daysSince = (now.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((daysSince % lunarCycle) + lunarCycle) % lunarCycle;

  if (phase < 1.85)  return "new";
  if (phase < 9.22)  return "first_quarter";
  if (phase < 16.61) return "full";
  return "waning";
}

const RITUALS = {
  new: {
    moonLabel: "New Moon",
    instruction: "Time to dig for something new.",
    detail: "Your collection has edges you haven't reached yet. Tonight, let the silence of a new moon lead you somewhere unfamiliar.",
    illumination: 0,
  },
  first_quarter: {
    moonLabel: "First Quarter",
    instruction: "Follow your curiosity.",
    detail: "A record you've been circling. A label you keep returning to. The half-lit moon asks you to commit to the pull you've been ignoring.",
    illumination: 50,
  },
  full: {
    moonLabel: "Full Moon",
    instruction: "Revisit a record that changed your perspective.",
    detail: "Not for background. For listening. The full moon is for the record you know by heart but still don't fully understand.",
    illumination: 100,
  },
  waning: {
    moonLabel: "Waning Moon",
    instruction: "Reflect on what stayed with you.",
    detail: "Something from the last few weeks is still in your head. Find the record behind it. Let it finish.",
    illumination: 25,
  },
} as const;

type RitualKey = keyof typeof RITUALS;

function MoonSVG({ illumination }: { illumination: number }) {
  const size = 52;
  const r = size / 2;
  const cx = r;
  const cy = r;

  let moonPath: string | null = null;
  if (illumination === 100) {
    moonPath = `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx},${cy + r} A ${r},${r} 0 1,1 ${cx},${cy - r} Z`;
  } else if (illumination === 50) {
    moonPath = `M ${cx},${cy - r} A ${r},${r} 0 0,1 ${cx},${cy + r} Z`;
  } else if (illumination === 25) {
    moonPath = `M ${cx},${cy - r} A ${r},${r} 0 0,0 ${cx},${cy + r} Z`;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#0a0a0a" strokeWidth="1" opacity={illumination === 0 ? 1 : 0.2} />
      {moonPath && <path d={moonPath} fill="#0a0a0a" />}
    </svg>
  );
}

export default function LunarListeningRitual() {
  const ritualKey = getLunarPhase() as RitualKey;
  const ritual = RITUALS[ritualKey];

  return (
    <div style={{ fontFamily: "var(--font-mono)", color: "#0a0a0a", borderTop: "1px solid #e0e0da" }}>

      {/* Eyebrow row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px" }}>
        <span style={{ fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#CC5500" }}>
          Lunar Listening
        </span>
        <span style={{ fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.35 }}>
          Changes with the moon
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "22px 20px", display: "grid", gridTemplateColumns: "56px 1fr", gap: "18px", alignItems: "start" }}>
        <div style={{ paddingTop: "2px" }}>
          <MoonSVG illumination={ritual.illumination} />
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "5px" }}>
            {ritual.moonLabel}
          </p>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.4, marginBottom: "7px" }}>
            {ritual.instruction}
          </p>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.7, opacity: 0.65 }}>
            {ritual.detail}
          </p>
        </div>
      </div>

    </div>
  );
}
