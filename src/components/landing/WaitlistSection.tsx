"use client";

import { useState } from "react";

const MONO = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-shippori), Georgia, serif";

export default function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus(data.message === "Already registered" ? "duplicate" : "success");
      if (data.message !== "Already registered") setEmail("");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <section
      id="waitlist"
      className="py-40 px-8 md:px-12 lg:px-16 bg-black text-white"
    >
      <div className="max-w-2xl mx-auto text-center space-y-12">
        <p
          className="text-xs tracking-widest uppercase text-[#CC5500]"
          style={{ fontFamily: MONO }}
        >
          Early access
        </p>

        <h2
          className="text-5xl md:text-6xl lg:text-7xl leading-tight text-white"
          style={{ fontFamily: SERIF }}
        >
          Request access
        </h2>

        <p
          className="text-sm leading-relaxed text-white/50 max-w-sm mx-auto"
          style={{ fontFamily: MONO }}
        >
          rekōdo is in private beta. Leave your email and we&apos;ll reach out when
          your spot is ready.
        </p>

        {status === "success" && (
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "20px", color: "#ffffff", lineHeight: 1.5 }}>
            You&apos;re on the list. We&apos;ll be in touch.
          </p>
        )}

        {status === "duplicate" && (
          <p style={{ fontFamily: MONO, fontSize: "13px", color: "#888888", letterSpacing: "0.04em" }}>
            You&apos;re already on the list.
          </p>
        )}

        {status !== "success" && status !== "duplicate" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="bg-white/5 border border-white/20 px-5 py-4 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#CC5500] transition-colors"
              style={{ fontFamily: MONO }}
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="bg-white/5 border border-white/20 px-5 py-4 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#CC5500] transition-colors"
              style={{ fontFamily: MONO }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-[#CC5500] text-white px-8 py-4 text-xs tracking-widest uppercase font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: MONO }}
            >
              {status === "loading" ? "Sending…" : "Request Access"}
            </button>

            {error && (
              <p className="text-xs text-red-400" style={{ fontFamily: MONO }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
