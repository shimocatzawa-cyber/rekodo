"use client";

import { useState, useTransition } from "react";
import { saveOnboardingProfile } from "./actions";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";
const ORANGE = "#CC5500";

interface Props {
  emailPrefix:        string;
  currentUsername:    string;
  currentDisplayName: string;
  currentLocation:    string;
}

export default function OnboardingForm({
  emailPrefix,
  currentUsername,
  currentDisplayName,
  currentLocation,
}: Props) {
  const [username,    setUsername]    = useState(currentUsername);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [location,    setLocation]    = useState(currentLocation);
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingProfile(username, displayName, location);
      if (result?.error) setError(result.error);
    });
  }

  const label: React.CSSProperties = {
    display: "block",
    fontFamily: MONO,
    fontSize: "9px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#aaaaaa",
    marginBottom: "8px",
  };
  const input: React.CSSProperties = {
    width: "100%",
    fontFamily: MONO,
    fontSize: "15px",
    letterSpacing: "0.02em",
    color: "#0d0d0d",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    padding: "8px 0 10px",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        <h1 style={{ fontFamily: SERIF, fontSize: "30px", fontWeight: 400, color: "#0d0d0d", lineHeight: 1.25, margin: "0 0 48px 0" }}>
          Who are you as a listener?
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

          {/* Username */}
          <div>
            <label style={label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder={emailPrefix}
              maxLength={30}
              required
              autoFocus
              autoComplete="off"
              style={input}
            />
            <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.04em", color: "#cccccc", margin: "6px 0 0" }}>
              rekodo.co/@{username || emailPrefix}
            </p>
          </div>

          {/* Display name */}
          <div>
            <label style={label}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              autoComplete="off"
              style={input}
            />
          </div>

          {/* Location */}
          <div>
            <label style={{ ...label }}>
              Location
              <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>optional</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Sydney, AU"
              maxLength={60}
              autoComplete="off"
              style={input}
            />
          </div>

          {error && (
            <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#ffffff",
              background: isPending ? "rgba(204,85,0,0.6)" : ORANGE,
              border: "none",
              cursor: isPending ? "default" : "pointer",
              padding: "14px 0",
              marginTop: "8px",
              transition: "background 0.15s",
            }}
          >
            {isPending ? "Saving..." : "Start listening →"}
          </button>

        </form>
      </div>
    </div>
  );
}
