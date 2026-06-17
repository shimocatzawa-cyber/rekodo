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
  "We built rekōdo because the serious collector deserves a site just for them. Not an algorithm but a mirror that reflects twenty years of taste back at you and says: this is who you are. A record collection is a commitment. It takes up space. It has a weight and a smell and a history.",
  "rekōdo is independent and built by people who own too many records. If rekōdo has given you something, a recommendation that changed your week, a list that made you think, a Dig that found the record you didn't know you needed, consider supporting us or buying us one back.",
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
  isSubscriber: boolean;
  isDonor:      boolean;
  userId?:      string;
  success?:     "subscription" | "donation" | null;
}

export default function AboutClient({
  username, displayLabel, avatarUrl,
  isOwner, isSubscriber, isDonor, userId, success,
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
      <div className="rk-about-tabs" style={{
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
              Your records say everything about you.
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
              isSubscriber={isSubscriber}
              isDonor={isDonor}
              userId={userId}
              success={success}
            />
          </div>
        </>
      )}

      {activeTab === "faqs" && (
        <FaqTab />
      )}

      {activeTab === "contact" && (
        <ContactTab />
      )}

    </div>
  );
}

// ─── FAQ tab ──────────────────────────────────────────────────────────────────

const FAQ_SECTIONS: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: "Getting Started",
    items: [
      {
        q: "Do I need a Discogs account?",
        a: "Yes. rekōdo connects to your Discogs collection to import your records. If you don't have one, you can create a free account at discogs.com before connecting.",
      },
      {
        q: "How do I connect my Discogs collection?",
        a: "During onboarding you'll be prompted to authorise rekōdo via Discogs OAuth. This grants read access to your collection — rekōdo never writes to or modifies your Discogs data.",
      },
      {
        q: "How long does the first sync take?",
        a: "It depends on collection size. A few hundred records takes under a minute. Collections of 1,000+ records can take considerably longer — expect 10–15 minutes as rekōdo fetches metadata, market prices, and community data for each release.",
      },
    ],
  },
  {
    section: "Collection",
    items: [
      {
        q: "How do I keep my collection up to date?",
        a: "Use the Sync button in your Collection. rekōdo will pull any new additions or removals from Discogs and update market prices at the same time.",
      },
      {
        q: "What does the market value show?",
        a: "Market value reflects the lowest active listing price for each record on Discogs at the time of your last sync. It's a useful guide but not a precise valuation — prices shift constantly and the figure won't update until your next sync. Values are converted to your local currency based on your country setting.",
      },
      {
        q: "What are the desirability tiers?",
        a: "Desirability is calculated from Discogs community data — how many people have it vs. want it, current for-sale listings, and median sale price. Tiers run from Holy Grail (extremely rare, highly sought) through Rare, Cult Pressing, In Demand, and Widely Loved.",
      },
      {
        q: "What does 'last played' mean?",
        a: "You can log a play directly from your Collection by tapping the play icon on any record. Last played timestamps feed into your Taste Profile, showing which parts of your collection you actually reach for.",
      },
      {
        q: "Can other people see my collection?",
        a: "Your collection is private by default. Your public profile (at rekōdo.co/@username) shows only what you choose to make visible — lists you've created and any records you've marked open to offers.",
      },
      {
        q: "What does 'open to offers' mean?",
        a: "Marking a record as open to offers flags it on your public profile so other collectors can contact you about it. rekōdo doesn't facilitate the transaction — it's just a signal.",
      },
    ],
  },
  {
    section: "Insights",
    items: [
      {
        q: "How is my collection value calculated?",
        a: "rekōdo uses the official Discogs collection value figures when available (synced with each collection update). If those aren't populated yet, it aggregates median sale prices across your individual records as a fallback.",
      },
      {
        q: "What is the Taste Profile?",
        a: "Taste Profile is the second tab in Insights. It analyses your collection across seven dimensions — from Ambient vs. Abrasive to Canon vs. Obscure — and plots where you sit on each axis based on actual data from your records.",
      },
      {
        q: "What do the Spectrum Dimensions mean?",
        a: "Each axis measures a real quality of your collection. Canon ↔ Obscure uses Discogs have/want ratios. Nostalgic ↔ Contemporary uses pressing years. Completist measures how many artists you own 3+ records by. Vinyl pure ↔ Format agnostic compares vinyl to any digital imports you've added.",
      },
      {
        q: "Why does some data say it needs a resync?",
        a: "Style data (used in the Style breakdown and some Spectrum Dimensions) requires a full collection resync to populate — Discogs doesn't always include it in the standard collection endpoint. A full sync from the Collection page will fill it in.",
      },
      {
        q: "What is the collection lifespan chart?",
        a: "It shows when you added records to your collection over time — by month for collections spanning a few years, by year for longer ones. It's a picture of how your collecting habit has evolved.",
      },
    ],
  },
  {
    section: "Dig",
    items: [
      {
        q: "How does Dig work?",
        a: "Dig analyses your collection — genres, styles, labels, and lists you've built — and uses that as a prompt to generate personalised record recommendations. Each session produces a fresh set. It's AI-powered, not an algorithm pulling from a fixed catalogue.",
      },
      {
        q: "Can I add a recommendation to my wantlist?",
        a: "Yes. Each recommendation has an Add to Wantlist button. It'll appear in your wantlist on Discogs and in rekōdo.",
      },
      {
        q: "Where do the search links go?",
        a: "Each recommendation links out to Bandcamp, Spotify, and Apple Music search results for that release so you can listen before you buy.",
      },
    ],
  },
  {
    section: "Deep Dive",
    items: [
      {
        q: "What is Deep Dive?",
        a: "Deep Dive takes a single artist from your collection and surfaces everything rekōdo knows about them — every record you own, pressing details, market values, and how they connect to the rest of your collection.",
      },
      {
        q: "How do I choose an artist?",
        a: "Use the artist dropdown at the top of the page. It lists every artist in your collection. On desktop, section tabs let you jump between records, pressing details, and related context.",
      },
    ],
  },
  {
    section: "Gigs",
    items: [
      {
        q: "How does rekōdo find gigs?",
        a: "rekōdo cross-references the artists in your collection against live event data from Ticketmaster and looks for upcoming shows. Only artists you actually own records by will appear.",
      },
      {
        q: "What location does it use?",
        a: "rekōdo uses the country set in your profile to filter events. If you're not seeing results, check that your country is set correctly in Settings.",
      },
      {
        q: "Why are some artists missing?",
        a: "Gig data depends on Ticketmaster's coverage, which is strongest in the US, UK, Australia, and Europe. Smaller or international artists may not have listings even if they're touring.",
      },
    ],
  },
  {
    section: "Library",
    items: [
      {
        q: "What is Library?",
        a: "Library is a recommendations feed for podcasts, audiobooks, and books — matched to the artists and labels in your collection. It's for the listening and reading that sits alongside record collecting.",
      },
      {
        q: "Where do the recommendations come from?",
        a: "rekōdo curates Library content editorially, matched to artists and labels represented in the rekōdo user base. Your personal stack (saved, in progress, done) is stored privately.",
      },
    ],
  },
  {
    section: "Selects",
    items: [
      {
        q: "What are Selects?",
        a: "Selects are long-form editorial spotlights on artists and labels — written by rekōdo, updated periodically. They're designed for the serious collector: landmark releases, pressing intelligence, collector's notes, and context you won't find on a streaming platform.",
      },
      {
        q: "How often are Selects updated?",
        a: "New Selects are added regularly. Artist and label spotlights are published on a rolling basis — check back each month.",
      },
    ],
  },
  {
    section: "Archetypes",
    items: [
      {
        q: "What is an Archetype?",
        a: "Your Archetype is rekōdo's read on what kind of collector you are, derived from the actual shape of your collection — its genres, decades, labels, rarity distribution, and how you use the app. It's not a quiz; it's calculated from data.",
      },
      {
        q: "Can my Archetype change?",
        a: "Yes. As your collection grows and your taste evolves, your Archetype is recalculated. It reflects your collection as it currently stands, not a fixed label you were assigned at signup.",
      },
    ],
  },
  {
    section: "Lists & Profile",
    items: [
      {
        q: "What is my public profile?",
        a: "Your public profile (rekōdo.co/@username) shows your lists and any records you've marked open to offers. Everything else — your collection, Insights, play history — remains private.",
      },
      {
        q: "What is the wantlist?",
        a: "Your wantlist syncs from Discogs and shows records you're looking for. Records added via Dig also appear here. The wantlist is private.",
      },
      {
        q: "How do I create a list?",
        a: "From your profile, use the New List button. Give it a name, add records from your collection or search Discogs, and choose whether to keep it private or make it public.",
      },
    ],
  },
  {
    section: "Support & Pricing",
    items: [
      {
        q: "Is rekōdo free?",
        a: "Core rekōdo — collection sync, Insights, Dig, Gigs, Library, Deep Dive — is free. Supporting rekōdo via a monthly subscription unlocks the Supporter badge and helps keep the project alive and ad-free.",
      },
      {
        q: "What is the difference between a Supporter and a donor?",
        a: "A Supporter subscribes monthly and receives the golden ō badge on their profile. A donor makes a one-off contribution. Both are appreciated — the badge is the Supporter's alone.",
      },
      {
        q: "What does the golden ō badge do?",
        a: "It shows on your public profile as a visible marker that you support independent software. It doesn't unlock paywalled features — rekōdo doesn't believe in locking core functionality behind a subscription.",
      },
      {
        q: "How do I cancel my subscription?",
        a: "You can cancel at any time through Stripe's customer portal. Your Supporter status remains active until the end of the billing period. To cancel, contact us via the Contact tab and we'll send you the portal link.",
      },
    ],
  },
];

