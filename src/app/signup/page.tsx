"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signup } from "@/app/auth/actions";

const MONO = "var(--font-dm-mono), 'Courier New', monospace";
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

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  const [agreed, setAgreed] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

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
            Create account
          </h1>
          <p
            className="mb-10"
            style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
          >
            rekōdo is currently invite-only.
          </p>

          {state?.message ? (
            /* Success — email confirmation sent */
            <div className="space-y-6">
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: "12px",
                  color: "#CC5500",
                  letterSpacing: "0.05em",
                  lineHeight: 1.7,
                }}
              >
                {state.message}
              </p>
              <Link
                href="/login"
                style={{
                  fontFamily: MONO,
                  fontSize: "11px",
                  color: "#0d0d0d",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                }}
              >
                Back to sign in →
              </Link>
            </div>
          ) : (
            <form action={action} className="space-y-6">
              {/* Username */}
              <div>
                <label htmlFor="username" style={labelStyle}>Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                  title="Letters, numbers, and underscores only"
                  className="rk-form-input border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
                  style={inputStyle}
                />
                <p
                  className="mt-2"
                  style={{ fontFamily: MONO, fontSize: "10px", color: "#bbbbbb", letterSpacing: "0.05em" }}
                >
                  Letters, numbers and underscores only
                </p>
              </div>

              {/* Email */}
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

              {/* Password */}
              <div>
                <label htmlFor="password" style={labelStyle}>Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="rk-form-input border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
                  style={inputStyle}
                />
                <p
                  className="mt-2"
                  style={{ fontFamily: MONO, fontSize: "10px", color: "#bbbbbb", letterSpacing: "0.05em" }}
                >
                  Minimum 6 characters
                </p>
              </div>

              {/* Error */}
              {state?.error && (
                <p
                  style={{ fontFamily: MONO, fontSize: "11px", color: "#cc2200", letterSpacing: "0.04em" }}
                >
                  {state.error}
                </p>
              )}

              {/* Terms & Privacy consent */}
              <div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "9px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (e.target.checked) setAttemptedSubmit(false);
                    }}
                    className="mt-0.5"
                  />
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: "#666666", letterSpacing: "0.04em", lineHeight: 1.6 }}>
                    I agree to the{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#CC5500", textDecoration: "underline" }}
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#CC5500", textDecoration: "underline" }}
                    >
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {attemptedSubmit && !agreed && (
                  <p
                    className="mt-2"
                    style={{ fontFamily: MONO, fontSize: "11px", color: "#9a1f1f", letterSpacing: "0.04em" }}
                  >
                    Please agree to the Terms of Service and Privacy Policy to continue.
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                onClick={(e) => {
                  if (!agreed) {
                    e.preventDefault();
                    setAttemptedSubmit(true);
                  }
                }}
                className="w-full bg-black text-white hover:bg-[#CC5500] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  fontFamily: MONO,
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "15px 0",
                  border: "none",
                  cursor: pending ? "not-allowed" : "pointer",
                  opacity: !pending && !agreed ? 0.4 : 1,
                }}
              >
                {pending ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}

          {/* Cross-link */}
          {!state?.message && (
            <p
              className="mt-8"
              style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
            >
              Already have an account?{" "}
              <Link
                href="/login"
                style={{ color: "#CC5500", textDecoration: "none" }}
              >
                Sign in →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
