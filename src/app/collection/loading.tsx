export default function CollectionLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      {/* Nav placeholder */}
      <div style={{ height: 56, borderBottom: "1px solid #e8e8e2", background: "#ffffff" }} />

      {/* Desktop: three-column layout; Mobile: single-column list */}
      <div className="collection-loading-grid" style={{ height: "calc(100vh - 56px)" }}>
        {/* Left: search + list skeleton (hidden on mobile) */}
        <div className="collection-loading-left" style={{ borderRight: "1px solid #e8e8e2", padding: "16px 12px", overflow: "hidden" }}>
          <div style={{ height: 36, background: "#f0f0f0", borderRadius: 2, marginBottom: 12, animation: "pulse 1.6s ease-in-out infinite" }} />
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f4f4f4" }}>
              <div style={{ width: 32, height: 32, background: "#f0f0f0", flexShrink: 0, animation: "pulse 1.6s ease-in-out infinite", animationDelay: `${i * 0.04}s` }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, background: "#f0f0f0", borderRadius: 2, marginBottom: 4, width: `${60 + (i % 4) * 10}%`, animation: "pulse 1.6s ease-in-out infinite", animationDelay: `${i * 0.04}s` }} />
                <div style={{ height: 8, background: "#f0f0f0", borderRadius: 2, width: `${40 + (i % 3) * 10}%`, animation: "pulse 1.6s ease-in-out infinite", animationDelay: `${i * 0.04}s` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: cover grid spanning full width */}
        <div style={{ padding: 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: "1", background: "#f0f0f0", animation: "pulse 1.6s ease-in-out infinite", animationDelay: `${i * 0.02}s` }} />
            ))}
          </div>
        </div>

        {/* Right: detail skeleton (hidden on mobile) */}
        <div className="collection-loading-right" style={{ borderLeft: "1px solid #e8e8e2", padding: 20 }}>
          <div style={{ aspectRatio: "1", background: "#f0f0f0", marginBottom: 16, animation: "pulse 1.6s ease-in-out infinite" }} />
          <div style={{ height: 20, background: "#f0f0f0", borderRadius: 2, marginBottom: 8, animation: "pulse 1.6s ease-in-out infinite" }} />
          <div style={{ height: 14, background: "#f0f0f0", borderRadius: 2, width: "60%", animation: "pulse 1.6s ease-in-out infinite" }} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .collection-loading-grid {
          display: grid;
          grid-template-columns: 1fr;
        }
        .collection-loading-left,
        .collection-loading-right {
          display: none;
        }
        @media (min-width: 768px) {
          .collection-loading-grid {
            grid-template-columns: 280px 1fr 320px;
          }
          .collection-loading-left,
          .collection-loading-right {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
