import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative flex flex-col justify-end min-h-screen pt-24 pb-16 px-8 md:px-12 lg:px-16 overflow-hidden">
      {/* Full-width wordmark */}
      <div className="flex-1 flex flex-col justify-center">
        <h1
          className="leading-none tracking-tighter text-black select-none"
          style={{
            fontFamily: "var(--font-shippori), Georgia, serif",
            fontSize: "clamp(5rem, 18vw, 22rem)",
            letterSpacing: "-0.02em",
          }}
        >
          rek<span style={{ color: "#CC5500" }}>ō</span>do
        </h1>
      </div>

      {/* Bottom strip */}
      <div className="flex items-end justify-between pt-16 border-t border-black/10">
        <p
          style={{
            fontFamily: "var(--font-caveat), cursive",
            fontSize: "28px",
            color: "#666666",
            lineHeight: 1.2,
          }}
        >
          Your records say everything about you.
        </p>
        <Link
          href="#waitlist"
          className="font-mono text-xs tracking-widest uppercase bg-black text-white px-8 py-4 hover:bg-[#CC5500] hover:text-black transition-colors"
          style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
        >
          Request access ↓
        </Link>
      </div>
    </section>
  );
}
