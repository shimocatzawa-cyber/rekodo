import Link from "next/link";

export default function HeroSection({ isSignedIn }: { isSignedIn: boolean }) {

  const wordmark = (
    <h1
      className="leading-none tracking-tighter text-black select-none text-left"
      style={{
        fontFamily: "var(--font-shippori), Georgia, serif",
        fontSize: "clamp(5rem, 18vw, 22rem)",
        letterSpacing: "-0.02em",
      }}
    >
      rek<span style={{ color: "#CC5500" }}>ō</span>do
    </h1>
  );

  return (
    <section
      className="relative flex flex-col justify-end pt-32 pb-24 md:pt-24 md:pb-16 px-8 md:px-12 lg:px-16 overflow-hidden"
      style={{ minHeight: "100dvh" }}
    >
      {/* Full-width wordmark */}
      <div className="flex-1 flex flex-col justify-center items-start">
        {isSignedIn ? (
          <Link href="/collection" style={{ textDecoration: "none" }}>
            {wordmark}
          </Link>
        ) : (
          wordmark
        )}
      </div>


    </section>
  );
}
