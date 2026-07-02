"use client";

import Link from "next/link";
import { useState } from "react";

const MONO  = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-shippori), Georgia, serif";

const labelStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#999999",
  display: "block",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "13px",
  color: "#0d0d0d",
  background: "white",
  display: "block",
  width: "100%",
  padding: "12px 14px",
};

export default function WaitlistPage() {
  const [email,   setEmail]   = useState("");
  const [name,    setName]    = useState("");
  const [pending, setPending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-8 md:px-12">
      {/* Logomark */}
      <div className="pt-8">
        <Link
          href="/"
          aria-label="rekōdo home"
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: "28px",
            color: "#CC5500",
            textDecoration: "none",
            lineHeight: 1,
          }}
        >
          ō
        </Link>
      </div>

      {/* Centred form */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[360px]">
          <h1
            className="text-4xl text-black mb-2 leading-tight"
            style={{ fontFamily: SERIF }}
          >
            {done ? "You're on the list." : "Join the waitlist."}
          </h1>
          <p
            className="mb-10"
            style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
          >
            {done
              ? "We'll be in touch when a spot opens up."
              : "rekōdo is currently invite only. Leave your email and we'll let you know when a spot opens up."}
          </p>

          {done ? (
            <p
              style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
            >
              Already have an account?{" "}
              <Link href="/login" style={{ color: "#CC5500", textDecoration: "none" }}>
                Sign in →
              </Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rk-form-input border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="name" style={labelStyle}>
                  Name <span style={{ color: "#cccccc" }}>(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rk-form-input border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
                  style={inputStyle}
                />
              </div>

              {error && (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc2200", letterSpacing: "0.04em" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full bg-black text-white hover:bg-[#CC5500] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  fontFamily: MONO,
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "15px 0",
                  border: "none",
                  cursor: pending ? "not-allowed" : "pointer",
                }}
              >
                {pending ? "Joining…" : "Join waitlist"}
              </button>
            </form>
          )}

          {!done && (
            <p
              className="mt-8"
              style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
            >
              Already have an account?{" "}
              <Link href="/login" style={{ color: "#CC5500", textDecoration: "none" }}>
                Sign in →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
