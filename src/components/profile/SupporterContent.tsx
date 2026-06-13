"use client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const GOLD   = "#B8860B";
const BADGE_GOLD = "#D4A800";
const RULE   = "#e0e0da";
const INK    = "#0a0a0a";

const PERKS = [
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
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 3.5rem 5rem" }}>

      {/* Badge pill */}
      <div style={{ marginBottom: 32 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#FFF8E6",
          border: `1px solid ${BADGE_GOLD}`,
          padding: "7px 14px",
          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em",
          color: BADGE_GOLD,
        }}>
          <span style={{ fontSize: "0.8rem" }}>✦</span>
          Supporter ·{" "}
          <span style={{ fontFamily: SERIF, fontSize: "1rem", lineHeight: 1 }}>ō</span>
          {" "}golden badge
        </span>
      </div>

      {/* Price */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 10,
        marginBottom: 28,
      }}>
        <span style={{
          fontFamily: SERIF, fontSize: "clamp(2.4rem, 5vw, 3.2rem)",
          fontWeight: 400, color: INK, lineHeight: 1,
        }}>
          $5
        </span>
        <span style={{
          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em",
          textTransform: "uppercase", color: "#888",
        }}>
          USD / month
        </span>
      </div>

      {/* CTA area */}
      {isOwner && !isSupporter && (
        <div style={{ marginBottom: 12 }}>
          <button
            disabled
            title="Payment setup coming soon"
            style={{
              fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#FDF6F0", background: INK,
              border: "none", borderRadius: 0,
              padding: "14px 32px",
              cursor: "not-allowed", opacity: 0.7,
              display: "block",
            }}
          >
            Become a Supporter
          </button>
          <p style={{
            fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em",
            color: "#aaaaaa", margin: "10px 0 0",
          }}>
            Cancel anytime · Stripe-secured
          </p>
        </div>
      )}

      {isOwner && isSupporter && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            border: `1px solid ${BADGE_GOLD}`,
            background: "#FFF8E6",
            padding: "12px 20px",
          }}>
            <span style={{ fontFamily: SERIF, fontSize: "1.4rem", color: BADGE_GOLD, lineHeight: 1 }}>ō</span>
            <p style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em",
              color: BADGE_GOLD, margin: 0,
            }}>
              You&rsquo;re a Supporter — thank you.
            </p>
          </div>
        </div>
      )}

      {/* Perks grid */}
      <div style={{ marginBottom: 48, marginTop: isOwner ? 40 : 28 }}>
        <p style={{
          fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 14px",
        }}>
          What extras you get
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          border: `1px solid ${RULE}`,
        }}>
          {PERKS.map((perk, i) => {
            const isLastOdd = i === PERKS.length - 1 && PERKS.length % 2 === 1;
            return (
              <div
                key={perk.category}
                style={{
                  padding: "18px 20px",
                  borderRight:  i % 2 === 0 && !isLastOdd ? `1px solid ${RULE}` : "none",
                  borderBottom: i < PERKS.length - (PERKS.length % 2 === 1 ? 1 : 2)
                    ? `1px solid ${RULE}`
                    : "none",
                  gridColumn: isLastOdd ? "1 / -1" : undefined,
                }}
              >
                <p style={{
                  fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", color: ORANGE, margin: "0 0 5px",
                }}>
                  {perk.category}
                </p>
                <p style={{
                  fontFamily: SERIF, fontSize: "0.95rem", color: INK, margin: 0,
                }}>
                  {perk.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom note bar */}
      <div style={{
        background: "#f0ebe4",
        borderLeft: `3px solid ${RULE}`,
        padding: "20px 24px",
      }}>
        <p style={{
          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em",
          color: "#666", lineHeight: 1.8, margin: 0,
        }}>
          rekōdo is ad-free and independent. There is no investor, no growth
          team, no algorithm optimising for your attention. A Supporter
          subscription is the direct line between this product existing and
          continuing to exist.
        </p>
      </div>

    </div>
  );
}
