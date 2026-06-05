"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SERIF = "var(--font-editorial)";
const MONO = "var(--font-mono)";
const JP = "var(--font-noto-jp), sans-serif";
const ORANGE = "#CC5500";

const NAV_ITEMS = [
  { href: "/about",      label: "About",      jp: "について" },
  { href: "/collection", label: "Collection", jp: "コレクション" },
  { href: "/dig",        label: "Dig",        jp: "発掘" },
  { href: "/lists",      label: "Lists",      jp: "リスト" },
  { href: "/gigs",       label: "Gigs",       jp: "公演" },
  { href: "/library",    label: "Library",    jp: "ライブラリ" },
] as const;

export default function AppNav({ username, displayLabel, avatarUrl }: { username: string; displayLabel?: string; avatarUrl?: string | null }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <nav
      style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
      className="flex items-center justify-between px-8 md:px-12 py-5 bg-white"
    >
      {/* Left — ō wordmark */}
      <Link
        href="/"
        aria-label="rekōdo home"
        style={{
          fontFamily: SERIF, fontWeight: 700, fontSize: "28px", color: ORANGE,
          textDecoration: "none", lineHeight: 1,
        }}
      >
        ō
      </Link>

      {/* Centre — nav links */}
      <div className="flex items-center gap-8">
        {NAV_ITEMS.map(({ href, label, jp }) => {
          const active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: MONO,
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: active ? "#0d0d0d" : "#aaaaaa",
                textDecoration: "none",
                borderBottom: `1.5px solid ${active ? ORANGE : "transparent"}`,
                paddingBottom: "3px",
                transition: "color 0.15s, border-color 0.15s",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
              className="hover:text-black"
            >
              {label}
              <span
                style={{
                  fontFamily: JP,
                  fontSize: "10px",
                  letterSpacing: 0,
                  textTransform: "none",
                  color: active ? "#0d0d0d" : "#c0c0c0",
                }}
              >
                {jp}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right — avatar + @username → settings, sign out */}
      <div className="flex items-center gap-4">
        <Link
          href="/settings/profile"
          style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}
        >
          {/* Avatar circle */}
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              aria-hidden="true"
              style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: ORANGE,
                fontFamily: MONO,
                fontSize: "11px",
                fontWeight: 600,
                color: "#ffffff",
                lineHeight: 1,
                flexShrink: 0,
                textTransform: "uppercase",
              }}
            >
              {(displayLabel ?? username).charAt(0)}
            </span>
          )}
          <span
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.06em",
              color: "#888888",
            }}
          >
            @{username}
          </span>
        </Link>
        <button
          onClick={handleSignOut}
          style={{
            fontFamily: MONO,
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#cccccc",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
          className="hover:text-black transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