function FaqTab() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px 80px" }}>
      <p style={{
        fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em",
        textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 48px",
      }}>
        FAQs
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
        {FAQ_SECTIONS.map(({ section, items }) => (
          <div key={section}>
            <p style={{
              fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em",
              textTransform: "uppercase", color: ORANGE,
              margin: "0 0 16px",
            }}>
              {section}
            </p>
            <div style={{ borderTop: "1px solid #e0e0da" }}>
              {items.map(({ q, a }) => {
                const key = `${section}::${q}`;
                const isOpen = openKey === key;
                return (
                  <div key={q} style={{ borderBottom: "1px solid #e0e0da" }}>
                    <button
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      style={{
                        width: "100%", background: "none", border: "none",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "16px 0", cursor: "pointer", gap: "16px", textAlign: "left",
                      }}
                    >
                      <span style={{
                        fontFamily: SERIF,
                        fontSize: "clamp(15px, 1.8vw, 17px)",
                        color: INK, fontWeight: 400, lineHeight: 1.3,
                      }}>
                        {q}
                      </span>
                      <span style={{
                        fontFamily: MONO, fontSize: "14px", color: ORANGE,
                        flexShrink: 0, lineHeight: 1,
                        transform: isOpen ? "rotate(45deg)" : "none",
                        transition: "transform 0.15s",
                        display: "inline-block",
                      }}>
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <p style={{
                        fontFamily: MONO,
                        fontSize: "clamp(12px, 1.4vw, 13px)",
                        color: "#505050", lineHeight: 1.75,
                        margin: "0 0 18px", paddingRight: "32px",
                      }}>
                        {a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ─── Contact tab ──────────────────────────────────────────────────────────────

const SUBJECTS = [
  "Something's broken",
  "Feature request",
  "Pressing Intelligence gap",
  "Supporter or billing",
  "Partnership enquiry",
  "Something else",
];

const labelSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em",
  textTransform: "uppercase", color: ORANGE, display: "block", marginBottom: "6px",
};

const inputSt: React.CSSProperties = {
  fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.03em",
  width: "100%", boxSizing: "border-box",
  background: "#FDF6F0", border: "1px solid #e0e0da", borderRadius: 0,
  padding: "10px 12px", outline: "none", color: INK,
};

function ContactTab() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status,  setStatus]  = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setName(""); setEmail(""); setSubject(""); setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px 80px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{
        fontFamily: "var(--font-editorial)", fontSize: "clamp(28px, 4vw, 42px)",
        fontWeight: 400, color: INK, margin: "0 0 48px", lineHeight: 1.1,
      }}>
        Get in touch.
      </h1>

      <form onSubmit={handleSubmit} noValidate>
        {/* Name + Email — two-col on desktop */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "24px",
          marginBottom: "24px",
        }}>
          <div>
            <label htmlFor="contact-name" style={labelSt}>Name</label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputSt}
              onFocus={e => { e.currentTarget.style.borderColor = INK; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "#e0e0da"; }}
            />
          </div>
          <div>
            <label htmlFor="contact-email" style={labelSt}>Email</label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputSt}
              onFocus={e => { e.currentTarget.style.borderColor = INK; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "#e0e0da"; }}
            />
          </div>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: "24px" }}>
          <label htmlFor="contact-subject" style={labelSt}>Subject</label>
          <div style={{ position: "relative" }}>
            <select
              id="contact-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
              style={{
                ...inputSt,
                appearance: "none",
                WebkitAppearance: "none",
                paddingRight: "36px",
                cursor: "pointer",
                color: subject ? INK : "#aaaaaa",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = INK; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "#e0e0da"; }}
            >
              <option value="" disabled hidden>Select a subject</option>
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span style={{
              position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none", fontFamily: MONO, fontSize: "10px", color: "#888",
            }}>↓</span>
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: "32px" }}>
          <label htmlFor="contact-message" style={labelSt}>Message</label>
          <textarea
            id="contact-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            rows={6}
            style={{ ...inputSt, resize: "vertical", lineHeight: 1.6 }}
            onFocus={e => { e.currentTarget.style.borderColor = INK; }}
            onBlur={e  => { e.currentTarget.style.borderColor = "#e0e0da"; }}
          />
        </div>

        {/* Status messages */}
        {status === "success" && (
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: "#0a0a0a", marginBottom: "20px" }}>
            Message sent. We'll be in touch.
          </p>
        )}
        {status === "error" && (
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: "#cc3300", marginBottom: "20px" }}>
            Something went wrong. Email us directly at{" "}
            <a href="mailto:hello@rekodo.co" style={{ color: "#cc3300" }}>hello@rekodo.co</a>
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === "sending" || status === "success"}
          style={{
            fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: status === "success" ? "#888" : INK,
            color: "#FDF6F0",
            border: "none", borderRadius: 0,
            padding: "12px 28px",
            cursor: status === "sending" || status === "success" ? "default" : "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => {
            if (status !== "sending" && status !== "success")
              (e.currentTarget as HTMLButtonElement).style.background = ORANGE;
          }}
          onMouseLeave={e => {
            if (status !== "sending" && status !== "success")
              (e.currentTarget as HTMLButtonElement).style.background = INK;
          }}
        >
          {status === "sending" ? "Sending…" : status === "success" ? "Sent" : "Send message"}
        </button>
      </form>
      </div>
    </main>
  );
}
