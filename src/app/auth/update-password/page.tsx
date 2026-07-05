"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

function UpdatePasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [ready,   setReady]   = useState(false);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let settled = false;

    function markReady() {
      if (!settled) { settled = true; setReady(true); }
    }

    // PKCE flow: callback route already exchanged the code and set the session;
    // page arrives with ?recovery=1.
    if (searchParams.get("recovery") === "1") {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) markReady();
      });
    }

    // Implicit flow: Supabase fires PASSWORD_RECOVERY when it detects the
    // recovery token in the URL hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    // If neither path fires within 5s, the link is invalid/expired.
    const timer = setTimeout(() => {
      if (!settled) { settled = true; setExpired(true); }
    }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form     = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm  = (form.elements.namedItem("confirm")  as HTMLInputElement).value;

    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) { setError(updateError.message); return; }
    setSuccess(true);
    setTimeout(() => router.push("/collection"), 2000);
  }

  if (success) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "12px", color: "#226622", letterSpacing: "0.04em", lineHeight: 1.6 }}>
        Password updated — taking you to your collection…
      </p>
    );
  }

  if (expired) {
    return (
      <div>
        <p style={{ fontFamily: MONO, fontSize: "12px", color: "#cc2200", letterSpacing: "0.04em", lineHeight: 1.6, marginBottom: "16px" }}>
          This reset link has expired or is invalid.
        </p>
        <Link
          href="/forgot-password"
          style={{ fontFamily: MONO, fontSize: "11px", color: "#CC5500", textDecoration: "none", letterSpacing: "0.06em" }}
        >
          Request a new link →
        </Link>
      </div>
    );
  }

  if (!ready) {
    return (
      <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}>
        Verifying reset link…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="password" style={labelStyle}>New password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="rk-form-input border border-[#dddddd] focus:border-[#CC5500] outline-none transition-colors"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="confirm" style={labelStyle}>Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
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
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}

export default function UpdatePasswordPage() {
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
            New password
          </h1>
          <p
            className="mb-10"
            style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}
          >
            Choose a new password for your account.
          </p>

          <Suspense
            fallback={
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "#aaaaaa", letterSpacing: "0.06em" }}>
                Verifying reset link…
              </p>
            }
          >
            <UpdatePasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
