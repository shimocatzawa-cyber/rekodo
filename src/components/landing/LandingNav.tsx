"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-dm-mono), 'Courier New', monospace";
const ORANGE = "#CC5500";

interface LandingNavProps {
  username?: string | null;
  displayLabel?: string | null;
  avatarUrl?: string | null;
}

export default function LandingNav({ username, displayLabel, avatarUrl }: LandingNavProps) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-8 md:px-12"
        style={{ paddingTop: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
      >
        {/* Left — ō wordmark */}
        <Link
          href="/"
          aria-label="rekōdo home"
          style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "28px", color: ORANGE, lineHeight: 1, textDecoration: "none" }}
        >
          ō
        </Link>

        {/* Right — avatar + display name + Sign out, or Request Access */}
        {username ? (
          <div className="flex items-center gap-4">
            <Link
              href="/settings/profile"
              style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}
            >
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
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: "50%",
                    background: ORANGE, fontFamily: MONO, fontSize: "11px",
                    fontWeight: 600, color: "#ffffff", lineHeight: 1,
                    flexShrink: 0, textTransform: "uppercase",
                  }}
                >
                  {(displayLabel ?? username ?? "?").charAt(0)}
                </span>
              )}
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#888888" }}>
                @{displayLabel ?? username}
              </span>
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
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#888888",
                textDecoration: "none",
              }}
              className="hover:text-black transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              style={{
                fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#ffffff",
                background: ORANGE, padding: "8px 16px",
                textDecoration: "none",
              }}
              className="hover:opacity-90 transition-opacity"
            >
              Sign up
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
