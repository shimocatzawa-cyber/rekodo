const MONO = "var(--font-dm-mono), 'Courier New', monospace";

function SkeletonBlock({ width = "100%", height = 16, style = {} }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, background: "#f0f0f0", borderRadius: 2,
      animation: "pulse 1.6s ease-in-out infinite",
      ...style,
    }} />
  );
}

function StatCard() {
  return (
    <div style={{ padding: "20px 24px", borderBottom: "1px solid #e8e8e2" }}>
      <SkeletonBlock width={80} height={10} style={{ marginBottom: 10 }} />
      <SkeletonBlock width={120} height={28} style={{ marginBottom: 6 }} />
      <SkeletonBlock width={60} height={10} />
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      {/* Nav placeholder */}
      <div style={{ height: 56, borderBottom: "1px solid #e8e8e2", background: "#ffffff" }} />

      {/* Page header skeleton */}
      <div style={{ padding: "32px 24px 24px", borderBottom: "1px solid #e8e8e2", maxWidth: 1200, margin: "0 auto" }}>
        <SkeletonBlock width={60} height={10} style={{ marginBottom: 10 }} />
        <SkeletonBlock width={180} height={32} style={{ marginBottom: 8 }} />
        <SkeletonBlock width={240} height={12} />
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", maxWidth: 1200, margin: "0 auto" }}>
        {Array.from({ length: 6 }).map((_, i) => <StatCard key={i} />)}
      </div>

      {/* Two-column skeleton sections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, maxWidth: 1200, margin: "0 auto", borderTop: "1px solid #e8e8e2" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: "28px 24px", borderBottom: "1px solid #e8e8e2", borderRight: i % 2 === 0 ? "1px solid #e8e8e2" : undefined }}>
            <SkeletonBlock width={80} height={9} style={{ marginBottom: 12 }} />
            <SkeletonBlock width="100%" height={120} style={{ marginBottom: 12 }} />
            <SkeletonBlock width="70%" height={9} />
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ fontFamily: MONO, fontSize: 10, color: "#ccc", letterSpacing: "0.1em" }}>
          LOADING INSIGHTS…
        </p>
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
