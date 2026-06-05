"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";
const JP    = "var(--font-noto-jp), sans-serif";
const ORANGE = "#CC5500";

const NAV_ITEMS = [
  { href: "/collection", en: "Collection", ja: "コレクション" },
  { href: "/lists",      en: "Lists",      ja: "リスト" },
  { href: "/dig",        en: "Dig",        ja: "発掘" },
] as const;

interface LandingNavProps {
  username?: string | null;
}

export default function LandingNav({ username }: LandingNavProps) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-8 md:px-12"
      style={{ paddingTop: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
    >
      {/* Left — ō wordmark */}
      <Link
        href="/"
        aria-label="rekōdo home"
        style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, lineHeight: 1, textDecoration: "none" }}
      >
        ō
      </Link>

      {/* Centre — nav links */}
      <div className="flex items-center gap-8">
        {NAV_ITEMS.map(({ href, en, ja }) => (
          <Link
            key={href}
            href={href}
            className="hover:text-black transition-colors"
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#aaaaaa",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              borderBottom: "1.5px solid transparent",
              paddingBottom: "3px",
            }}
          >
            {en}
            <span style={{ fontFamily: JP, fontSize: "10px", letterSpacing: 0, textTransform: "none", color: "#c0c0c0" }}>
              {ja}
            </span>
          </Link>
        ))}
      </div>

      {/* Right — @username + Sign out, or Sign in */}
      {username ? (
        <div className="flex items-center gap-4">
          <Link
            href="/collection"
            style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#888888", textDecoration: "none" }}
          >
            @{username}
          </Link>
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#cccccc",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
            className="hover:text-black transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: ORANGE, textDecoration: "none" }}
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
