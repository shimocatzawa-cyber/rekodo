import Link from "next/link";

const MONO  = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-shippori), Georgia, serif";

export default function WaitlistSection() {
  return (
    <section className="py-40 px-8 md:px-12 lg:px-16 bg-black text-white">
      <div className="max-w-2xl mx-auto text-center space-y-12">
        <p
          className="text-xs tracking-widest uppercase text-[#CC5500]"
          style={{ fontFamily: MONO }}
        >
          Free to join
        </p>

        <h2
          className="text-5xl md:text-6xl lg:text-7xl leading-tight text-white"
          style={{ fontFamily: SERIF }}
        >
          Your records say everything about you.
        </h2>

        <p
          className="text-sm leading-relaxed text-white/50 max-w-sm mx-auto"
          style={{ fontFamily: MONO }}
        >
          Import your Discogs collection, discover your collector archetype, and
          let rekōdo tell the story your shelf already knows.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="text-xs tracking-widest uppercase bg-[#CC5500] text-white px-10 py-4 hover:opacity-90 transition-opacity"
            style={{ fontFamily: MONO }}
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="text-xs tracking-widest uppercase border border-white/30 text-white/60 px-10 py-4 hover:border-white hover:text-white transition-colors"
            style={{ fontFamily: MONO }}
          >
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
