"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SERIF      = "var(--font-editorial)";
const MONO       = "var(--font-mono)";
const ORANGE     = "#CC5500";
const BADGE_GOLD = "#D4A800";
const RULE       = "#e0e0da";
const INK        = "#0a0a0a";

const SUBSCRIPTION_PERKS = [
  { category: "Identity",   description: "Golden ō badge" },
  { category: "Deep Dive",  description: "Access to Deep Dive Artist feature" },
  { category: "Insights",   description: "Taste Profile" },
  { category: "Archetypes", description: "What your collection says about you" },
  { category: "Discovery",  description: "Dig unlimited regeneration" },
  { category: "Lists",      description: "Unlimited playlist generations" },
  { category: "Wantlist",   description: "Wantlist Upload feature" },
];

const PRESET_AMOUNTS = [5, 10, 20];

interface Props {
  isOwner:      boolean;
  isSubscriber: boolean;
  isDonor:      boolean;
  userId?:      string;
  success?:     "subscription" | "donation" | null;
}

interface LocalPrice {
  unit_amount: number;
  currency: string;
}

function formatLocalPrice({ unit_amount, currency }: LocalPrice): string {
  const major = unit_amount / 100;
  const isWhole = major === Math.floor(major);
  const formatted = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
    currencyDisplay: "narrowSymbol",
  }).format(major);
  return currency.toLowerCase() === "usd"
    ? formatted
    : `${formatted} ${currency.toUpperCase()}`;
}

