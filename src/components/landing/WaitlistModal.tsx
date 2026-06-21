"use client";

import { useState, useEffect, useRef } from "react";

const MONO = "var(--font-dm-mono), 'Courier New', monospace";
const SERIF = "var(--font-shippori), Georgia, serif";
const ORANGE = "#CC5500";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-white"
        style={{ padding: "48px 40px" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-title"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: "20px", right: "20px",
            fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em",
            color: "#aaaaaa", background: "none", border: "none", cursor: "pointer",
          }}
          className="hover:text-black transition-colors"
        >
          ✕
        </button>

        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", color: ORANGE, marginBottom: "16px", textTransform: "uppercase" }}>
          Early access
        </p>

        <h2
          id="waitlist-title"
          style={{ fontFamily: SERIF, fontSize: "32px", color: "#0d0d0d", marginBottom: "28px", lineHeight: 1.15 }}
        >
          Request access
        </h2>

        {/* Form mounts fresh every time the modal opens */}
        <WaitlistForm />
      </div>
    </div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [estCollectionSize, setEstCollectionSize] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate">("idle");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !name || !estCollectionSize || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, estCollectionSize: Number(estCollectionSize) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus(data.message === "Already registered" ? "duplicate" : "success");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "17px", color: "#0d0d0d", lineHeight: 1.5 }}>
        You&apos;re on the list. We&apos;ll be in touch.
      </p>
    );
  }

  if (status === "duplicate") {
    return (
      <p style={{ fontFamily: MONO, fontSize: "12px", color: "#888888", letterSpacing: "0.04em" }}>
        You&apos;re already on the list.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="modal-email"
          style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#999999", display: "block", marginBottom: "8px" }}
        >
          Email
        </label>
        <input
          ref={emailRef}
          id="modal-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
          style={{ fontFamily: MONO, fontSize: "13px", color: "#0d0d0d", padding: "12px 14px" }}
        />
      </div>

      <div>
        <label
          htmlFor="modal-name"
          style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#999999", display: "block", marginBottom: "8px" }}
        >
          First Name
        </label>
        <input
          id="modal-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          required
          className="w-full border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
          style={{ fontFamily: MONO, fontSize: "13px", color: "#0d0d0d", padding: "12px 14px" }}
        />
      </div>

      <div>
        <label
          htmlFor="modal-collection-size"
          style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#999999", display: "block", marginBottom: "8px" }}
        >
          Est. Collection Size
        </label>
        <input
          id="modal-collection-size"
          type="number"
          min={0}
          step={1}
          value={estCollectionSize}
          onChange={(e) => setEstCollectionSize(e.target.value)}
          placeholder="e.g. 250"
          required
          className="w-full border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
          style={{ fontFamily: MONO, fontSize: "13px", color: "#0d0d0d", padding: "12px 14px" }}
        />
      </div>

      {error && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc2200", letterSpacing: "0.04em" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: ORANGE, color: "#ffffff",
          fontFamily: MONO, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase",
          border: "none", cursor: status === "loading" ? "not-allowed" : "pointer",
          padding: "15px 0", marginTop: "8px",
        }}
      >
        {status === "loading" ? "Sending…" : "Request Access"}
      </button>
    </form>
  );
}
