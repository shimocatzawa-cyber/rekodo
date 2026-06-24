import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How rekōdo handles your information.",
};

const SERIF   = "var(--font-shippori), Georgia, serif";
const MONO    = "var(--font-dm-mono), 'Courier New', monospace";
const ORANGE  = "#CC5500";
const INK     = "#0a0a0a";
const RULE    = "#e0e0da";
const BG_SOFT = "#FDF6F0";

const TOC: Array<{ id: string; num: string; label: string }> = [
  { id: "s1",  num: "01", label: "Who we are" },
  { id: "s2",  num: "02", label: "What we collect" },
  { id: "s3",  num: "03", label: "How we use it" },
  { id: "s4",  num: "04", label: "Who we share with" },
  { id: "s5",  num: "05", label: "Your Discogs data" },
  { id: "s6",  num: "06", label: "Data security" },
  { id: "s7",  num: "07", label: "Retention & deletion" },
  { id: "s8",  num: "08", label: "Your rights" },
  { id: "s9",  num: "09", label: "Cookies" },
  { id: "s10", num: "10", label: "Children's privacy" },
  { id: "s11", num: "11", label: "Changes to this policy" },
  { id: "s12", num: "12", label: "Contact us" },
];

function Wordmark() {
  return (
    <span style={{ fontFamily: SERIF }}>
      rek<span style={{ color: ORANGE }}>ō</span>do
    </span>
  );
}

function Section({
  id, num, title, children,
}: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: "52px", scrollMarginTop: "96px" }}>
      <h2 style={{ display: "flex", alignItems: "baseline", gap: "14px", margin: "0 0 18px" }}>
        <span style={{ fontFamily: MONO, fontSize: "13px", letterSpacing: "0.04em", color: ORANGE, fontWeight: 600 }}>
          {num}
        </span>
        <span style={{ fontFamily: SERIF, fontSize: "1.4rem", fontWeight: 600, color: INK, lineHeight: 1.3 }}>
          {title}
        </span>
      </h2>
      <div style={{ fontFamily: SERIF, fontSize: "0.95rem", lineHeight: 1.8, color: "#333333" }}>
        {children}
      </div>
    </section>
  );
}