export default function SupporterContent({ isOwner, isSubscriber, isDonor, userId, success }: Props) {
  const [preset, setPreset]               = useState<number | null>(null);
  const [customAmount, setCustomAmount]   = useState("");
  const [loading, setLoading]             = useState<"subscription" | "donation" | null>(null);
  const PORTAL_URL = "https://billing.stripe.com/p/login/5kQ28r0ekcFZdSZ8pS5c400";
  const [localPrice, setLocalPrice]       = useState<LocalPrice | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/stripe/price")
      .then(r => r.json())
      .then((d: LocalPrice) => setLocalPrice(d))
      .catch(() => {});
  }, []);

  const donationValue = preset !== null ? preset : (customAmount ? Number(customAmount) : 0);
  const donationValid = donationValue >= 1 && Number.isInteger(donationValue);

  function selectPreset(amount: number) {
    setPreset(amount);
    setCustomAmount("");
  }

  function handleCustomInput(val: string) {
    setPreset(null);
    setCustomAmount(val.replace(/[^0-9]/g, ""));
  }

  async function handleCheckout(type: "subscription" | "donation") {
    if (!userId) return;
    setLoading(type);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "donation"
            ? { type, amount: donationValue, currency: localPrice?.currency ?? "usd" }
            : { type }
        ),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        router.push(data.url);
      } else {
        alert(data.error ?? "Something went wrong");
        setLoading(null);
      }
    } catch {
      alert("Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div style={{ padding: "3rem 0 5rem" }}>

      {/* Payment success banner */}
      {success && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#F0FAF0", border: "1px solid #6abf6a",
          padding: "14px 20px", marginBottom: 32,
        }}>
          <span style={{ fontFamily: SERIF, fontSize: "1.2rem", color: "#3a7a3a" }}>✓</span>
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.06em", color: "#3a7a3a", margin: 0 }}>
            {success === "subscription"
              ? "Welcome to the collective — your badge will appear shortly."
              : "Donation received — your golden ō badge will appear shortly. Thank you."}
          </p>
        </div>
      )}

      {/* Section header */}
      <h2 style={{
        fontFamily: SERIF,
        fontSize: "clamp(2rem, 5vw, 3.2rem)",
        fontWeight: 400,
        color: INK,
        lineHeight: 1,
        letterSpacing: "-0.01em",
        margin: "0 0 40px",
      }}>
        Support rek<span style={{ color: ORANGE }}>ō</span>do
      </h2>

      {/* Two-option grid */}
      <div className="rk-supporter-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: RULE }}>

        {/* ── Option 1: Regular commitment / Active subscription ────────── */}
        <div style={{ background: "#ffffff", padding: "28px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.16em",
            textTransform: "uppercase", color: ORANGE, margin: "0 0 20px",
          }}>
            Regular Commitment
          </p>

          {isOwner && isSubscriber ? (
            /* ── Subscriber state ── */
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <span style={{
                  fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 2.8rem)",
                  fontWeight: 400, color: BADGE_GOLD, lineHeight: 1,
                }}>
                  ō
                </span>
                <div>
                  <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", color: BADGE_GOLD, margin: "0 0 4px" }}>
                    You&rsquo;re a Supporter
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      display: "inline-block", width: 7, height: 7,
                      borderRadius: "50%", background: "#4caf50", flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: "#4caf50" }}>
                      Subscription active
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, flex: 1 }}>
                {SUBSCRIPTION_PERKS.map(perk => (
                  <div key={perk.category} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                    <span style={{
                      fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.1em",
                      textTransform: "uppercase", color: ORANGE, flexShrink: 0, minWidth: 88,
                    }}>
                      {perk.category}
                    </span>
                    <span style={{ fontFamily: SERIF, fontSize: "0.9rem", color: INK }}>
                      {perk.category === "Identity"
                        ? <>Golden <span style={{ color: BADGE_GOLD }}>ō</span> badge</>
                        : perk.description}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <a
                  href={PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block", textAlign: "center",
                    fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em",
                    textTransform: "uppercase", color: INK, background: "#fff",
                    border: `1px solid ${RULE}`, padding: "13px 0",
                    textDecoration: "none",
                  }}
                >
                  Manage subscription →
                </a>
                <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: "8px 0 0" }}>
                  Update payment · Cancel anytime · Stripe-secured
                </p>
              </div>
            </>
          ) : (
            /* ── Non-subscriber state ── */
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 400, color: INK, lineHeight: 1 }}>
                  {localPrice ? formatLocalPrice(localPrice) : "—"}
                </span>
                <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#888" }}>
                  / month
                </span>
              </div>
              <div style={{ marginBottom: 28 }} />

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
                      textTransform: "uppercase", color: ORANGE, flexShrink: 0, minWidth: 88,
                    }}>
                      {perk.category}
                    </span>
                    <span style={{ fontFamily: SERIF, fontSize: "0.9rem", color: INK }}>
                      {perk.category === "Identity"
                        ? <>Golden <span style={{ color: BADGE_GOLD }}>ō</span> badge</>
                        : perk.description}
                    </span>
                  </div>
                ))}
              </div>

              {isOwner && (
                <div>
                  <button
                    onClick={() => handleCheckout("subscription")}
                    disabled={loading !== null}
                    style={{
                      fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "#FDF6F0", background: INK,
                      border: "none", padding: "13px 0",
                      cursor: loading !== null ? "not-allowed" : "pointer",
                      opacity: loading !== null ? 0.6 : 1, width: "100%",
                    }}
                  >
                    {loading === "subscription" ? "Redirecting…" : "Become a Supporter →"}
                  </button>
                  <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: "8px 0 0" }}>
                    Cancel anytime · Stripe-secured
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Option 2: One-off donation ────────────────────────────────── */}
        <div style={{ background: "#ffffff", padding: "28px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.16em",
            textTransform: "uppercase", color: ORANGE, margin: "0 0 16px",
          }}>
            One-off Donation
          </p>

          <p style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 400, color: INK, lineHeight: 1, margin: "0 0 12px" }}>
            Buy me a record
          </p>

          <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.04em", color: "#888", lineHeight: 1.7, margin: "0 0 28px" }}>
            No subscription. Just a one-time contribution if rekōdo has been useful to you.
          </p>

          {/* Preset + custom amount */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {PRESET_AMOUNTS.map(amount => (
                <button
                  key={amount}
                  onClick={() => selectPreset(amount)}
                  style={{
                    fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em",
                    padding: "9px 16px", border: `1px solid ${preset === amount ? INK : RULE}`,
                    background: preset === amount ? INK : "#fff",
                    color: preset === amount ? "#FDF6F0" : INK,
                    cursor: "pointer",
                  }}
                >
                  {localPrice
                    ? formatLocalPrice({ unit_amount: amount * 100, currency: localPrice.currency })
                    : `$${amount}`}
                </button>
              ))}
            </div>

            <div style={{
              display: "inline-flex", alignItems: "center",
              border: `1px solid ${preset === null && customAmount ? INK : RULE}`,
              maxWidth: 160,
            }}>
              <span style={{ fontFamily: MONO, fontSize: "0.85rem", color: "#aaaaaa", padding: "9px 6px 9px 12px" }}>
                {localPrice ? new Intl.NumberFormat("en", { style: "currency", currency: localPrice.currency.toUpperCase(), maximumFractionDigits: 0 }).format(0).replace(/[\d.,\s]/g, "").trim() : "$"}
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Other"
                value={customAmount}
                onChange={e => handleCustomInput(e.target.value)}
                style={{
                  fontFamily: MONO, fontSize: "0.85rem", color: INK,
                  border: "none", outline: "none", width: "100%",
                  padding: "9px 12px 9px 4px", background: "transparent",
                }}
              />
            </div>
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
              textTransform: "uppercase", color: BADGE_GOLD, flexShrink: 0, minWidth: 88,
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
                onClick={() => handleCheckout("donation")}
                disabled={loading !== null || !donationValid}
                style={{
                  fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "#FDF6F0", background: INK,
                  border: "none", padding: "13px 0",
                  cursor: (loading !== null || !donationValid) ? "not-allowed" : "pointer",
                  opacity: (loading !== null || !donationValid) ? 0.5 : 1,
                  width: "100%",
                }}
              >
                {loading === "donation" ? "Redirecting…" : "Donate →"}
              </button>
              <p style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.06em", color: "#aaaaaa", margin: "8px 0 0" }}>
                Stripe-secured
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
