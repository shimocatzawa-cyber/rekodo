"use client";

import { useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import SupporterContent from "@/components/profile/SupporterContent";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";

const BODY_PARAGRAPHS = [
  "Not because streaming doesn't work. Because owning music means something different. A record is a commitment. It takes up space. It has a weight and a smell and a history.",
  "We built rekōdo because the serious collector deserved something built for them. Not an algorithm. Not a playlist. A mirror — one that reflects twenty years of taste back at you and says: this is who you are.",
  "rekōdo is independent, ad-free, and built by people who own too many records. If rekōdo has given you something — a recommendation that changed your week, a list that made you think, a Dig that found the record you didn't know you needed — consider buying us one back.",
];

type SupportTab = "support" | "faqs" | "contact";

const TABS: { key: SupportTab; label: string }[] = [
  { key: "support", label: "Support rekōdo" },
  { key: "faqs",    label: "FAQs"           },
  { key: "contact", label: "Contact"         },
];

interface Props {
  username:     string | null;
  displayLabel: string | null;
  avatarUrl:    string | null;
  isOwner:      boolean;
  isSupporter:  boolean;
  userId?:      string;
  success?:     "subscription" | "donation" | null;
}

export default function AboutClient({
  username, displayLabel, avatarUrl,
  isOwner, isSupporter, userId, success,
}: Props) {
  const [activeTab, setActiveTab] = useState<SupportTab>("support");

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* Nav */}
      {username ? (
        <AppNav username={username} displayLabel={displayLabel ?? undefined} avatarUrl={avatarUrl} />
      ) : (
        <nav style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 40px" }}>
          <Link
            href="/"
            aria-label="rekōdo home"
            style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, textDecoration: "none", lineHeight: 1 }}
          >
            ō
          </Link>
        </nav>
      )}

      {/* Sub-navigation */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "24px",
        paddingTop: "14px", paddingBottom: "2px",
        background: "#ffffff",
      }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", background: "none", border: "none",
              borderBottom: `1.5px solid ${activeTab === key ? ORANGE : "transparent"}`,
              padding: "6px 0",
              color: activeTab === key ? INK : "#bbbbbb",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "support" && (
        <>
          <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px 80px" }}>
            <h1 style={{
              fontFamily: SERIF,
              fontSize: "clamp(52px, 8vw, 88px)",
              fontWeight: 400,
              color: "#0d0d0d",
              lineHeight: 1,
              margin: "0 0 24px 0",
              letterSpacing: "-0.01em",
            }}>
              rek<span style={{ color: ORANGE }}>ō</span>do
            </h1>

            <p style={{
              fontFamily: SERIF,
              fontSize: "clamp(18px, 2.5vw, 24px)",
              fontWeight: 400,
              color: "#888888",
              lineHeight: 1.4,
              margin: "0 0 56px 0",
              fontStyle: "italic",
            }}>
              Built for the person who still buys records.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {BODY_PARAGRAPHS.map((p, i) => (
                <p key={i} style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(16px, 2vw, 19px)",
                  color: "#303030",
                  lineHeight: 1.75,
                  margin: 0,
                }}>
                  {p}
                </p>
              ))}
            </div>
          </main>

          <div style={{ borderTop: "1px solid #e0e0da", maxWidth: 960, margin: "0 auto 80px", padding: "0 32px" }}>
            <SupporterContent
              isOwner={isOwner}
              isSupporter={isSupporter}
              userId={userId}
              success={success}
            />
          </div>
        </>
      )}

      {activeTab === "faqs" && (
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px 80px" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em",
            textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 40px",
          }}>
            FAQs
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "clamp(16px, 2vw, 19px)", color: "#aaaaaa", fontStyle: "italic" }}>
            Content coming soon.
          </p>
        </main>
      )}

      {activeTab === "contact" && (
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px 80px" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em",
            textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 40px",
          }}>
            Contact
          </p>
          <p style={{ fontFamily: SERIF, fontSize: "clamp(16px, 2vw, 19px)", color: "#aaaaaa", fontStyle: "italic" }}>
            Content coming soon.
          </p>
        </main>
      )}

    </div>
  );
}
