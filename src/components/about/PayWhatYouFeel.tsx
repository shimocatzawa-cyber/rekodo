"use client";

import { useState } from "react";

const MONO = "var(--font-mono)";
const SERIF = "var(--font-editorial)";
const ORANGE = "#CC5500";
const GOLD = "#C9A84C";

const PRESET_AMOUNTS = [5, 10, 25] as const;

export default function PayWhatYouFeel({ stripeLink }: { stripeLink: string }) {
  const [selected, setSelected] = useState<number | "custom">(10);
  const [customValue, setCustomValue] = useState("");

  const activeAmount = selected === "custom"
    ? (parseFloat(customValue) || null)
    : selected;

  const href = activeAmount
    ? `${stripeLink}?prefilled_amount=${Math.round(activeAmount * 100)}`
    : stripeLink;

  return (
    <section style={{ marginTop: 72 }}>
      <div style={{ height: 1, background: "rgba(0,0,0,0.07)", marginBottom: 52 }} />

      <p style={{
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#aaaaaa",
        margin: "0 0 20px 0",
      }}>
        Support
      </p>

      <h2 style={{
        fontFamily: SERIF,
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 400,
        color: "#0d0d0d",
        margin: "0 0 10px 0",
        lineHeight: 1.15,
      }}>
        Buy us a record
      </h2>

      <p style={{
        fontFamily: MONO,
        fontStyle: "italic",
        fontSize: 12,
        color: "#aaaaaa",
        letterSpacing: "0.04em",
        margin: "0 0 32px 0",
      }}>
        Pay what you feel. No pressure.
      </p>

      {/* Amount buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {PRESET_AMOUNTS.map((amt) => (
          <button
            key={amt}
            onClick={() => setSelected(amt)}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: selected === amt ? "#ffffff" : "#0d0d0d",
              background: selected === amt ? ORANGE : "transparent",
              border: `1px solid ${selected === amt ? ORANGE : "rgba(0,0,0,0.15)"}`,
              padding: "8px 18px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            ${amt}
          </button>
        ))}

        {/* Custom button + optional input */}
        <button
          onClick={() => setSelected("custom")}
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.08em",
            color: selected === "custom" ? "#ffffff" : "#0d0d0d",
            background: selected === "custom" ? ORANGE : "transparent",
            border: `1px solid ${selected === "custom" ? ORANGE : "rgba(0,0,0,0.15)"}`,
            padding: "8px 18px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Custom
        </button>

        {selected === "custom" && (
          <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(0,0,0,0.15)", padding: "7px 12px" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#aaaaaa", marginRight: 4 }}>$</span>
            <input
              autoFocus
              type="number"
              min={1}
              placeholder="0"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "#0d0d0d",
                background: "none",
                border: "none",
                outline: "none",
                width: 60,
                padding: 0,
              }}
            />
          </div>
        )}
      </div>

      {/* CTA */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#ffffff",
          background: ORANGE,
          textDecoration: "none",
          padding: "12px 28px",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Support rekōdo ↗
      </a>

      {/* Donor note */}
      <p style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.05em",
        color: "#aaaaaa",
        margin: "16px 0 0 0",
        lineHeight: 1.8,
      }}>
        Supporters receive a{" "}
        <span style={{ fontFamily: SERIF, color: GOLD, fontSize: "0.95em" }}>ō</span>
        {" "}on their rekōdo profile.
      </p>
    </section>
  );
}
