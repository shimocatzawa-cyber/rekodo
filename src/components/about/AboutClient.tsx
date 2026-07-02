"use client";

import { useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { useUrlTab } from "@/lib/useUrlTab";
import SupporterContent from "@/components/profile/SupporterContent";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";

const BODY_PARAGRAPHS = [
  "The idea for rekōdo started after twenty-odd years of collecting and many trips to Tokyo digging in crates at Disk Unions. I wanted to create something that gives your collection the love it deserves and celebrates the passion of collecting records (rekōdo life).",
  "rekōdo reads your collection the way a friend who's been digging for decades would: not as a spreadsheet, but as a set of decisions you've made over years. It finds the records you should own but don't. It tells you your collector archetype. It builds out artist deep dives so a name in your collection becomes a rabbit hole.",
  "rekōdo is for people who want to know more about the records they already love.",
  "If rekōdo has given you something, a recommendation that changed your week, a list that made you think, a Dig that found the record you didn't know you needed, consider supporting us or buying us one back.",
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
  const [activeTab, setActiveTab] = useUrlTab<SupportTab>("tab", TABS.map(t => t.key), "support");

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/support-dig-deeper.jpg"
              alt="Dig deeper — crates of records"
              style={{ width: "100%", height: "auto", display: "block", marginBottom: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "56px" }}>
              <div>
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
                  margin: 0,
                  fontStyle: "italic",
                }}>
                  Your records say everything about you.
                </p>
              </div>
              <a
                href="https://www.instagram.com/rekodomusic/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 24,
                  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase",
                  color: INK, textDecoration: "none", borderBottom: `1px solid ${INK}`, paddingBottom: 2,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Follow rekōdo on Instagram
              </a>
            </div>

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