const listStyle: React.CSSProperties = { margin: "0 0 16px", paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "8px" };
const pStyle: React.CSSProperties = { margin: "0 0 16px" };
const linkStyle: React.CSSProperties = { color: ORANGE, textDecoration: "underline" };
const subheadStyle: React.CSSProperties = { fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#777777", margin: "0 0 12px" };

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "0 0 20px", border: `1px solid ${RULE}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: "0.78rem" }}>
        <thead>
          <tr style={{ background: BG_SOFT }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left", padding: "10px 14px",
                  letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.65rem",
                  color: "#777777", borderBottom: `1px solid ${RULE}`, fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: i === 0 ? "none" : `1px solid ${RULE}` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 14px", color: "#333333", lineHeight: 1.6, verticalAlign: "top" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: INK }}>
      {/* Sticky header */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10, background: "#ffffff",
          borderBottom: `1px solid ${RULE}`, padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link href="/" aria-label="rekōdo home" style={{ fontSize: "20px", fontWeight: 700, textDecoration: "none" }}>
          <Wordmark />
        </Link>
        <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", color: "#888888" }}>
          Privacy Policy / rekodo.co
        </span>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 0" }}>
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 18px" }}>
          rekōdo / プライバシーポリシー
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, lineHeight: 1.15, margin: "0 0 18px", maxWidth: 760 }}>
          How rekōdo handles your information.
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: "1.05rem", lineHeight: 1.7, color: "#444444", maxWidth: 640, margin: "0 0 18px" }}>
          This policy explains what we collect when you connect your Discogs collection, what we send to AI models to generate your taste profile, and how to access, correct, or delete your data.
        </p>
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: "#999999", margin: "0 0 48px" }}>
          Last updated — 24 June 2026
        </p>
      </div>

      {/* Two-column body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 96px", display: "flex", gap: "64px" }}>
        {/* TOC — desktop only */}
        <nav className="hidden lg:block" style={{ width: 220, flexShrink: 0, position: "sticky", top: 96, alignSelf: "flex-start" }}>
          <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#999999", margin: "0 0 14px" }}>
            Contents
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "9px" }}>
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} style={{ fontFamily: MONO, fontSize: "12px", color: "#555555", textDecoration: "none", display: "flex", gap: "9px" }}>
                  <span style={{ color: ORANGE, flexShrink: 0 }}>{t.num}</span>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, maxWidth: 680 }}>

          <Section id="s1" num="01" title="Who we are">
            <p style={pStyle}>
              rekōdo is operated by <strong>Jason Patrick Gould, trading as Rekodo Music</strong> (ABN 22 405 469 880) (&ldquo;rekōdo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), based in New South Wales, Australia. This policy explains how we collect, use, store, and disclose personal information when you use rekōdo at rekodo.co (the &ldquo;Service&rdquo;).
            </p>
            <p style={pStyle}>
              We handle personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
            </p>
            <p style={pStyle}>
              Contact for privacy matters: <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a>
            </p>
          </Section>

          <Section id="s2" num="02" title="What we collect">
            <p style={subheadStyle}>Information you provide directly</p>
            <ul style={listStyle}>
              <li>Account details: email address, display name, password (hashed — never stored in plain text)</li>
              <li>Profile information you choose to add: bio, city-level location, profile photo, star sign</li>
              <li>Content you create: Lists, Feeling tags, Memory field entries, Essential toggles, written notes on records</li>
            </ul>

            <p style={subheadStyle}>Information from connected services</p>
            <p style={pStyle}>When you connect third-party accounts, we receive:</p>
            <DataTable
              headers={["Service", "What we receive", "Why"]}
              rows={[
                ["Discogs", "Your collection (artist, title, label, year, pressing/format data, condition notes, marketplace value where available), wantlist", "Core collection sync — this is the product"],
                ["Spotify", "Playback/profile data needed to create playlists on your behalf; OAuth token", "Playlist Generator feature"],
                ["Stripe", "Subscription/payment status (we never receive or store your full card number)", "Billing for Supporter subscriptions"],
              ]}
            />
            <p style={pStyle}>
              We store Discogs collection data in our own database upon import. This means your collection data remains available to you even if Discogs access is later interrupted — see §5.
            </p>

            <p style={subheadStyle}>Information collected automatically</p>
            <ul style={listStyle}>
              <li>Usage data: pages viewed, features used, session duration</li>
              <li>Device/browser information, IP address (security and fraud prevention)</li>
              <li>Cookies — see §9</li>
            </ul>
          </Section>

          <Section id="s3" num="03" title="How we use your information">
            <p style={pStyle}>We use your information to:</p>
            <ul style={listStyle}>
              <li>Provide the Service: sync and display your collection, generate Lists, power Dig recommendations</li>
              <li>Generate AI-powered features: Jungian Archetypes, Taste Profiles, Cross-Signal Insights, Deep Dive artist content</li>
              <li>Process payments for Supporter subscriptions</li>
              <li>Send transactional emails (account, billing, waitlist updates) and, where you&rsquo;ve opted in, marketing emails</li>
              <li>Maintain and improve the Service, including security and fraud prevention</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p style={pStyle}>
              <strong>On AI-generated content:</strong> Archetypes, Taste Profiles, Spectrum Dimensions, and Cross-Signal Insights are generated using AI models (Claude, by Anthropic) based on your collection metadata (artist, title, genre, year) and Feeling tags you&rsquo;ve applied. Taste Profile generation also uses your self-reported star sign, if provided, to flavour recommendations. We do not send your name, email, username, account ID, or written Memory field notes to Claude for any of these features. These outputs are interpretive and for entertainment/informational purposes. They are not professional psychological assessment, financial advice, or a guarantee of market value. See the Terms of Service for further disclaimers.
            </p>
          </Section>

          <Section id="s4" num="04" title="Who we share information with">
            <p style={pStyle}>We disclose personal information to the following categories of third parties, only as needed to provide the Service:</p>
            <DataTable
              headers={["Recipient", "Purpose", "Location"]}
              rows={[
                ["Anthropic (Claude API)", "Processing collection data to generate Archetypes, Taste Profiles, Deep Dive content", "United States"],
                ["Supabase", "Database hosting and storage", "Sydney (ap-southeast-2)"],
                ["Vercel", "Application hosting", "Global CDN, primarily US"],
                ["Discogs", "Reading your collection via your authorised OAuth connection", "United States"],
                ["Spotify", "Creating playlists via your authorised OAuth connection", "United States"],
                ["Stripe", "Payment processing", "United States / global"],
                ["Resend", "Transactional email delivery", "United States"],
                ["Loops", "Marketing email automation (only if opted in)", "United States"],
              ]}
            />
            <p style={pStyle}>We do not sell your personal information. We do not share your collection data with advertisers.</p>
            <p style={pStyle}>
              <strong>Cross-border disclosure:</strong> Some recipients above store or process data outside Australia, primarily the United States. Where required under APP 8, we take reasonable steps to ensure overseas recipients handle your information consistently with the APPs, including relying on these providers&rsquo; own data protection commitments and standard contractual terms.
            </p>
          </Section>

          <Section id="s5" num="05" title="Your Discogs data, specifically">
            <p style={pStyle}>
              rekōdo connects to Discogs via OAuth, with your authorisation, to read your collection. Under Discogs&rsquo; API terms, we may cache your collection data only for as long as necessary to provide our service to you. By connecting your Discogs account, you consent to rekōdo storing a copy of your collection data in our database for the ongoing purpose of providing the Service — including displaying your collection, generating Lists, Archetypes, and recommendations, and allowing the Service to continue functioning even if your Discogs connection is later interrupted.
            </p>
            <p style={pStyle}>If you disconnect your Discogs account or delete your rekōdo account, see §7.</p>
          </Section>

          <Section id="s6" num="06" title="Data security">
            <p style={pStyle}>
              We take reasonable technical and organisational measures to protect your information, including encryption in transit, access controls on our database, and hashed password storage. No system is completely secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section id="s7" num="07" title="Data retention and deletion">
            <ul style={listStyle}>
              <li>We retain your account and collection data for as long as your account is active.</li>
              <li>You can delete individual records, Lists, or other content at any time within the Service.</li>
              <li>
                You can request full account deletion by contacting <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a>. On deletion, we will:
                <ul style={{ ...listStyle, margin: "8px 0 0", paddingLeft: "20px" }}>
                  <li>Delete your stored collection data, Lists, profile, and AI-generated content from our active database within 30 days</li>
                  <li>Revoke stored OAuth tokens for Discogs and Spotify</li>
                  <li>Retain minimal billing records as required by Australian tax law (generally 5 years), where you held a paid subscription</li>
                </ul>
              </li>
              <li>Backups may persist for a limited period after deletion before being purged in the normal backup rotation cycle.</li>
            </ul>
          </Section>

          <Section id="s8" num="08" title="Your rights">
            <p style={pStyle}>Under the Privacy Act 1988 and the APPs, you have the right to:</p>
            <ul style={listStyle}>
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Make a complaint about how we&rsquo;ve handled your information</li>
            </ul>
            <p style={pStyle}>
              To exercise these rights, contact us at <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a>. We will respond within a reasonable period, generally 30 days.
            </p>
            <p style={pStyle}>
              If you&rsquo;re not satisfied with our response, you can lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at{" "}
              <a href="https://www.oaic.gov.au" target="_blank" rel="noopener" style={linkStyle}>oaic.gov.au</a>.
            </p>
          </Section>

          <Section id="s9" num="09" title="Cookies">
            <p style={pStyle}>We use cookies and similar technologies for:</p>
            <ul style={listStyle}>
              <li>Authentication (keeping you logged in)</li>
              <li>Essential site functionality</li>
              <li>Analytics — [Analytics tool to be confirmed]</li>
            </ul>
            <p style={pStyle}>
              You can control cookies through your browser settings, though disabling essential cookies may affect Service functionality.
            </p>
          </Section>

          <Section id="s10" num="10" title="Children's privacy">
            <p style={pStyle}>
              rekōdo is not directed at, and we do not knowingly collect personal information from, anyone under 16. If you believe a child has provided us with personal information, contact us at <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a> and we will delete it.
            </p>
          </Section>

          <Section id="s11" num="11" title="Changes to this policy">
            <p style={pStyle}>
              We may update this policy from time to time. We&rsquo;ll notify you of material changes via email or an in-Service notice. Continued use of rekōdo after changes take effect constitutes acceptance.
            </p>
          </Section>

          <Section id="s12" num="12" title="Contact us">
            <p style={{ ...pStyle, fontFamily: MONO, fontSize: "0.85rem", letterSpacing: "0.02em", lineHeight: 1.9 }}>
              <strong style={{ fontFamily: SERIF }}>Jason Patrick Gould, trading as Rekodo Music</strong><br />
              ABN 22 405 469 880<br />
              <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a><br />
              New South Wales, Australia
            </p>
          </Section>

        </main>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${RULE}`, padding: "40px 24px", textAlign: "center", background: BG_SOFT }}>
        <p style={{ fontSize: "20px", margin: "0 0 10px" }}><Wordmark /></p>
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: "#999999", margin: 0 }}>
          rekōdo — Privacy Policy · v1.0 · June 2026
        </p>
      </footer>
    </div>
  );
}
