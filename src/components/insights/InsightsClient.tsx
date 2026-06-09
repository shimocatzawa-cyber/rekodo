"use client";

import AppNav from "@/components/AppNav";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

interface Props {
  username:      string;
  displayLabel?: string;
  avatarUrl?:    string | null;
}

export default function InsightsClient({ username, displayLabel, avatarUrl }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      <main style={{ padding: "48px 32px 80px", maxWidth: "960px", margin: "0 auto" }}>
        {/* Heading */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: "48px", fontWeight: 700, color: "#0d0d0d", lineHeight: 1.1, marginBottom: "6px" }}>
            Insights
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE }}>
            インサイト
          </p>
        </div>

        {/* Rule */}
        <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", marginBottom: "32px" }} />

        {/* Placeholder */}
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: "#aaaaaa" }}>
          Collection intelligence. Coming with your next sync.
        </p>
      </main>
    </div>
  );
}