const FAQ_SECTIONS: { section: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    section: "Getting Started",
    items: [
      {
        q: "Do I need a Discogs account?",
        a: "Yes. rekōdo connects to your Discogs collection to import your records. If you don't have one, you can create a free account at discogs.com before connecting.",
      },
      {
        q: "How do I connect my Discogs collection?",
        a: "The standard method is OAuth — during onboarding you'll be prompted to authorise rekōdo via Discogs. This grants read-only access to your collection and rekōdo never writes to or modifies your Discogs data.\n\nIf the Discogs API is temporarily unavailable, or you'd prefer not to connect via OAuth, you can import using a CSV export instead. To get your CSV: log in to Discogs → go to your Collection → click the gear icon (top right) → Export → Collection CSV. Once downloaded, go to your rekōdo profile page and use the Backup / Bulk Import section to upload the file. rekōdo will add any records missing from your collection and fill in blank condition grades — it never overwrites data you already have.\n\nNote: CSV files from Discogs contain basic fields only. Richer data — country of pressing, producers, vinyl colour, edition size, community stats, and more — is fetched automatically in the background during your next sync and fills in over time. You don't need to do anything.",
      },
      {
        q: "How long does the first sync take?",
        a: "It depends on collection size. A few hundred records takes under 5 minutes. Collections of 1,000+ records can take considerably longer — expect 15+ minutes as rekōdo fetches metadata, market prices, and community data for each release. Discogs API is notoriously slow and this is where the hold up will be. You can navigate off and explore other areas of rekōdo in a new tab whilst you wait.",
      },
      {
        q: "My collection total looks lower than Discogs — why?",
        a: "If you own multiple copies of the same pressing (same Discogs release ID), rekōdo deduplicates them to a single entry in your collection — but keeps an accurate copy count. Your total now reflects every copy you own. In your collection you'll see ×N next to any record you have more than one copy of, and the copy count appears under the Cat # in the detail panel.",
      },
      {
        q: "Can I still use rekōdo without connecting my Discogs account?",
        a: "Yes but you'll lose a lot of great functionality. You can complete our taste questionnaire where you'll be asked to pick a handful of records you love. rekōdo uses those picks to seed your first Dig recommendations until your real collection is synced.",
      },
      {
        q: "What can I set up in onboarding?",
        a: "Username, display name, city and country (used for currency conversion and live concert information), star sign, and optionally your Bandcamp username and a short taste essay. Everything except username can be changed later from your profile.",
      },
    ],
  },
  {
    section: "Mobile",
    items: [
      {
        q: "Is there a rekōdo mobile app?",
        a: "Not yet — but the website is fully optimised for use on iOS. To get an app-like experience, open rekōdo in Safari on your iPhone, tap the Share icon, then 'Add to Home Screen'. This adds a rekōdo icon to your home screen that launches full-screen, just like a native app.",
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
        a: "Desirability is calculated from Discogs community data — how many people have it vs. want it, current for-sale listings, and median sale price. Tiers run from Rare (extremely sought, low supply) through Cult Pressing, In Demand, and Widely Loved.",
      },
      {
        q: "What does 'Played Today' do?",
        a: "Whenever you play a record from your collection, tap the 'Played Today' button to log the play. It updates with a last played date and feeds your Most Played stats and Taste Profile, showing which parts of your collection you actually reach for and which parts you don't.",
      },
      {
        q: "What does the randomiser button do?",
        a: "It randomly selects an item from your collection that you might want to play. Takes the thinking out of selecting what to listen to!",
      },
      {
        q: "What does the Essential tag do?",
        a: "Mark a record Essential from its detail view to add it to your Essentials Wall — a thumbnail wall of the records that matter most to you, shown at the top of Insights with a shareable card.",
      },
      {
        q: "What is the Feeling tag?",
        a: "Tag any record with how it makes you feel — Upbeat, Calm, Nostalgic, Dreamy, Defiant, and more — from its detail view. Feelings show up in your Insights Feeling breakdown and power the mood selector when generating a Spotify playlist.",
      },
      {
        q: "What filters can I use in my collection list?",
        a: "Filter by Genre, Decade, Format, Desirability, or Feeling, search by artist, album, or label, and sort by name, value, or year.",
      },
      {
        q: "Can other people see my collection?",
        a: "Your collection is private by default. Your public profile (at rekōdo.co/@username) shows only what you choose to make visible — lists you've created and any records you've marked open to offers.",
      },
      {
        q: "What does 'open to offers' mean?",
        a: "Marking a record as open to offers flags it on your public profile — and in your Sell List — so other collectors can contact you about it. rekōdo doesn't facilitate the transaction — it's just a signal.",
      },
      {
        q: "What is the Memory section on a record?",
        a: "Memory is a free-form personal note attached to any record in your collection. Open a record's detail panel and tap + Memory to write how you came across it — where you found it, who gave it to you, the moment it became yours. It's private to you by default and saved automatically.",
      },

    ],
  },
  {
    section: "Insights",
    items: [
      {
        q: "How is my collection value calculated?",
        a: "rekōdo uses the market value field to determine your collection value. This is updated every time you Sync.",
      },
      {
        q: "What is the Essentials Wall?",
        a: "A thumbnail wall of every record you've tagged Essential, with a shareable card showing your record count, primary genre, and your @username. Tag records as Essential from the Collection view to build it.",
      },
      {
        q: "What are the share cards?",
        a: "From the Taste Profile tab, the 'Share your collection on socials' bar gives you eight shareable cards: Record Shelf (your format breakdown, top genres, and shelf photo), Essentials Wall, Collector DNA (your primary genre, style obsession, top decade, rarity, and archetype), Collection Story (your collection growth over time), Genre Map, Style Map, Spectrum Dimensions, and Collector Archetype. Each exports as a PNG you can download or copy to clipboard.",
      },
      {
        q: "What is the Feeling breakdown?",
        a: "It shows the percentage split of every Feeling you've tagged across your collection — a quick read on the emotional shape of what you actually own.",
      },
      {
        q: "What is the Taste Profile?",
        a: "Taste Profile is the second tab in Insights, free for all rekōdo users. It analyses your collection across seven Spectrum Dimensions — from Ambient vs. Abrasive to Canon vs. Obscure — and plots where you sit on each axis based on actual data from your records.",
      },
      {
        q: "What do the Spectrum Dimensions mean?",
        a: "Each axis measures a real quality of your collection. Canon ↔ Obscure uses Discogs have/want ratios. Nostalgic ↔ Contemporary uses pressing years. Completist measures how many artists you own 3+ records by. Vinyl pure ↔ Format agnostic compares vinyl to any digital imports — including Bandcamp purchases — you've added.",
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
        a: "Dig analyses your collection — genres, styles, labels, and lists you've built — and uses that as a prompt to generate personalised record recommendations. Each session produces a fresh set. Picks are AI-generated where possible, and drawn from rekōdo's catalogue of over 369,000 records as a fallback so you always get a full set of suggestions.",
      },
      {
        q: "Is there a limit on how many times I can Dig?",
        a: "Free accounts get 3 Dig sessions a day. rekōdo supporters get unlimited regeneration.",
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
        a: "Deep Dive is available to rekōdo supporters. It takes a single artist from your collection and surfaces everything rekōdo knows about them — every record you own, pressing details, market values, and how they connect to the rest of your collection.",
      },
      {
        q: "What else does Deep Dive surface?",
        a: "Beyond your own records, Deep Dive can suggest essential albums you're missing, books and interviews about the artist, and Spotify playback where a match is available.",
      },
      {
        q: "How do I choose an artist?",
        a: "Use the artist dropdown at the top of the page. It lists every artist in your collection. On desktop, section tabs let you jump between records, pressing details, and related context.",
      },
    ],
  },
  {
    section: "Live",
    items: [
      {
        q: "How does rekōdo find gigs?",
        a: "rekōdo cross-references the artists in your collection against live event data from Ticketmaster and looks for shows in the next 9 months. Only artists you actually own records by will appear.",
      },
      {
        q: "What location does it use?",
        a: "rekōdo uses the city and country set in your profile to filter events. If you're not seeing results, check that your city and country are set correctly in your profile settings.",
      },
      {
        q: "Why are some artists missing?",
        a: "Gig data depends on Ticketmaster's coverage, which is strongest in the US, UK, Australia, and Europe. Smaller or international artists may not have listings even if they're touring.",
      },
    ],
  },
  {
    section: "Rekōdo Selects",
    items: [
      {
        q: "What is Rekōdo Selects?",
        a: "Selects has four tabs. New Releases tracks new releases, represses, and preorders matched to artists and labels in your collection. Artist Spotlight and Label Spotlight are rotating editorial deep dives — landmark releases, pressing notes, and context you won't find on a streaming platform.",
      },
      {
        q: "How often is Selects updated?",
        a: "New Releases refreshes regularly as labels announce new stock. Artist and Label Spotlights are published on a rolling basis — check back each month.",
      },
    ],
  },
  {
    section: "Archetypes",
    items: [
      {
        q: "What is an Archetype?",
        a: "Your Archetype is rekōdo's read on what kind of collector you are, derived from the actual shape of your collection — its genres, decades, labels, rarity distribution, and how you use the app. It's not a quiz; it's calculated from data. Archetypes is available to rekōdo supporters.",
      },
      {
        q: "Can my Archetype change?",
        a: "Yes. As your collection grows and your taste evolves, your Archetype is recalculated. It reflects your collection as it currently stands, not a fixed label you were assigned at signup.",
      },
    ],
  },
  {
    section: "Lists, Wantlist & Playlists",
    items: [
      {
        q: "What is a Want List?",
        a: "Your wantlist generates from Discogs (supporter feature) and directly from rekōdo's Dig and List sections. It shows records you're looking for. rekōdo supporters can also bulk-import a wantlist from a CSV exported from Discogs. The wantlist is private.",
      },
      {
        q: "What is the Sell List?",
        a: "Any record you've marked Open to Offers automatically appears in your Sell List, visible on your public profile so other collectors can reach out.",
      },
      {
        q: "How do I create a list?",
        a: "From the Lists hub, use the New List button. Give it a name, add records from your collection or search Discogs, and choose whether to keep it private or make it public.",
      },
      {
        q: "Can rekōdo build me a Spotify playlist?",
        a: "Yes, from the Playlist tab. Pick a mood from your Feeling tags, how many tracks you want, and whether to include your wantlist — rekōdo builds a Spotify playlist from your collection with a short rationale for each pick. Requires a connected Spotify account.",
      },
      {
        q: "Can I export a generated playlist to Apple Music or another service?",
        a: "Yes — once a playlist is generated, use the Export Playlist button to download a .txt track list. You can then import it into Apple Music, Spotify, or any other service using a free tool like Soundiiz (soundiiz.com) or TuneMyMusic (tunemymusic.com).",
      },
    ],
  },
  {
    section: "Community",
    items: [
      {
        q: "What is Community?",
        a: "Community is where you find other collectors on rekōdo. Top Matches surfaces collectors with the closest taste based on shared artists, genre, and decade; Popular shows albums appearing across the most collections right now; Collectors I Follow tracks activity from people you follow; Open to Offers lists records other collectors are willing to sell; and All Collectors lets you browse everyone on the platform.",
      },
      {
        q: "Can I follow other collectors?",
        a: "Yes. Follow a collector from their profile or from the Community tab to keep track of who's building what.",
      },
    ],
  },
  {
    section: "Connections & Settings",
    items: [
      {
        q: "What can I configure on my profile?",
        a: "Username, display name, city, country, bio, star sign, your Bandcamp username, and your avatar. City and country also drive live concert location and currency conversion.",
      },
      {
        q: "What does adding my Bandcamp username do?",
        a: "rekōdo imports your Bandcamp purchases as digital additions to your Deep Dive artist list. They count toward the Vinyl pure ↔ Format agnostic dimension in your Taste Profile as well. The collection tab will only show physical items you own.",
      },
      {
        q: "How do I connect Spotify?",
        a: "Go to your profile page (tap your avatar or username) and scroll to the Connections section. Click Connect Spotify → — you'll be taken to Spotify to authorise rekōdo, then redirected back automatically. You can disconnect at any time from the same section.",
      },
      {
        q: "Where does the Spotify player appear?",
        a: "The player is embedded across four areas: your Collection (open any record's detail panel to play the matching album), Dig (play a recommendation before you decide to buy), Deep Dive (listen to podcast episodes about an artist), and the Playlist generator (play your generated mood playlist track by track). A Spotify Premium account is required for full-track playback; free accounts can preview short clips only.",
      },
    ],
  },
  {
    section: "Privacy & Data",
    items: [
      {
        q: "What data does rekōdo store about me?",
        a: <>We store your Discogs collection data (artist, title, label, year, format, condition grades, and market values), your profile information, any Lists or Wantlist entries you create, and AI-generated content like your Taste Profile and Archetypes. Full details of every data category and why we hold it are in our{" "}<Link href="/privacy" style={{ color: ORANGE }}>Privacy Policy</Link>.</>,
      },
      {
        q: "Does rekōdo send my data to AI models?",
        a: <>Yes — features like Archetypes, Taste Profile, Deep Dive, Dig recommendations, and Playlist generation send a summary of your collection to Claude (Anthropic) to generate results. We send only what's needed for each feature and never sell your data to third parties. See{" "}<Link href="/privacy" style={{ color: ORANGE }}>our Privacy Policy</Link>{" "}for a full breakdown of what each feature sends.</>,
      },
      {
        q: "How do I delete my account or request my data?",
        a: <>You can delete your account directly from your profile settings — this removes your collection, Lists, Wantlist, Taste Profile, and all personal data from our systems and revokes your Discogs and Spotify connections. If you'd like a copy of your data or have a specific request, use the Contact tab and select "Account or data request". Full details are in{" "}<Link href="/privacy" style={{ color: ORANGE }}>our Privacy Policy</Link>{" "}(§7).</>,
      },
    ],
  },
  {
    section: "Support & Pricing",
    items: [
      {
        q: "Is rekōdo free?",
        a: "Most of rekōdo is free: collection sync, Insights (including Taste Profile, Essentials Wall, and Feeling breakdown), Dig (3 sessions a day), Lists, and Selects. A rekōdo supporter subscription unlocks Deep Dive, Archetypes, unlimited Dig, and Want List CSV upload — plus the golden ō badge.",
      },
      {
        q: "What is the difference between a Supporter and a donor?",
        a: "A Supporter subscribes monthly and unlocks every feature listed above. A donor makes a one-off contribution (from $1, with $5/$10/$20 presets) and gets the golden ō badge too, but not the gated features — those are tied to an active subscription.",
      },
      {
        q: "What does the golden ō badge do?",
        a: "It shows on your public profile as a visible marker that you've supported independent software, whether through a subscription or a one-off donation.",
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
                        whiteSpace: "pre-line",
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
  "Discogs sync issue",
  "Feature request",
  "Supporter or billing",
  "Account or data request",
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
            Message sent. We&apos;ll be in touch.
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
