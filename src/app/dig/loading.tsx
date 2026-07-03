const MONO = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-editorial), Georgia, serif";
const ORANGE = "#CC5500";

export default function DigLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      {/* Nav placeholder */}
      <div style={{ height: 56, borderBottom: "1px solid #e8e8e2", background: "#ffffff" }} />

      {/* Header skeleton */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 24,
        padding: "28px 24px 20px", borderBottom: "1px solid #e8e8e2",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, marginBottom: 4 }}>
            Dig
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>
            Dig
          </div>
        </div>
      </div>

      {/* Sleeve card skeleton */}
      <div style={{ display: "flex", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{
          width: "100%", maxWidth: 500, height: 420,
          background: "#f4f4f4", borderRadius: 2,
          animation: "pulse 1.6s ease-in-out infinite",
        }} />
      </div>

      {/* Nav buttons skeleton */}
      <div style={{ display: "flex", justifyContent: "center", gap: 32, padding: "0 24px 32px" }}>
        {["← Previous", "Dig again ↺", "Next →"].map((label) => (
          <div
            key={label}
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#ccc",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
