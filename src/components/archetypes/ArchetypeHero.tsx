"use client";

import { useState } from "react";
import { ARCHETYPES, JUNG_CORE_DESIRES } from "@/lib/archetypes/archetypeConfig";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";
const RULE  = "#e0e0da";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const MUTED  = "#8a7e76";

interface Props {
  primary: string;
  primaryScore: number;
  secondary: string | null;
  secondaryScore: number;
  shadow: string;
  shadowScore: number;
  namedPairing: string | null;
}

function hexToMuted(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const avg = Math.round((r * 0.299 + g * 0.587 + b * 0.114) * 0.5 + 140)
  return `rgb(${avg},${avg},${avg})`
}

function ArchetypeColumn({
  role,
  archetypeId,
  score,
}: {
  role: "primary" | "secondary" | "shadow";
  archetypeId: string | null;
  score: number;
}) {
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const roleLabel = role === "primary" ? "PRIMARY" : role === "secondary" ? "SECONDARY" : "SHADOW";
  const isShadow  = role === "shadow";
  const isWeak    = role === "secondary" && score < 30;
  const barColor  = isShadow
    ? (archetype ? hexToMuted(archetype.color) : MUTED)
    : (archetype?.color ?? ORANGE);

  return (
    <div style={{ flex: 1, paddingLeft: 16, paddingRight: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: ORANGE, marginBottom: 6 }}>
        {roleLabel}
      </div>
      <div style={{
        fontFamily: SERIF,
        fontSize: "1.1rem",
        fontWeight: 700,
        color: isWeak ? MUTED : (archetype?.color ?? INK),
        marginBottom: 4,
      }}>
        {isWeak ? "—" : (archetype?.name ?? "—")}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginBottom: 10 }}>
        {isWeak ? "Secondary signal weak" : (archetype?.japanese ?? "—")}
      </div>

      {/* Score bar */}
      <div style={{ width: 80, height: 2, background: RULE, marginBottom: 4 }}>
        <div style={{ width: `${isWeak ? 0 : score}%`, height: "100%", background: barColor }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {isWeak ? "— / 100" : `${score} / 100`}
      </div>
      {archetype?.jungianRoot && (() => {
        const primaryJung = archetype.jungianRoot.split("·")[0].trim();
        const desire = JUNG_CORE_DESIRES[primaryJung];
        return (
          <div style={{ marginBottom: isShadow ? 10 : 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: desire ? 4 : 0 }}>
              Jung: {primaryJung}
            </div>
            {desire && (
              <div style={{ fontFamily: MONO, fontSize: 9, fontStyle: "italic", color: MUTED, lineHeight: 1.5 }}>
                &ldquo;{desire}&rdquo;
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}

export default function ArchetypeHero({
  primary,
  primaryScore,
  secondary,
  secondaryScore,
  shadow,
  shadowScore,
  namedPairing,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const primaryDef   = ARCHETYPES[primary];
  const secondaryDef = secondary ? ARCHETYPES[secondary] : null;

  return (
    <div className="rk-arch-hero" style={{ display: "flex", gap: 32, alignItems: "center", marginBottom: 48 }}>

      {/* Left — image */}
      <div
        className="hidden md:block"
        style={{ position: "relative", width: 340, minHeight: 460, flexShrink: 0 }}
      >
        {!imgError && primaryDef ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryDef.imagePath}
            alt={primaryDef.name}
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
              filter: "contrast(1.05)",
              minHeight: 460,
            }}
          />
        ) : (
          <div style={{
            width: "100%",
            minHeight: 460,
            background: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{
              fontFamily: SERIF,
              fontSize: "4rem",
              color: primaryDef?.color ?? ORANGE,
            }}>
              {primaryDef?.japanese ?? ""}
            </span>
          </div>
        )}
        <div style={{
          position: "absolute", bottom: 12, left: 12,
          fontFamily: "Courier New", fontSize: 10,
          letterSpacing: "0.12em", color: "#FDF6F0",
          opacity: 0.7,
        }}>
          {String(Object.keys(ARCHETYPES).indexOf(primary) + 1).padStart(2, "0")} / {Object.keys(ARCHETYPES).length}
        </div>
      </div>

      {/* Mobile image (full width, stacked) */}
      <div className="md:hidden" style={{ width: "100%", marginBottom: 24 }}>
        <div style={{ position: "relative", width: "100%", height: 280 }}>
          {!imgError && primaryDef ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryDef.imagePath}
              alt={primaryDef.name}
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "contrast(1.05)" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: SERIF, fontSize: "4rem", color: primaryDef?.color ?? ORANGE }}>{primaryDef?.japanese ?? ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right — content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Sub-section A — Three archetype columns */}
        <div style={{ display: "flex", borderBottom: `1px solid ${RULE}`, paddingBottom: 20, marginBottom: 20 }}>
          <ArchetypeColumn role="primary" archetypeId={primary} score={primaryScore} />
          <div style={{ width: 1, background: RULE, alignSelf: "stretch" }} />
          <ArchetypeColumn role="secondary" archetypeId={secondary} score={secondaryScore} />
          <div style={{ width: 1, background: RULE, alignSelf: "stretch" }} />
          <ArchetypeColumn role="shadow" archetypeId={shadow} score={shadowScore} />
        </div>

        {/* Sub-section B — Short description */}
        {primaryDef && (
          <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 20, marginBottom: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: ORANGE, marginBottom: 6 }}>
              {primaryDef.name} Archetype
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
              {primaryDef.shortDescription}
            </div>
          </div>
        )}

        {/* Sub-section C — Archetypal sentence */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 20, marginBottom: 20 }}>
          <blockquote style={{
            fontFamily: SERIF,
            fontSize: "1rem",
            fontStyle: "italic",
            color: INK,
            margin: 0,
            paddingLeft: 16,
          }}>
            &ldquo;{primaryDef?.sentence ?? ""}&rdquo;
          </blockquote>
        </div>

        {/* Sub-section D — Named pairing block */}
        {secondary && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: ORANGE, marginBottom: 6 }}>
              PRIMARY + SECONDARY
            </div>
            <div style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 700, color: INK, marginBottom: 4 }}>
              {namedPairing ?? `${primaryDef?.name ?? primary} · ${secondaryDef?.name ?? secondary}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
