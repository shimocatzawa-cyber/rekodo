"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateTasteSummary, setUsername } from "./actions";

const MONO   = "var(--font-mono)";
const SERIF  = "var(--font-editorial)";
const ORANGE = "#CC5500";

export function FollowButton({ profileId, initialIsFollowing }: { profileId: string; initialIsFollowing: boolean }) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const prev = isFollowing;
    setIsFollowing(!prev);
    try {
      const res = await fetch("/api/collectors/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: profileId, action: prev ? "unfollow" : "follow" }),
      });
      if (!res.ok) setIsFollowing(prev);
    } catch {
      setIsFollowing(prev);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      style={{
        fontFamily: MONO,
        fontSize: "9px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: isFollowing ? "#aaaaaa" : ORANGE,
        background: "none",
        border: `1px solid ${isFollowing ? "rgba(0,0,0,0.12)" : ORANGE}`,
        cursor: pending ? "default" : "pointer",
        padding: "7px 14px",
        transition: "all 0.15s",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

export function GenerateSummaryBtn({
  userId,
  starSign = "",
  hasExisting,
}: {
  userId: string;
  starSign?: string;
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    startTransition(async () => {
      const result = await generateTasteSummary(userId, starSign);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <button
        onClick={handle}
        disabled={pending}
        style={{
          fontFamily: MONO,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: pending ? "#cccccc" : hasExisting ? "#bbbbbb" : ORANGE,
          background: "none",
          border: "none",
          cursor: pending ? "default" : "pointer",
          padding: 0,
          transition: "color 0.15s",
        }}
      >
        {pending ? "Generating…" : hasExisting ? "Regenerate summary →" : "Generate your taste summary →"}
      </button>
      {error && (
        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function UsernameSetupForm({ suggestedUsername }: { suggestedUsername: string }) {
  const [value, setValue] = useState(
    suggestedUsername.replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 30)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: MONO,
    fontSize: "15px",
    color: "#0d0d0d",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    padding: "8px 0 10px",
    boxSizing: "border-box",
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setUsername(value);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <p style={{
        fontFamily: MONO,
        fontSize: "9px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#aaaaaa",
        margin: "0 0 28px 0",
      }}>
        Set your username to claim this profile
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
            placeholder="your_username"
            maxLength={30}
            required
            autoFocus
            autoComplete="off"
            style={inputStyle}
          />
          <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cccccc", margin: "6px 0 0", letterSpacing: "0.03em" }}>
            rekodo.co/@{value || "username"}
          </p>
        </div>

        {error && (
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{
            fontFamily: MONO,
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#ffffff",
            background: pending ? "rgba(204,85,0,0.6)" : ORANGE,
            border: "none",
            cursor: pending ? "default" : "pointer",
            padding: "14px 0",
            transition: "background 0.15s",
          }}
        >
          {pending ? "Saving…" : "Save username →"}
        </button>
      </form>
    </div>
  );
}
