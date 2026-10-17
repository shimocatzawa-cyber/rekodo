"use client";

interface Props {
  title: string;
  /** 0–1: how full side A is (left reel = take-up, right = supply) */
  sideAFill: number;
  /** 0–1: how full side B is */
  sideBFill: number;
  /** Which side is currently being edited */
  activeSide: "A" | "B";
  width?: number;
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp01(t); }

function Reel({
  cx, cy,
  takeFill,
}: { cx: number; cy: number; supplyFill: number; takeFill: number }) {
  const OUTER_R = 47;
  const HUB_R   = 22;
  const HOLE_R  = 10;

  // Tape radius grows as this reel fills with tape
  const tapeR = lerp(HUB_R + 2, OUTER_R - 6, takeFill);

  return (
    <g>
      {/* Outer plastic ring */}
      <circle cx={cx} cy={cy} r={OUTER_R} fill="#1e1e1e" />
      {/* Wound tape ring */}
      <circle cx={cx} cy={cy} r={tapeR} fill="#2a1a08" />
      {/* Spokes — 6, every 60° */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect
          key={angle}
          x={cx - 3}
          y={cy - OUTER_R + 6}
          width={6}
          height={OUTER_R - HUB_R - 4}
          rx={2}
          fill="#3a3a3a"
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      ))}
      {/* Hub */}
      <circle cx={cx} cy={cy} r={HUB_R} fill="#dedad4" />
      {/* Hub gear dots */}
      {[0, 120, 240].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <circle
            key={angle}
            cx={cx + Math.cos(rad) * 15}
            cy={cy + Math.sin(rad) * 15}
            r={3}
            fill="#c4c0b8"
          />
        );
      })}
      {/* Center hole */}
      <circle cx={cx} cy={cy} r={HOLE_R} fill="#111111" />
    </g>
  );
}

function ScrewCorner({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="#282828" />
      <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#111" strokeWidth="1.5" />
      <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#111" strokeWidth="1.5" />
    </g>
  );
}

export default function CassetteSVG({
  title,
  sideAFill,
  sideBFill,
  activeSide,
  width = 520,
}: Props) {
  const VW = 520;
  const VH = 310;
  const SCALE = width / VW;

  // Reel fill logic: Side A → left reel takes up tape; Side B → reversed
  const leftFill  = activeSide === "A" ? sideAFill  : 1 - sideBFill;
  const rightFill = activeSide === "A" ? 1 - sideAFill : sideBFill;

  const LEFT_REEL  = { cx: 148, cy: 172 };
  const RIGHT_REEL = { cx: 372, cy: 172 };

  // Tape top path — arc between the top edges of the two reels
  const tapeY  = 128;
  const tapeX1 = LEFT_REEL.cx + 12;
  const tapeX2 = RIGHT_REEL.cx - 12;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={width}
      height={Math.round(VH * SCALE)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {/* ── Outer casing ── */}
      <rect x="0" y="0" width={VW} height="276" rx="14" fill="#1c1c1c" />

      {/* Bottom connector tab */}
      <rect x="148" y="261" width="224" height="49" rx="8" fill="#1a1a1a" />

      {/* Bottom connector holes */}
      <rect x="170" y="274" width="18" height="12" rx="3" fill="#111" />
      <rect x="206" y="270" width="12" height="12" rx="3" fill="#111" />
      <rect x="256" y="274" width="8"  height="8"  rx="2" fill="#111" />
      <rect x="302" y="270" width="12" height="12" rx="3" fill="#111" />
      <rect x="332" y="274" width="18" height="12" rx="3" fill="#111" />

      {/* Corner screws */}
      <ScrewCorner cx={26}  cy={26}  />
      <ScrewCorner cx={494} cy={26}  />
      <ScrewCorner cx={26}  cy={250} />
      <ScrewCorner cx={494} cy={250} />

      {/* ── Label ── */}
      <rect x="30" y="18" width="460" height="222" rx="6" fill="#f2efe7" />

      {/* Subtle label texture lines */}
      <line x1="30" y1="60"  x2="490" y2="60"  stroke="#e8e4dc" strokeWidth="0.5" />
      <line x1="30" y1="80"  x2="490" y2="80"  stroke="#e8e4dc" strokeWidth="0.5" />
      <line x1="30" y1="100" x2="490" y2="100" stroke="#e8e4dc" strokeWidth="0.5" />

      {/* Title on label */}
      <text
        x="260"
        y="72"
        textAnchor="middle"
        fontFamily='"Georgia", serif'
        fontSize={title.length > 20 ? 22 : title.length > 12 ? 28 : 34}
        fontStyle="italic"
        fontWeight="600"
        fill="#1a1a1a"
        letterSpacing="-0.5"
      >
        {title || "My Mixtape"}
      </text>

      {/* Side indicator */}
      <text
        x="260"
        y="94"
        textAnchor="middle"
        fontFamily='"Courier New", monospace'
        fontSize="10"
        letterSpacing="0.15em"
        fill="#888"
      >
        {`SIDE ${activeSide}`}
      </text>

      {/* ── Mechanism window ── */}
      <rect x="60" y="110" width="400" height="122" rx="10" fill="#111111" />

      {/* Tape path across the window top */}
      <path
        d={`M ${tapeX1} ${tapeY} Q 260 ${tapeY - 6} ${tapeX2} ${tapeY}`}
        stroke="#1a0e00"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${tapeX1 - 4} ${tapeY + 5} Q 260 ${tapeY - 2} ${tapeX2 + 4} ${tapeY + 5}`}
        stroke="#241405"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Guide posts */}
      <rect x="92"  y="120" width="8" height="22" rx="4" fill="#363636" />
      <rect x="420" y="120" width="8" height="22" rx="4" fill="#363636" />

      {/* Reels */}
      <Reel
        cx={LEFT_REEL.cx}
        cy={LEFT_REEL.cy}
        takeFill={leftFill}
        supplyFill={1 - leftFill}
      />
      <Reel
        cx={RIGHT_REEL.cx}
        cy={RIGHT_REEL.cy}
        takeFill={rightFill}
        supplyFill={1 - rightFill}
      />

      {/* Window edge vignette */}
      <rect x="60" y="110" width="400" height="122" rx="10" fill="url(#vinyet)" stroke="#222" strokeWidth="1" />

      <defs>
        <radialGradient id="vinyet" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>
    </svg>
  );
}
