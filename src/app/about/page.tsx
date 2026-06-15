import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SupporterContent from "@/components/profile/SupporterContent";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

const BODY_PARAGRAPHS = [
  "Not because streaming doesn't work. Because owning music means something different. A record is a commitment. It takes up space. It has a weight and a smell and a history.",
  "We built rekōdo because the serious collector deserved something built for them. Not an algorithm. Not a playlist. A mirror — one that reflects twenty years of taste back at you and says: this is who you are.",
  "rekōdo is independent, ad-free, and built by people who own too many records. If rekōdo has given you something — a recommendation that changed your week, a list that made you think, a Dig that found the record you didn't know you needed — consider buying us one back.",
];

export default async function AboutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let username: string | null = null;
  let displayLabel: string | null = null;
  let avatarUrl: string | null = null;
  let isSupporter = false;

  if (user) {
    const emailPrefix = (user.email ?? "").split("@")[0] || "user";
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, is_donor")
      .eq("id", user.id)
      .maybeSingle();

    const autoGen = `${emailPrefix}_${user.id.slice(0, 6)}`;
    const raw = profile?.username ?? null;
    username     = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
    displayLabel = profile?.display_name?.trim() || username;
    avatarUrl    = profile?.avatar_url ?? null;
    isSupporter  = !!(profile as { is_donor?: boolean } | null)?.is_donor;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* Nav — full AppNav for authenticated users, minimal wordmark for guests */}
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

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Headline */}
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

        {/* Subhead */}
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

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {BODY_PARAGRAPHS.map((p, i) => (
            <p
              key={i}
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(16px, 2vw, 19px)",
                color: "#303030",
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              {p}
            </p>
          ))}
        </div>

      </main>

      {/* Supporter section — sits below the About Us copy */}
      <div style={{ borderTop: "1px solid #e0e0da", maxWidth: 960, margin: "0 auto 80px", padding: "0 32px" }}>
        <SupporterContent isOwner={!!user} isSupporter={isSupporter} />
      </div>

    </div>
  );
}
