"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveAvatarUrl, saveDisplayName, saveProfileSettings } from "./actions";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

interface Props {
  username:    string;
  displayName: string;
  location:    string;
  bio:         string;
  userId:      string;
  avatarUrl:   string | null;
}

export default function SettingsForm({ username, displayName, location, bio: initialBio, userId, avatarUrl: initialAvatarUrl }: Props) {
  // ── Avatar upload ─────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarSrc,     setAvatarSrc]     = useState<string | null>(initialAvatarUrl);
  const [avatarState,   setAvatarState]   = useState<"idle" | "uploading" | "error">("idle");
  const [avatarErrMsg,  setAvatarErrMsg]  = useState<string | null>(null);
  const displayInitial  = (displayName || username).charAt(0).toUpperCase();

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    // Reset so the same file can be re-selected after an error
    (e.target as HTMLInputElement).value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarState("error");
      setAvatarErrMsg("Please use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarState("error");
      setAvatarErrMsg("Image must be under 2MB.");
      return;
    }

    setAvatarState("uploading");
    setAvatarErrMsg(null);

    try {
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const urlWithBust = `${publicUrl}?v=${Date.now()}`;

      const result = await saveAvatarUrl(urlWithBust);
      if ("error" in result) throw new Error(result.error);

      setAvatarSrc(urlWithBust);
      setAvatarState("idle");
    } catch (err) {
      setAvatarState("error");
      setAvatarErrMsg(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  // ── Display name + location + bio — all saved via "Save changes" button ────
  const [nameValue, setNameValue] = useState(displayName);
  const [loc,     setLoc]     = useState(location);
  const [bio,     setBio]     = useState(initialBio);
  const [status,  setStatus]  = useState<"idle" | "saved" | "error">("idle");
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setErrMsg(null);
    startTransition(async () => {
      const [nameResult, profileResult] = await Promise.all([
        saveDisplayName(nameValue),
        saveProfileSettings(loc, bio),
      ]);
      const err = ("error" in nameResult ? nameResult.error : null)
               ?? ("error" in profileResult ? profileResult.error : null);
      if (err) {
        setStatus("error");
        setErrMsg(err);
      } else {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      }
    });
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: MONO, fontSize: "9px",
    letterSpacing: "0.14em", textTransform: "uppercase",
    color: "#aaaaaa", marginBottom: "8px",
  };
  const inputBase: React.CSSProperties = {
    width: "100%", fontFamily: MONO, fontSize: "15px",
    letterSpacing: "0.02em", color: "#0d0d0d",
    background: "transparent", border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.14)",
    outline: "none", padding: "8px 0 10px", boxSizing: "border-box",
  };
  const readonlyStyle: React.CSSProperties = {
    ...inputBase, color: "#aaaaaa", borderBottomStyle: "dashed", cursor: "default",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* Avatar upload */}
      <div>
        <label style={labelStyle}>Photo</label>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Clickable avatar circle */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarState === "uploading"}
            title="Click to upload a photo"
            style={{
              position: "relative", width: 64, height: 64, borderRadius: "50%",
              overflow: "hidden", border: "none", padding: 0,
              cursor: avatarState === "uploading" ? "default" : "pointer",
              flexShrink: 0, background: ORANGE,
            }}
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", height: "100%",
                fontFamily: MONO, fontSize: "22px", fontWeight: 600,
                color: "#ffffff", textTransform: "uppercase",
              }}>
                {displayInitial}
              </span>
            )}
            {/* Hover overlay */}
            <span style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
              opacity: avatarState === "uploading" ? 1 : 0,
              transition: "opacity 0.15s",
              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#ffffff",
            }}
              className="avatar-overlay"
            >
              {avatarState === "uploading" ? "Uploading…" : "Change"}
            </span>
          </button>

          <div>
            <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 4px 0" }}>
              JPG, PNG, or WebP · max 2MB
            </p>
            {avatarState === "error" && avatarErrMsg && (
              <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: 0 }}>{avatarErrMsg}</p>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarFile}
          style={{ display: "none" }}
        />
      </div>

      {/* Username — read-only */}
      <div>
        <label style={labelStyle}>Username</label>
        <input
          type="text"
          value={username}
          readOnly
          tabIndex={-1}
          style={readonlyStyle}
        />
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#cccccc", margin: "6px 0 0" }}>
          Your username cannot be changed as it affects your public URL ·{" "}
          <a
            href={`/@${username}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: ORANGE, textDecoration: "none" }}
          >
            rekodo.co/@{username} ↗
          </a>
        </p>
      </div>

      {/* Display name */}
      <div>
        <label style={labelStyle}>Display name</label>
        <input
          type="text"
          value={nameValue}
          onChange={e => { setNameValue(e.target.value); setStatus("idle"); }}
          placeholder="Your name"
          maxLength={60}
          autoComplete="off"
          style={inputBase}
        />
      </div>

      {/* Location */}
      <div>
        <label style={labelStyle}>
          Location
          <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>optional</span>
        </label>
        <input
          type="text"
          value={loc}
          onChange={e => { setLoc(e.target.value); setStatus("idle"); }}
          placeholder="Sydney, AU"
          maxLength={60}
          autoComplete="off"
          style={inputBase}
        />
      </div>

      {/* Bio */}
      <div>
        <label style={labelStyle}>
          Taste essay
          <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>optional · 160 chars</span>
        </label>
        <textarea
          value={bio}
          onChange={e => { setBio(e.target.value.slice(0, 160)); setStatus("idle"); }}
          placeholder="How would you describe your taste in music?"
          rows={4}
          style={{
            ...inputBase,
            border: "none",
            borderBottom: "1px solid rgba(0,0,0,0.14)",
            resize: "none",
            lineHeight: 1.6,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "14px",
          }}
        />
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: bio.length >= 140 ? ORANGE : "#dddddd", margin: "5px 0 0", textAlign: "right" }}>
          {bio.length} / 160
        </p>
      </div>

      {status === "error" && errMsg && (
        <p style={{ fontFamily: MONO, fontSize: "11px", color: "#cc3300", margin: 0 }}>{errMsg}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingTop: "8px" }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#ffffff",
            background: pending ? "rgba(204,85,0,0.6)" : ORANGE,
            border: "none", cursor: pending ? "default" : "pointer",
            padding: "13px 28px", transition: "background 0.15s",
          }}
        >
          {pending ? "Saving..." : "Save changes"}
        </button>

        {status === "saved" && (
          <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa" }}>
            Saved ✓
          </span>
        )}
      </div>

    </form>
  );
}
