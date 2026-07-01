import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "rekōdo — Your records say everything about you",
  description:
    "rekōdo is the music identity platform built for serious vinyl collectors. Import from Discogs or Bandcamp, discover your collector archetype, deep-dive artist discographies, and share curated lists.",
  alternates: { canonical: "https://rekodo.co" },
  openGraph: {
    title: "rekōdo — Your records say everything about you",
    description:
      "The music identity platform built for serious vinyl collectors. Import your collection, discover your archetype, and let your records speak.",
    url: "https://rekodo.co",
    type: "website",
  },
};

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "rekōdo",
  url: "https://rekodo.co",
  email: "hello@rekodo.co",
  sameAs: ["https://www.instagram.com/rekodomusic"],
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@rekodo.co",
    contactType: "customer support",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "rekōdo",
  url: "https://rekodo.co",
  description:
    "rekōdo is a music identity platform for serious vinyl collectors. It lets you catalogue your record collection, discover your taste archetype, explore artist deep dives, build curated lists, and connect with other collectors.",
  applicationCategory: "MusicApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free to use. Optional supporter subscription from $5/month.",
  },
  featureList: [
    "Vinyl collection cataloguing",
    "Discogs and Bandcamp import",
    "Collector archetype analysis",
    "Artist deep dive discographies",
    "Taste profile and insights",
    "Curated list builder",
    "AI-powered record recommendations",
    "Community and collection matching",
  ],
};

const timeout = (ms: number) => new Promise<null>(resolve => setTimeout(() => resolve(null), ms));

export default async function LandingPage() {
  const supabase = await createClient();

  const authResult = await Promise.race([
    supabase.auth.getUser().then(r => r.data.user),
    timeout(3000),
  ]);
  const user = authResult ?? null;

  let username: string | null = null;
  let displayLabel: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    const profileResult = await Promise.race([
      supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      timeout(3000),
    ]);
    const emailPrefix = (user.email ?? "").split("@")[0] || "user";
    const profile = profileResult?.data ?? null;
    username = profile?.username ?? emailPrefix;
    displayLabel = profile?.display_name?.trim() || username;
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
      <main className="flex flex-col min-h-screen bg-white">
        <LandingNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
        <div style={{
          fontFamily: "var(--font-dm-mono), 'Courier New', monospace",
          fontSize: "11px",
          letterSpacing: "0.04em",
          color: "#7a5500",
          background: "#fff8f0",
          borderBottom: "1px solid #f5ddb8",
          padding: "10px 24px",
          lineHeight: 1.6,
          textAlign: "center",
        }}>
          We&apos;re experiencing an extended outage with our infrastructure provider. Things may be slower than usual or temporarily unavailable — we&apos;re on it.
        </div>
        <HeroSection isSignedIn={!!user} />
        <LandingFooter />
      </main>
    </>
  );
}
