"use client";

import { useState } from "react";

const SERIF     = "var(--font-editorial)";
const MONO      = "var(--font-mono)";
const ORANGE    = "#CC5500";
const BADGE_GOLD = "#D4A800";
const RULE      = "#e0e0da";
const INK       = "#0a0a0a";

const SUBSCRIPTION_PERKS = [
  { category: "Identity",     description: "Golden ō badge" },
  { category: "Intelligence", description: "Deep Dive full access" },
  { category: "Insights",     description: "Taste Insights dashboard" },
  { category: "Discovery",    description: "Dig unlimited regeneration" },
  { category: "Collection",   description: "Wantlist upload" },
];

interface Props {
  isOwner:     boolean;
  isSupporter: boolean;
}

export default function SupporterContent({ isOwner, isSupporter }: Props) {
  const [donationAmount, setDonationAmount] = useState("");

  return (
    <div style={{ padding: "3rem 0 5rem" }}>

      {/* Section label */}
      <p style={{
        fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em",
        textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 28px",
      }}>
        Support rekōdo
      </p>

      {/* Already supporting */}
      {isOwner && isSupporter && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            border: `1px solid ${BADGE_GOLD}`, background: "#FFF8E6",
            padding: "12px 20px",
          }}>
            <span style={{ fontFamily: SERIF, fontSize: "1.4rem", color: BADGE_GOLD, lineHeight: 1 }}>ō</span>
            <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", color: BADGE_GOLD, margin: 0 }}>
              You&rsquo;re a Supporter — thank you.
            </p>
          </div>
        </div>
      )}

      {/* Two-option grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: RULE, marginBottom: 48 }}>

        {/* ── Option 1: Regular commitment ─────────────────────────────── */}
        <div style={{ background: "#ffffff", padding: "28px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.16em",
            textTransform: "uppercase", color: ORANGE, margin: "0 0 20px",
          }}>
            Regular Commitment
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 28 }}>
            <span style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 400, color: INK, lineHeight: 1 }}>
              $5
            </span>
            <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#888" }}>
              USD / month
            </span>
          </div>

          <p style={{
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 14px",
          }}>
            Unlocks
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, flex: 1 }}>
            {SUBSCRIPTION_PERKS.map(perk => (
              <div key={perk.category} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span style={{
                  fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", color: ORANGE, flexShrink: 0, minWidth: 80,
                }}>
                  {perk.category}
                </span>
                <span style={{ fontFamily: SERIF, fontSize: "0.9rem", color: INK }}>
                  {perk.description}
                </span>
              </div>
            ))}
          </div>

          {isOwner && !isSupporter && (
            <div>
              <button
                disabled
                title="Payment setup coming soon"
                style={{
                  fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "#FDF6F0", background: INK,
                  border: "none", padding: "13px 0", cursor: "not-allowed",
                  opacity: 0.7, width: "100%",
                }}
              >
                Become a Supporter →
              </button>
              <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: "8px 0 0" }}>
                Cancel anytime · Stripe-secured
              </p>
            </div>
          )}
        </div>

        {/* ── Option 2: One-off donation ────────────────────────────────── */}
        <div style={{ background: "#ffffff", padding: "28px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.16em",
            textTransform: "uppercase", color: ORANGE, margin: "0 0 20px",
          }}>
            One-off Donation
          </p>

          <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.04em", color: "#888", margin: "0 0 14px" }}>
            You choose the amount.
          </p>

          {/* Amount input */}
          <div style={{
            display: "inline-flex", alignItems: "center",
            border: `1px solid ${RULE}`, marginBottom: 28, maxWidth: 160,
          }}>
            <span style={{ fontFamily: MONO, fontSize: "0.85rem", color: "#aaaaaa", padding: "10px 8px 10px 14px" }}>
              $
            </span>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={donationAmount}
              onChange={e => setDonationAmount(e.target.value)}
              style={{
                fontFamily: SERIF, fontSize: "1.4rem", color: INK,
                border: "none", outline: "none", width: "100%",
                padding: "8px 12px 8px 0", background: "transparent",
              }}
            />
          </div>

          <p style={{
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 14px",
          }}>
            Includes
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 32, flex: 1 }}>
            <span style={{
              fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.1em",
              textTransform: "uppercase", color: BADGE_GOLD, flexShrink: 0, minWidth: 80,
            }}>
              Identity
            </span>
            <span style={{ fontFamily: SERIF, fontSize: "0.9rem", color: INK }}>
              Golden <span style={{ color: BADGE_GOLD }}>ō</span> badge
            </span>
          </div>

          {isOwner && (
            <div>
              <button
                disabled
                title="Payment setup coming soon"
                style={{
                  fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "#FDF6F0", background: INK,
                  border: "none", padding: "13px 0", cursor: "not-allowed",
                  opacity: 0.7, width: "100%",
                }}
              >
                Donate →
              </button>
              <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: "8px 0 0" }}>
                Stripe-secured
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Bottom note */}
      <div style={{ background: "#f0ebe4", borderLeft: `3px solid ${RULE}`, padding: "20px 24px" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: "#666", lineHeight: 1.8, margin: 0 }}>
          rekōdo is ad-free and independent. There is no investor, no growth team, no
          algorithm optimising for your attention. A Supporter subscription is the direct
          line between this product existing and continuing to exist.
        </p>
      </div>

    </div>
  );
}
