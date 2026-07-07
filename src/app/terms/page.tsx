import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and rekōdo.",
};

const SERIF   = "var(--font-shippori), Georgia, serif";
const MONO    = "var(--font-dm-mono), 'Courier New', monospace";
const ORANGE  = "#CC5500";
const INK     = "#0a0a0a";
const RULE    = "#e0e0da";
const BG_SOFT = "#FDF6F0";

const TOC: Array<{ id: string; num: string; label: string }> = [
  { id: "s1",  num: "01", label: "Acceptance of terms" },
  { id: "s2",  num: "02", label: "The Service" },
  { id: "s3",  num: "03", label: "Your account" },
  { id: "s4",  num: "04", label: "Connecting third-party accounts" },
  { id: "s5",  num: "05", label: "Your content" },
  { id: "s6",  num: "06", label: "Subscriptions & payment" },
  { id: "s7",  num: "07", label: "Generated content" },
  { id: "s8",  num: "08", label: "Disclaimers & liability" },
  { id: "s9",  num: "09", label: "Discogs dependency" },
  { id: "s10", num: "10", label: "Acceptable use" },
  { id: "s11", num: "11", label: "Termination" },
  { id: "s12", num: "12", label: "Changes" },
  { id: "s13", num: "13", label: "Governing law" },
  { id: "s14", num: "14", label: "Contact" },
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

export default function TermsPage() {
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
          Terms of Service / rekodo.co
        </span>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 0" }}>
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 18px" }}>
          rekōdo / 利用規約
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, lineHeight: 1.15, margin: "0 0 18px", maxWidth: 760 }}>
          The agreement between you and rekōdo.
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: "1.05rem", lineHeight: 1.7, color: "#444444", maxWidth: 640, margin: "0 0 18px" }}>
          What you&rsquo;re agreeing to when you create an account, connect Discogs or Spotify, subscribe to Supporter, and use personalised features like Archetypes, Taste Profiles, and Dig recommendations.
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

          <Section id="s1" num="01" title="Acceptance of terms">
            <p style={pStyle}>
              By creating an account or using rekōdo at rekodo.co (the &ldquo;Service&rdquo;), you agree to these Terms of Service (&ldquo;Terms&rdquo;). If you don&rsquo;t agree, don&rsquo;t use the Service. These Terms are a legal agreement between you and{" "}
              <strong>Rekodo Music</strong> (ABN 22 405 469 880) (&ldquo;rekōdo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
            </p>
            <p style={pStyle}>You must be at least 16 years old to use rekōdo.</p>
          </Section>

          <Section id="s2" num="02" title="The Service">
            <p style={pStyle}>
              rekōdo is a vinyl record collection intelligence platform. It syncs with your Discogs collection and provides personalised insights, taste profiling, discovery recommendations, and social/community features on top of it.
            </p>
            <p style={pStyle}>
              rekōdo is not affiliated with, endorsed by, or operated by Discogs, Spotify, or any other connected third-party service. &ldquo;Powered by Discogs API&rdquo; attribution reflects our use of their API under licence, not a partnership unless separately stated.
            </p>
          </Section>

          <Section id="s3" num="03" title="Your account">
            <ul style={listStyle}>
              <li>You must provide accurate information when creating an account.</li>
              <li>You&rsquo;re responsible for keeping your login credentials secure and for all activity under your account.</li>
              <li>You must notify us promptly at <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a> if you suspect unauthorised access to your account.</li>
              <li>We may suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </Section>

          <Section id="s4" num="04" title="Connecting third-party accounts">
            <p style={pStyle}>
              When you connect Discogs, Spotify, or other services, you authorise rekōdo to access and import data from those accounts as described in our Privacy Policy. You&rsquo;re responsible for complying with the terms of those third-party services yourself. rekōdo&rsquo;s access is limited to what you authorise via OAuth, and you can revoke this access at any time through the relevant service&rsquo;s own settings or by disconnecting within rekōdo.
            </p>
          </Section>

          <Section id="s5" num="05" title="Your content">
            <ul style={listStyle}>
              <li>You retain ownership of content you create on rekōdo: Lists, written notes, Memory entries, and similar.</li>
              <li>By posting public content (public Lists, public profile, Selects comments, etc.), you grant rekōdo a licence to display that content within the Service, including on shareable public profile pages.</li>
              <li>You&rsquo;re responsible for content you post. Don&rsquo;t post anything unlawful, infringing, harassing, or that you don&rsquo;t have the right to share.</li>
              <li>We may remove content that violates these Terms.</li>
            </ul>
          </Section>

          <Section id="s6" num="06" title="Subscriptions & payment">
            <ul style={listStyle}>
              <li>rekōdo offers a Supporter subscription tier at the price displayed at checkout, billed via Stripe.</li>
              <li>Prices displayed do not include GST, as rekōdo is not currently registered for GST.</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
              <li>You can cancel anytime through your account settings; cancellation takes effect at the end of the current billing period, and you&rsquo;ll retain access until then.</li>
              <li>We don&rsquo;t offer refunds for unused time on monthly or annual subscriptions, whether you cancel or we suspend your account for breach of these Terms. This applies equally to annual plans — no pro-rata refund is given for the unused portion of the year.</li>
              <li>This doesn&rsquo;t affect any right to a refund you have under the Australian Consumer Law that can&rsquo;t lawfully be excluded — for example, if the Service has a major failure.</li>
              <li>We may change subscription pricing with at least 30 days&rsquo; notice to existing subscribers.</li>
            </ul>
          </Section>

          <Section id="s7" num="07" title="Generated content — what to know">
            <p style={pStyle}>
              rekōdo uses automated systems to generate Archetypes, Taste Profiles, Spectrum Dimensions, Cross-Signal Insights, and Deep Dive artist content based on your collection data.
            </p>
            <p style={pStyle}>You acknowledge and agree that:</p>
            <ul style={listStyle}>
              <li>This content is interpretive and generated for entertainment and informational purposes.</li>
              <li>AI-generated content may be inaccurate, incomplete, or not reflect your actual taste, personality, or the true value or pressing details of any record.</li>
              <li><strong>Any market value, pricing, or valuation shown for a record in your collection is sourced from Discogs marketplace data and is not a professional appraisal.</strong> It should not be relied upon for buying, selling, or insurance decisions — always verify current pricing independently before any transaction.</li>
              <li>Archetype and Taste Profile content is not psychological advice, diagnosis, or assessment, and should not be treated as a factual statement about your personality or mental state.</li>
              <li>rekōdo is not liable for decisions made in reliance on AI-generated content.</li>
            </ul>
          </Section>

          <Section id="s8" num="08" title="Disclaimers and limitation of liability">
            <p style={pStyle}>To the maximum extent permitted by law:</p>
            <ul style={listStyle}>
              <li>The Service is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied.</li>
              <li>We don&rsquo;t warrant that the Service will be uninterrupted, error-free, or that data (including Discogs-sourced data) will always be accurate or current.</li>
              <li>rekōdo is not liable for indirect, incidental, special, or consequential damages arising from your use of the Service.</li>
              <li>Our total liability to you, in aggregate across all claims arising from or relating to the Service, is limited to the amount you personally paid us in the 12 months before the claim arose, or AUD $100, whichever is greater. This cap applies separately to each user — it is not a shared limit across all rekōdo users.</li>
            </ul>
            <p style={pStyle}>
              <strong>Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy you have under the Australian Consumer Law that cannot lawfully be excluded.</strong> Where the ACL implies a guarantee that can&rsquo;t be excluded but liability can be limited, our liability is limited to resupplying the service or paying the cost of resupply, at our option.
            </p>
          </Section>

          <Section id="s9" num="09" title="Discogs dependency — what happens if access changes">
            <p style={pStyle}>
              rekōdo&rsquo;s collection sync relies on the Discogs API, which is subject to Discogs&rsquo; own terms and availability. We architect the Service so that:
            </p>
            <ul style={listStyle}>
              <li>Your collection data, once imported, is stored independently in our own database and remains accessible even if Discogs API access is interrupted.</li>
              <li>If Discogs API access is restricted or unavailable, new imports or syncs may be paused, but your existing data, Lists, and AI-generated content remain unaffected.</li>
            </ul>
            <p style={pStyle}>
              We don&rsquo;t guarantee continued Discogs API availability and aren&rsquo;t liable for service interruptions caused by changes to Discogs&rsquo; API access, terms, or availability.
            </p>
          </Section>

          <Section id="s10" num="10" title="Acceptable use">
            <p style={pStyle}>You agree not to:</p>
            <ul style={listStyle}>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to scrape, reverse-engineer, or access the Service through unauthorised means</li>
              <li>Interfere with the Service&rsquo;s operation or security</li>
              <li>Impersonate another person or misrepresent your collection</li>
              <li>Use automated means to create accounts or inflate engagement metrics (e.g. fake List saves)</li>
            </ul>
          </Section>

          <Section id="s11" num="11" title="Termination">
            <p style={pStyle}>
              You can stop using rekōdo and delete your account at any time. We may suspend or terminate your access if you materially breach these Terms, with notice where reasonably practicable.
            </p>
          </Section>

          <Section id="s12" num="12" title="Changes to the Service and these Terms">
            <p style={pStyle}>
              We may modify or discontinue features of the Service, and may update these Terms from time to time. We&rsquo;ll provide reasonable notice of material changes. Continued use after changes take effect constitutes acceptance.
            </p>
          </Section>

          <Section id="s13" num="13" title="Governing law">
            <p style={pStyle}>
              These Terms are governed by the laws of Australia, without regard to conflict of law principles. You submit to the exclusive jurisdiction of the courts of Australia.
            </p>
          </Section>

          <Section id="s14" num="14" title="Contact">
            <p style={{ ...pStyle, fontFamily: MONO, fontSize: "0.85rem", letterSpacing: "0.02em", lineHeight: 1.9 }}>
              <strong style={{ fontFamily: SERIF }}>Rekodo Music</strong><br />
              ABN 22 405 469 880<br />
              <a href="mailto:hello@rekodo.co" style={linkStyle}>hello@rekodo.co</a>
            </p>
          </Section>

        </main>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${RULE}`, padding: "40px 24px", textAlign: "center", background: BG_SOFT }}>
        <p style={{ fontSize: "20px", margin: "0 0 10px" }}><Wordmark /></p>
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: "#999999", margin: 0 }}>
          rekōdo — Terms of Service · v1.0 · June 2026
        </p>
      </footer>
    </div>
  );
}
