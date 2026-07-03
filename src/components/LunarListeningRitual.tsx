"use client";

// components/LunarListeningRitual.tsx

const LUNAR_CYCLE = 29.53058770576;
const KNOWN_NEW_MOON = new Date("2024-01-11T11:57:00Z");

// Returns a [0, LUNAR_CYCLE) phase in days.
function getLunarPhaseDays(): number {
  const now = new Date();
  const daysSince = (now.getTime() - KNOWN_NEW_MOON.getTime()) / (1000 * 60 * 60 * 24);
  return ((daysSince % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE;
}

// Illumination as a 0–100 percentage (cosine of phase angle).
function getIllumination(phase: number): number {
  return Math.round((1 - Math.cos((2 * Math.PI * phase) / LUNAR_CYCLE)) / 2 * 100);
}

// 8 phases centred around their astronomical midpoints.
// Quarter moons are at days ~7.38 and ~22.15; full moon at ~14.77.
// All named phases use a ±1-day window.
type PhaseKey =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

function getLunarPhase(): PhaseKey {
  const p = getLunarPhaseDays();
  if (p < 1.85 || p > LUNAR_CYCLE - 1.85)  return "new";
  if (p < 6.38)                              return "waxing_crescent";
  if (p < 8.38)                              return "first_quarter";
  if (p < 13.77)                             return "waxing_gibbous";
  if (p < 15.77)                             return "full";
  if (p < 21.15)                             return "waning_gibbous";
  if (p < 23.15)                             return "last_quarter";
  return "waning_crescent";
}

const RITUALS: Record<PhaseKey, {
  moonLabel: string;
  instruction: string;
  detail: string;
  illumination: number;   // 0 | 25 | 50 | 75 | 100 — drives the SVG
  waxing: boolean;
}> = {
  new: {
    moonLabel: "New Moon",
    instruction: "Time to dig for something new.",
    detail: "Your collection has edges you haven't reached yet. Tonight, let the silence of a new moon lead you somewhere unfamiliar.",
    illumination: 0,
    waxing: true,
  },
  waxing_crescent: {
    moonLabel: "Waxing Crescent",
    instruction: "Follow a thread you started and never finished.",
    detail: "An album from a label you dipped into. An artist you heard once and kept meaning to return to. Start the thread back up.",
    illumination: 25,
    waxing: true,
  },
  first_quarter: {
    moonLabel: "First Quarter",
    instruction: "Follow your curiosity.",
    detail: "A record you've been circling. A label you keep returning to. The half-lit moon asks you to commit to the pull you've been ignoring.",
    illumination: 50,
    waxing: true,
  },
  waxing_gibbous: {
    moonLabel: "Waxing Gibbous",
    instruction: "Build toward something.",
    detail: "The moon is almost full. Put on something ambitious — a double album, a side-long suite, a record that asks more of you than background noise.",
    illumination: 75,
    waxing: true,
  },
  full: {
    moonLabel: "Full Moon",
    instruction: "Revisit a record that changed your perspective.",
    detail: "Not for background. For listening. The full moon is for the record you know by heart but still don't fully understand.",
    illumination: 100,
    waxing: false,
  },
  waning_gibbous: {
    moonLabel: "Waning Gibbous",
    instruction: "Let something settle.",
    detail: "The peak has passed. Find a record that rewards a slow listen — something you've been putting on as background that deserves your full attention tonight.",
    illumination: 75,
    waxing: false,
  },
  last_quarter: {
    moonLabel: "Last Quarter",
    instruction: "Reflect on what stayed with you.",
    detail: "Something from the last few weeks is still in your head. Find the record behind it. Let it finish.",
    illumination: 50,
    waxing: false,
  },
  waning_crescent: {
    moonLabel: "Waning Crescent",
    instruction: "Wind down. One quiet record before the dark.",
    detail: "The cycle is almost over. The waning crescent is for the record you put on when the room empties and the night goes still.",
    illumination: 25,
    waxing: false,
  },
};

function MoonSVG({ illumination, waxing }: { illumination: number; waxing: boolean }) {
  const size = 52;
  const r = size / 2;
  const cx = r;
  const cy = r;

  let moonPath: string | null = null;

  if (illumination === 100) {
    // Full disc
    moonPath = `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx},${cy + r} A ${r},${r} 0 1,1 ${cx},${cy - r} Z`;
  } else if (illumination === 50) {
    // Half — waxing = right half lit, waning = left half lit
    moonPath = waxing
      ? `M ${cx},${cy - r} A ${r},${r} 0 0,1 ${cx},${cy + r} Z`
      : `M ${cx},${cy - r} A ${r},${r} 0 0,0 ${cx},${cy + r} Z`;
  } else if (illumination === 75) {
    // Gibbous — elliptical terminator on the shadow side
    const rx = r * 0.5;
    moonPath = waxing
      ? `M ${cx},${cy - r} A ${r},${r} 0 0,1 ${cx},${cy + r} A ${rx},${r} 0 0,0 ${cx},${cy - r} Z`
      : `M ${cx},${cy - r} A ${r},${r} 0 0,0 ${cx},${cy + r} A ${rx},${r} 0 0,1 ${cx},${cy - r} Z`;
  } else if (illumination === 25) {
    // Crescent — elliptical terminator on the lit side
    const rx = r * 0.5;
    moonPath = waxing
      ? `M ${cx},${cy - r} A ${r},${r} 0 0,1 ${cx},${cy + r} A ${rx},${r} 0 0,1 ${cx},${cy - r} Z`
      : `M ${cx},${cy - r} A ${r},${r} 0 0,0 ${cx},${cy + r} A ${rx},${r} 0 0,0 ${cx},${cy - r} Z`;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#0a0a0a" strokeWidth="1" opacity={illumination === 0 ? 1 : 0.2} />
      {moonPath && <path d={moonPath} fill="#0a0a0a" />}
    </svg>
  );
}

export default function LunarListeningRitual() {
  const phaseKey   = getLunarPhase();
  const ritual     = RITUALS[phaseKey];
  // Use computed illumination for display accuracy, snapping to nearest SVG tier
  const trueIllum  = getIllumination(getLunarPhaseDays());
  const snapIllum  = ritual.illumination as 0 | 25 | 50 | 75 | 100;

  return (
    <div style={{ fontFamily: "var(--font-mono)", color: "#0a0a0a", borderTop: "1px solid #e0e0da" }}>

      {/* Eyebrow row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#CC5500" }}>
          Lunar Listening
        </span>
        <span style={{ fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.35 }}>
          {trueIllum}% illuminated
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "22px 0", display: "grid", gridTemplateColumns: "56px 1fr", gap: "18px", alignItems: "start" }}>
        <div style={{ paddingTop: "2px" }}>
          <MoonSVG illumination={snapIllum} waxing={ritual.waxing} />
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
