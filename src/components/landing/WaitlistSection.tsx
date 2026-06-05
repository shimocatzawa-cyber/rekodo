"use client";

import { useState } from "react";

export default function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("success");
      setMessage("You're on the list. We'll be in touch.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <section
      id="waitlist"
      className="py-40 px-8 md:px-12 lg:px-16 bg-black text-white"
    >
      <div className="max-w-2xl mx-auto text-center space-y-12">
        {/* Section marker */}
        <p
          className="text-xs tracking-widest uppercase text-[#CC5500]"
          style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
        >
          Early access
        </p>

        <h2
          className="text-5xl md:text-6xl lg:text-7xl leading-tight text-white"
          style={{ fontFamily: "var(--font-shippori), Georgia, serif" }}
        >
          Request access
        </h2>

        <p
          className="text-sm leading-relaxed text-white/50 max-w-sm mx-auto"
          style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
        >
          rekōdo is in private beta. Leave your email and we&apos;ll reach out when
          your spot is ready.
        </p>

        {status === "success" ? (
          <p
            className="text-sm text-[#CC5500] tracking-wide"
            style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
          >
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 bg-white/5 border border-white/20 px-5 py-4 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#CC5500] transition-colors"
              style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-[#CC5500] text-black px-8 py-4 text-xs tracking-widest uppercase font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
            >
              {status === "loading" ? "Sending…" : "Join waitlist"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p
            className="text-xs text-red-400 mt-2"
            style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
