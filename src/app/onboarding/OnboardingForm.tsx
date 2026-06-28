"use client";

import { useState, useTransition, useRef } from "react";
import { COUNTRIES } from "@/lib/countries";
import { STAR_SIGNS } from "@/lib/starSigns";
import { saveOnboardingProfile } from "./actions";
import { saveAvatarUrl } from "@/app/settings/profile/actions";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

interface Props {
  emailPrefix:        string;
  userId:             string;
  currentUsername:    string;
  currentDisplayName: string;
  currentCity:        string;
  currentCountry:     string;
  currentCountryCode: string;
}

export default function OnboardingForm({
  emailPrefix,
  userId,
  currentUsername,
  currentDisplayName,
  currentCity,
  currentCountry,
  currentCountryCode,
}: Props) {
  const [username,        setUsername]        = useState(currentUsername);
  const [displayName,     setDisplayName]     = useState(currentDisplayName);
  const [city,            setCity]            = useState(currentCity);
  const [countryCode,     setCountryCode]     = useState(currentCountryCode);
  const [country,         setCountry]         = useState(currentCountry);
  const [starSign,        setStarSign]        = useState("");
  const [bandcamp,        setBandcamp]        = useState("");
  const [tasteEssay,      setTasteEssay]      = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  const fileInputRef                          = useRef<HTMLInputElement>(null);
  const [avatarSrc,       setAvatarSrc]       = useState<string | null>(null);
  const [avatarHover,     setAvatarHover]     = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError,     setAvatarError]     = useState<string | null>(null);

  const displayInitial = (displayName || emailPrefix)[0]?.toUpperCase() ?? "?";

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Please use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2 MB.");
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const supabase = createClient();
      const path     = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const urlWithBust = `${publicUrl}?v=${Date.now()}`;
      const result = await saveAvatarUrl(urlWithBust);
      if ("error" in result) throw new Error(result.error);
      setAvatarSrc(urlWithBust);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  }

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
      const result = await saveOnboardingProfile(
        username, displayName, city, country, countryCode,
        starSign, bandcamp, tasteEssay,
      );
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

        <form onSubmit={handleSubmit} className="rk-onboard-form" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              style={{
                position: "relative", width: 80, height: 80, borderRadius: "50%", overflow: "hidden",
                border: avatarSrc ? `2px solid ${avatarHover ? ORANGE : "#e0e0da"}` : `2px dashed ${ORANGE}`,
                padding: 0, cursor: avatarUploading ? "default" : "pointer",
                background: ORANGE, display: "block", transition: "border-color 0.15s",
              }}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontFamily: MONO, fontSize: "26px", fontWeight: 600, color: "#ffffff" }}>
                  {displayInitial}
                </span>
              )}
              <span style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.45)",
                opacity: avatarUploading ? 1 : avatarSrc ? (avatarHover ? 1 : 0) : (avatarHover ? 1 : 0.75),
                transition: "opacity 0.15s", fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff",
              }}>
                {avatarUploading ? "…" : avatarSrc ? "Change" : "+ Photo"}
              </span>
            </button>
            <div style={{ textAlign: "center" }}>
              <p
                onClick={() => !avatarUploading && fileInputRef.current?.click()}
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: avatarSrc ? "#aaaaaa" : ORANGE, margin: 0, cursor: "pointer" }}
              >
                {avatarSrc ? "Change photo" : "Add a profile photo"}
              </p>
              {avatarError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "4px 0 0" }}>{avatarError}</p>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} style={{ display: "none" }} />
          </div>

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

          {/* Star sign */}
          <div>
            <label style={label}>Star sign <span style={{ color: "#cccccc" }}>(optional)</span></label>
            <div style={{ position: "relative" }}>
              <select
                value={starSign}
                onChange={e => setStarSign(e.target.value)}
                style={{
                  ...input,
                  appearance: "none",
                  paddingRight: "20px",
                  cursor: "pointer",
                  color: starSign ? "#0d0d0d" : "#aaaaaa",
                }}
              >
                <option value="">Select star sign</option>
                {STAR_SIGNS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span style={{
                position: "absolute", right: "2px", bottom: "13px",
                fontFamily: MONO, fontSize: "9px", color: "#aaaaaa", pointerEvents: "none",
              }}>▾</span>
            </div>
          </div>

          {/* Bandcamp username */}
          <div>
            <label style={label}>Bandcamp username <span style={{ color: "#cccccc" }}>(optional)</span></label>
            <div style={{ display: "flex", alignItems: "baseline", borderBottom: "1px solid rgba(0,0,0,0.14)", paddingBottom: "10px" }}>
              <span style={{ fontFamily: MONO, fontSize: "13px", color: "#aaaaaa", whiteSpace: "nowrap", paddingTop: "8px" }}>bandcamp.com/</span>
              <input
                type="text"
                value={bandcamp}
                onChange={e => setBandcamp(e.target.value.replace(/\s/g, "").toLowerCase())}
                placeholder="yourname"
                maxLength={60}
                autoComplete="off"
                style={{ ...input, border: "none", borderBottom: "none", padding: "8px 0 0", flex: 1 }}
              />
            </div>
          </div>

          {/* Taste essay */}
          <div>
            <label style={label}>Taste essay <span style={{ color: "#cccccc" }}>(optional)</span></label>
            <textarea
              value={tasteEssay}
              onChange={e => setTasteEssay(e.target.value)}
              placeholder="How would you describe your taste in music?"
              maxLength={500}
              rows={4}
              style={{
                ...input,
                borderBottom: "1px solid rgba(0,0,0,0.14)",
                resize: "vertical",
                fontFamily: MONO,
                fontSize: "13px",
                lineHeight: 1.6,
                paddingTop: "8px",
              }}
            />
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: tasteEssay.length >= 450 ? ORANGE : "#dddddd", margin: "5px 0 0", textAlign: "right" }}>
              {tasteEssay.length} / 500
            </p>
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
