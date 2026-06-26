import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="py-12 px-8 md:px-12 lg:px-16 bg-white border-t border-black/10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <p
          className="text-sm text-black"
          style={{ fontFamily: "var(--font-shippori), Georgia, serif" }}
        >
          rek<span style={{ color: "#CC5500" }}>ō</span>do
        </p>
        <p
          className="text-xs text-black/40 tracking-widest uppercase"
          style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
        >
          rekodo.co — {new Date().getFullYear()}
        </p>
        <div
          className="flex items-center gap-6 text-xs text-black/40 tracking-widest uppercase"
          style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
        >
          <Link href="/about" className="hover:text-black/70 transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-black/70 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-black/70 transition-colors">Terms</Link>
          <a href="mailto:hello@rekodo.co" className="hover:text-black/70 transition-colors">Contact</a>
          <a
            href="https://www.instagram.com/rekodomusic"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black/70 transition-colors"
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
