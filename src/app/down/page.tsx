"use client";

const MONO  = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-shippori), Georgia, serif";

export default function DownPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#FDFCF8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: "#CC5500", marginBottom: 8 }}>
          rek<span style={{ color: "#CC5500" }}>ō</span>do
        </div>
        <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#999", marginBottom: 24 }}>
          Temporarily unavailable
        </p>
        <p style={{ fontFamily: MONO, fontSize: 13, color: "#555", lineHeight: 1.8, margin: "0 0 32px" }}>
          This page is temporarily unavailable.<br />
          Check back again soon — we&apos;re working on it.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", background: "#0a0a0a", color: "#FDFCF8", border: "none", padding: "10px 24px", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
