"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";

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

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="min-h-screen bg-white flex flex-col px-8 md:px-12">
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

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[360px]">
          <h1
            className="text-4xl text-black mb-2 leading-tight"
            style={{ fontFamily: SERIF }}
          >
            Reset password
          </h1>
          <p
            className="mb-10"
            style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
          >
            Enter your email and we&apos;ll send a reset link.
          </p>

          {state?.message ? (
            <p style={{ fontFamily: MONO, fontSize: "12px", color: "#226622", letterSpacing: "0.04em", lineHeight: 1.6 }}>
              {state.message}
            </p>
          ) : (
            <form action={action} className="space-y-6">
              <div>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rk-form-input border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
                  style={inputStyle}
                />
              </div>

              {state?.error && (
                <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc2200", letterSpacing: "0.04em" }}>
                  {state.error}
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
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p
            className="mt-8"
            style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
          >
            Remember it?{" "}
            <Link href="/login" style={{ color: "#CC5500", textDecoration: "none" }}>
              Back to sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
