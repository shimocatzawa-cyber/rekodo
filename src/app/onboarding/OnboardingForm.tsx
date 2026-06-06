"use client";

import { useState, useTransition } from "react";
import { COUNTRIES } from "@/lib/countries";
import { saveOnboardingProfile } from "./actions";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";
const ORANGE = "#CC5500";

interface Props {
  emailPrefix:        string;
  currentUsername:    string;
  currentDisplayName: string;
  currentCity:        string;
  currentCountry:     string;
  currentCountryCode: string;
}

export default function OnboardingForm({
  emailPrefix,
  currentUsername,
  currentDisplayName,
  currentCity,
  currentCountry,
  currentCountryCode,
}: Props) {
  const [username,    setUsername]    = useState(currentUsername);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [city,        setCity]        = useState(currentCity);
  const [countryCode, setCountryCode] = useState(currentCountryCode);
  const [country,     setCountry]     = useState(currentCountry);
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    const found = COUNTRIES.find(c => c.code === code);
    setCountryCode(code);
    setCountry(found?.name ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingProfile(username, displayName, city, country, countryCode);
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

          {/* City */}
          <div>
            <label style={label}>City</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Sydney"
              maxLength={80}
              required
              autoComplete="off"
              style={input}
            />
          </div>

          {/* Country */}
          <div>
            <label style={label}>Country</label>
            <div style={{ position: "relative" }}>
              <select
                value={countryCode}
                onChange={handleCountryChange}
                required
                style={{
                  ...input,
                  appearance: "none",
                  paddingRight: "20px",
                  cursor: "pointer",
                  color: countryCode ? "#0d0d0d" : "#aaaaaa",
                }}
              >
                <option value="" disabled>Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <span style={{
                position: "absolute", right: "2px", bottom: "13px",
                fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", pointerEvents: "none",
              }}>▾</span>
            </div>
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
