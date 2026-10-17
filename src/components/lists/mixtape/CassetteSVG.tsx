"use client";

interface Props {
  title: string;
  sideAFill: number;  // 0–1
  sideBFill: number;
  activeSide: "A" | "B";
  width?: number;
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp01(t); }

// Realistic cassette reel hub with 5 gear-teeth
function Reel({ cx, cy, fill }: { cx: number; cy: number; fill: number }) {
  const OUTER_R = 46;
  const HUB_R   = 22;
  const TAPE_R  = lerp(HUB_R + 3, OUTER_R - 5, fill);
  const TOOTH_R = 8; // radius of each bump on the hub edge

  return (
    <g>
      {/* Outer dark ring */}
      <circle cx={cx} cy={cy} r={OUTER_R} fill="#1a1a1a" />
      {/* Wound tape */}
      <circle cx={cx} cy={cy} r={TAPE_R} fill="#1c0d00" />
      {/* Hub base */}
      <circle cx={cx} cy={cy} r={HUB_R} fill="#c8c8c6" />
      {/* Hub teeth — 5 bumps at 72° */}
      {[54, 126, 198, 270, 342].map(angle => {
        const rad = (angle * Math.PI) / 180;
        return (
          <circle
            key={angle}
            cx={cx + Math.cos(rad) * (HUB_R - 2)}
            cy={cy + Math.sin(rad) * (HUB_R - 2)}
            r={TOOTH_R}
            fill="#d8d8d6"
          />
        );
      })}
      {/* Hub highlight ring */}
      <circle cx={cx} cy={cy} r={HUB_R} fill="none" stroke="#e4e4e2" strokeWidth={1} />
      {/* Centre dark area */}
      <circle cx={cx} cy={cy} r={10} fill="#1a1a1a" />
      {/* Three spindle slots */}
      {[90, 210, 330].map(angle => {
        const rad = (angle * Math.PI) / 180;
        return (
          <rect
            key={angle}
            x={cx - 2}
            y={cy - 9}
            width={4}
            height={6}
            rx={1}
            fill="#c8c8c6"
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        );
      })}
    </g>
  );
}

export default function CassetteSVG({ title, sideAFill, sideBFill, activeSide, width = 520 }: Props) {
  const VW = 600;
  const VH = 375;
  const SCALE = width / VW;

  const leftFill  = activeSide === "A" ? sideAFill  : 1 - sideBFill;
  const rightFill = activeSide === "A" ? 1 - sideAFill : sideBFill;

  // Tape bridge — between the two reels
  const BRIDGE_X = 248;
  const BRIDGE_W = 104;
  const BRIDGE_Y = 199;
  const BRIDGE_H = 50;

  const fontSize = title.length > 22 ? 22 : title.length > 14 ? 28 : title.length > 8 ? 34 : 40;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={width}
      height={Math.round(VH * SCALE)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="bodyShade" cx="50%" cy="20%" r="80%">
          <stop offset="0%"   stopColor="#2e2e2e" />
          <stop offset="100%" stopColor="#141414" />
        </radialGradient>
        <radialGradient id="mechVignette" cx="50%" cy="50%" r="50%">
          <stop offset="65%"  stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
        <filter id="tabShadow" x="-5%" y="-10%" width="110%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Soft drop shadow under cassette */}
      <ellipse cx={300} cy={302} rx={282} ry={12} fill="rgba(0,0,0,0.18)" />

      {/* ── Main body ─────────────────────────────────────────────────────── */}
      <rect x={0} y={0} width={VW} height={290} rx={14} fill="url(#bodyShade)" />

      {/* ── Bottom tab ────────────────────────────────────────────────────── */}
      <rect x={164} y={278} width={272} height={50} rx={8} fill="#181818" filter="url(#tabShadow)" />

      {/* Centre screw on tab */}
      <circle cx={300} cy={307} r={7}   fill="#111" />
      <circle cx={300} cy={307} r={4.5} fill="#1e1e1e" />

      {/* Bottom tab holes */}
      <rect x={188} y={288} width={17} height={12} rx={2.5} fill="#111" />
      <rect x={224} y={284} width={12} height={12} rx={2.5} fill="#111" />
      <rect x={265} y={288} width={9}  height={9}  rx={2}   fill="#111" />
      <rect x={319} y={284} width={12} height={12} rx={2.5} fill="#111" />
      <rect x={355} y={288} width={17} height={12} rx={2.5} fill="#111" />

      {/* ── Corner screws (4) ─────────────────────────────────────────────── */}
      {([[15, 15], [585, 15], [15, 275], [585, 275]] as [number,number][]).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={10} fill="#111" />
          <circle cx={x} cy={y} r={6.5} fill="#1e1e1e" />
          <circle cx={x} cy={y} r={3} fill="#141414" />
        </g>
      ))}

      {/* ── White label (upper portion) ────────────────────────────────────── */}
      <rect x={26} y={15} width={548} height={158} rx={6} fill="#f6f5f2" />

      {/* Subtle ruled lines on label */}
      {[52, 74, 96, 118, 140].map(y => (
        <line key={y} x1={26} y1={y} x2={574} y2={y} stroke="#e9e6e0" strokeWidth={0.6} />
      ))}

      {/* Mixtape title */}
      <text
        x={300} y={82}
        textAnchor="middle"
        fontFamily='"Georgia", "Times New Roman", serif'
        fontSize={fontSize}
        fontStyle="italic"
        fontWeight="700"
        fill="#1a1a1a"
        letterSpacing="-0.5"
      >
        {title || "My Mixtape"}
      </text>

      {/* Side indicator */}
      <text
        x={300} y={108}
        textAnchor="middle"
        fontFamily='"Courier New", monospace'
        fontSize={10}
        letterSpacing="0.2em"
        fill="#aaa"
      >
        {`SIDE ${activeSide}`}
      </text>

      {/* ── Mechanism window (dark, below label) ──────────────────────────── */}
      <rect x={82} y={166} width={436} height={116} rx={12} fill="#0d0d0d" />

      {/* Reels */}
      <Reel cx={196} cy={226} fill={leftFill} />
      <Reel cx={404} cy={226} fill={rightFill} />

      {/* Tape bridge enclosure */}
      <rect x={BRIDGE_X} y={BRIDGE_Y} width={BRIDGE_W} height={BRIDGE_H} rx={5} fill="#131313" />

      {/* Magnetic tape strip */}
      <rect x={BRIDGE_X + 14} y={BRIDGE_Y + 14} width={BRIDGE_W - 28} height={11} rx={3} fill="#1e0e00" />
      {/* Tape sheen */}
      <rect x={BRIDGE_X + 14} y={BRIDGE_Y + 14} width={BRIDGE_W - 28} height={4}  rx={2} fill="#2a1400" opacity={0.7} />

      {/* Left guide roller */}
      <circle cx={BRIDGE_X + 11} cy={BRIDGE_Y + 20} r={9}   fill="#c4c4c2" />
      <circle cx={BRIDGE_X + 11} cy={BRIDGE_Y + 20} r={4.5} fill="#1a1a1a" />

      {/* Right guide roller */}
      <circle cx={BRIDGE_X + BRIDGE_W - 11} cy={BRIDGE_Y + 20} r={9}   fill="#c4c4c2" />
      <circle cx={BRIDGE_X + BRIDGE_W - 11} cy={BRIDGE_Y + 20} r={4.5} fill="#1a1a1a" />

      {/* Mechanism vignette overlay */}
      <rect x={82} y={166} width={436} height={116} rx={12} fill="url(#mechVignette)" stroke="#222" strokeWidth={1} />
    </svg>
  );
}
