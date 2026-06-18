import Link from "next/link";
import AppNav from "@/components/AppNav";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

interface Props {
  username:     string;
  displayLabel: string;
  avatarUrl:    string | null;
  feature:      string;
}

export default function SupporterGate({ username, displayLabel, avatarUrl, feature }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#FDFCF8" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <div style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "80px 24px 120px",
        textAlign: "center",
      }}>
        <p style={{
          fontFamily: MONO,
          fontSize: "0.6rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: ORANGE,
          margin: "0 0 20px",
        }}>
          Supporter Only
        </p>

        <h1 style={{
          fontFamily: SERIF,
          fontSize: "clamp(2rem, 6vw, 3.2rem)",
          fontWeight: 400,
          color: INK,
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          margin: "0 0 24px",
        }}>
          {feature}
        </h1>

        <p style={{
          fontFamily: MONO,
          fontSize: "0.65rem",
          letterSpacing: "0.04em",
          color: "#666",
          lineHeight: 1.8,
          margin: "0 0 40px",
        }}>
          This feature is available to rek<span style={{ color: ORANGE }}>ō</span>do supporters.
          <br />
          Support the project to unlock it.
        </p>

        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 40 }}>
          <Link
            href="/about#support"
            style={{
              display: "inline-block",
              fontFamily: MONO,
              fontSize: "0.65rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#FDF6F0",
              background: INK,
              padding: "14px 32px",
              textDecoration: "none",
            }}
          >
            Support rek<span style={{ color: ORANGE }}>ō</span>do →
          </Link>
        </div>
      </div>
    </div>
  );
}
