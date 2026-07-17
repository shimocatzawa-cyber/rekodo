const MONO = "var(--font-dm-mono), 'Courier New', monospace";

export default function DigitalLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#FDFCF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#999" }}>
        Loading digital collection…
      </span>
    </div>
  );
}
