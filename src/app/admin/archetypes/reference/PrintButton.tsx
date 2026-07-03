"use client";
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        fontFamily: "'DM Mono', 'Courier New', monospace",
        fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
        background: "#CC5500", color: "#fff", border: "none",
        padding: "8px 20px", cursor: "pointer",
      }}
    >
      Download / Print PDF
    </button>
  );
}
