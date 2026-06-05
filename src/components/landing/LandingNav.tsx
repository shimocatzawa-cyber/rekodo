"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WaitlistModal from "./WaitlistModal";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-dm-mono), 'Courier New', monospace";
const ORANGE = "#CC5500";

interface LandingNavProps {
  username?: string | null;
}

export default function LandingNav({ username }: LandingNavProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

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
          style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: ORANGE, lineHeight: 1, textDecoration: "none" }}
        >
          ō
        </Link>

        {/* Right — @username + Sign out, or Request Access */}
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
          <button
            onClick={() => setModalOpen(true)}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#ffffff",
              background: ORANGE, border: "none", cursor: "pointer",
              padding: "8px 16px",
            }}
            className="hover:opacity-90 transition-opacity"
          >
            Request Access
          </button>
        )}
      </nav>

      <WaitlistModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
