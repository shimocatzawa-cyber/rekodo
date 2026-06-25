"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { STAR_SIGNS } from "@/lib/starSigns";
import { saveAvatarUrl, saveDisplayName, saveProfileSettings } from "@/app/settings/profile/actions";
import AppNav from "@/components/AppNav";
import CollectionPhotos from "@/app/p/[username]/CollectionPhotos";
import WantlistClient from "@/components/wantlist/WantlistClient";
import EssentialsWallModal from "@/components/insights/EssentialsWallModal";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  city: string | null;
  country: string | null;
  country_code: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_donor: boolean;
  taste_summary: string | null;
  star_sign: string | null;
  bandcamp_username: string | null;
  role: string | null;
  spotify_connected: boolean;
  spotify_display_name: string | null;
  spotify_product: string | null;
}

interface Props {
  profile:     ProfileData;
  isOwner:     boolean;
  isSupporter: boolean;
  totalRecords: number;
  topGenre: string | null;
  topCountry: string | null;
  topLabel: string | null;
  followerCount: number;
  followingCount: number;
  viewer?: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  collectionPhoto?: string | null;
  compatibility?: { score: number; label: string } | null;
  essentials?: { total: number; primaryGenre: string | null; primaryGenrePct: number; covers: { artist: string; album: string; coverUrl: string | null }[] } | null;
  bcSyncTotal?: number;
  bcSyncDuplicates?: number;
  bcSyncDate?: string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileClient({
  profile, isOwner, isSupporter,
  followerCount, followingCount, viewer,
  collectionPhoto = null,
  compatibility = null,
  essentials = null,
  bcSyncTotal = 0, bcSyncDuplicates = 0, bcSyncDate = null,
}: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [essentialsModalOpen, setEssentialsModalOpen] = useState(false);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarSrc,       setAvatarSrc]       = useState<string | null>(profile.avatar_url);
  const [avatarHover,     setAvatarHover]     = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError,     setAvatarError]     = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editing,   setEditing]   = useState(false);
  const [saving,    startSaving]  = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [nameValue,     setNameValue]     = useState(profile.display_name     ?? "");
  const [cityValue,     setCityValue]     = useState(profile.city              ?? "");
  const [countryCode,   setCountryCode]   = useState(profile.country_code      ?? "");
  const [countryValue,  setCountryValue]  = useState(profile.country           ?? "");
  const [bioValue,      setBioValue]      = useState(profile.bio               ?? "");
  const [starSignValue, setStarSignValue] = useState(profile.star_sign         ?? "");
  const [bandcampValue, setBandcampValue] = useState(profile.bandcamp_username ?? "");

  // ── Bandcamp sync ─────────────────────────────────────────────────────────
  const [bcSyncing,    setBcSyncing]    = useState(false);
  const [bcError,      setBcError]      = useState<string | null>(null);
  const [bcResult,     setBcResult]     = useState<{ total: number; duplicates: number; date: string | null } | null>(
    bcSyncTotal > 0 ? { total: bcSyncTotal, duplicates: bcSyncDuplicates, date: bcSyncDate ?? null } : null
  );

  async function runBandcampSync() {
    setBcSyncing(true);
    setBcError(null);
    try {
      const res  = await fetch("/api/deep-dive/bandcamp-import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: profile.id }),
      });
      const json = await res.json() as { success?: boolean; error?: string; total?: number; duplicates?: number };
      if (!res.ok || json.error) {
        setBcError(json.error ?? "Sync failed. Please try again.");
      } else {
        setBcResult({ total: json.total ?? 0, duplicates: json.duplicates ?? 0, date: new Date().toISOString() as string | null });
      }
    } catch {
      setBcError("Network error. Please try again.");
    } finally {
      setBcSyncing(false);
    }
  }

  function formatSyncDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  // ── Spotify ───────────────────────────────────────────────────────────────
  const spotifyError = searchParams.get("spotify_error") === "true";
  const [spotifyConnected,     setSpotifyConnected]     = useState(profile.spotify_connected);
  const [spotifyDisplayName,   setSpotifyDisplayName]   = useState(profile.spotify_display_name);
  const [spotifyProduct,       setSpotifyProduct]       = useState(profile.spotify_product);
  const [spotifyDisconnecting, setSpotifyDisconnecting] = useState(false);

  async function handleSpotifyDisconnect() {
    setSpotifyDisconnecting(true);
    try {
      await fetch("/api/auth/spotify/disconnect", { method: "POST" });
      setSpotifyConnected(false);
      setSpotifyDisplayName(null);
      setSpotifyProduct(null);
    } finally {
      setSpotifyDisconnecting(false);
    }
  }

  // ── Delete account ───────────────────────────────────────────────────────
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [deleteError,      setDeleteError]      = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setDeleteError(data.error ?? "Failed to delete account.");
        setDeleting(false);
        return;
      }
      router.push("/");
    } catch {
      setDeleteError("Failed to delete account.");
      setDeleting(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function openEdit() {
    setNameValue(profile.display_name     ?? "");
    setCityValue(profile.city             ?? "");
    setCountryCode(profile.country_code   ?? "");
    setCountryValue(profile.country       ?? "");
    setBioValue(profile.bio               ?? "");
    setStarSignValue(profile.star_sign    ?? "");
    setBandcampValue(profile.bandcamp_username ?? "");
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setNameValue(profile.display_name     ?? "");
    setCityValue(profile.city             ?? "");
    setCountryCode(profile.country_code   ?? "");
    setCountryValue(profile.country       ?? "");
    setBioValue(profile.bio               ?? "");
    setStarSignValue(profile.star_sign    ?? "");
    setBandcampValue(profile.bandcamp_username ?? "");
    setSaveError(null);
    setEditing(false);
  }

  function handleSave() {
    setSaveError(null);
    startSaving(async () => {
      const [nameResult, profileResult] = await Promise.all([
        saveDisplayName(nameValue),
        saveProfileSettings(cityValue, countryValue, countryCode, bioValue, starSignValue, bandcampValue),
      ]);
      const err = ("error" in nameResult ? nameResult.error : null)
               ?? ("error" in profileResult ? profileResult.error : null);
      if (err) { setSaveError(err); return; }
      setEditing(false);
      router.refresh();
    });
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Please use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2MB.");
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const supabase = createClient();
      const path     = `${profile.id}/avatar.jpg`;
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

  const displayName    = nameValue || profile.username;
  const displayInitial = displayName.charAt(0).toUpperCase();

  // ── Shared styles ─────────────────────────────────────────────────────────
  const labelSt: React.CSSProperties = {
    display: "block", fontFamily: MONO, fontSize: "9px",
    letterSpacing: "0.14em", textTransform: "uppercase",
    color: MUTED, marginBottom: "8px",
  };
  const inputSt: React.CSSProperties = {
    width: "100%", fontFamily: MONO, fontSize: "14px",
    letterSpacing: "0.02em", color: INK,
    background: "transparent", border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.14)",
    outline: "none", padding: "8px 0 10px", boxSizing: "border-box",
  };
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      {viewer && (
        <AppNav
          username={viewer.username}
          displayLabel={viewer.displayName ?? undefined}
          avatarUrl={viewer.avatarUrl}
        />
      )}


      {/* ─────────────── PROFILE ────────────────────────────────────────────── */}
      <main className="rk-profile-main" style={{ padding: "3rem 3.5rem", maxWidth: 860, margin: "0 auto", minWidth: 0, width: "100%" }}>

          {/* Identity block */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>

              {/* Avatar */}
              {isOwner ? (
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    onMouseEnter={() => setAvatarHover(true)}
                    onMouseLeave={() => setAvatarHover(false)}
                    title="Change photo"
                    style={{ position: "relative", width: 64, height: 64, borderRadius: "50%", overflow: "hidden", border: "none", padding: 0, cursor: avatarUploading ? "default" : "pointer", background: ORANGE, display: "block" }}
                  >
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontFamily: MONO, fontSize: "22px", fontWeight: 600, color: "#ffffff" }}>
                        {displayInitial}
                      </span>
                    )}
                    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", opacity: (avatarHover || avatarUploading) ? 1 : 0, transition: "opacity 0.15s", fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff" }}>
                      {avatarUploading ? "…" : "Change"}
                    </span>
                  </button>
                  {avatarError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "6px 0 0" }}>{avatarError}</p>}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} style={{ display: "none" }} />
                </div>
              ) : (
                avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "22px", fontWeight: 600, color: "#ffffff" }}>
                    {displayInitial}
                  </div>
                )
              )}

              {/* Edit — owner only, not while editing */}
              {isOwner && !editing && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end", flexShrink: 0 }}>
                  <button onClick={openEdit} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Edit profile
                  </button>
                  <button onClick={async () => { await createClient().auth.signOut(); router.push("/login"); }} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* ── DISPLAY MODE ── */}
            {!editing && (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", margin: "0 0 8px 0", flexWrap: "wrap" }}>
                  <h1 style={{ fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400, color: INK, lineHeight: 1.1, margin: 0 }}>
                    {displayName}
                  </h1>
                  {(profile.is_donor || profile.role === "admin") && (
                    <span style={{ fontFamily: SERIF, fontSize: "clamp(16px, 2.5vw, 24px)", fontWeight: 400, color: "#B8860B", lineHeight: 1.1 }} title="rekōdo supporter">ō</span>
                  )}
                </div>

                {(bioValue || profile.bio) && (
                  <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontStyle: "italic", color: "#505050", lineHeight: 1.7, margin: "0 0 12px 0", maxWidth: 560 }}>
                    {bioValue || profile.bio}
                  </p>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px 0" }}>
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: 0 }}>
                    @{profile.username}
                  </p>
                  {profile.role === "admin" && (
                    <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, border: `1px solid ${ORANGE}`, padding: "3px 7px", lineHeight: 1, whiteSpace: "nowrap" }}>
                      Admin
                    </span>
                  )}
                </div>

                {(followerCount > 0 || followingCount > 0) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 12px 0" }}>
                    {followerCount > 0 && <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>}
                    {followerCount > 0 && followingCount > 0 && <span style={{ margin: "0 8px" }}>·</span>}
                    {followingCount > 0 && <span>following {followingCount}</span>}
                  </p>
                )}

                {!isOwner && compatibility && (
                  <div style={{ margin: "0 0 12px 0" }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", color: ORANGE }}>
                      {compatibility.score}% Collection Similarity
                    </span>
                    <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.9rem", color: "#505050", lineHeight: 1.4, margin: "4px 0 0" }}>
                      {compatibility.label}
                    </p>
                  </div>
                )}

                {(cityValue || countryValue) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 12px 0" }}>
                    {[cityValue || profile.city, countryValue || profile.country].filter(Boolean).join(", ")}
                  </p>
                )}

                {(starSignValue || profile.star_sign) && (() => {
                  const sign = starSignValue || profile.star_sign!;
                  const SIGN_SVG: Record<string, string> = {
                    Aries:       "https://upload.wikimedia.org/wikipedia/commons/0/00/Aries_symbol_%28fixed_width%29.svg",
                    Taurus:      "https://upload.wikimedia.org/wikipedia/commons/0/0b/Taurus_symbol_%28fixed_width%29.svg",
                    Gemini:      "https://upload.wikimedia.org/wikipedia/commons/0/0c/Gemini_symbol_%28fixed_width%29.svg",
                    Cancer:      "https://upload.wikimedia.org/wikipedia/commons/e/ec/Cancer_symbol_%28fixed_width%29.svg",
                    Leo:         "https://upload.wikimedia.org/wikipedia/commons/2/2c/Leo_symbol_%28fixed_width%29.svg",
                    Virgo:       "https://upload.wikimedia.org/wikipedia/commons/a/a8/Virgo_symbol_%28fixed_width%29.svg",
                    Libra:       "https://upload.wikimedia.org/wikipedia/commons/0/07/Libra_symbol_%28fixed_width%29.svg",
                    Scorpio:     "https://upload.wikimedia.org/wikipedia/commons/7/7c/Scorpius_symbol_%28fixed_width%29.svg",
                    Sagittarius: "https://upload.wikimedia.org/wikipedia/commons/5/52/Sagittarius_symbol_%28fixed_width%29.svg",
                    Capricorn:   "https://upload.wikimedia.org/wikipedia/commons/a/a9/Capricornus_symbol_%28fixed_width%29.svg",
                    Aquarius:    "https://upload.wikimedia.org/wikipedia/commons/f/fd/Aquarius_symbol_%28fixed_width%29.svg",
                    Pisces:      "https://upload.wikimedia.org/wikipedia/commons/2/21/Pisces_symbol_%28fixed_width%29.svg",
                  };
                  return (
                    <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      {SIGN_SVG[sign] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={SIGN_SVG[sign]} alt={sign} style={{ height: "18px", width: "auto", opacity: 0.5 }} />
                      )}
                      {sign}
                    </p>
                  );
                })()}

                {!isOwner && (bandcampValue || profile.bandcamp_username) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: 0, overflowWrap: "anywhere" }}>
                    bandcamp.com/{bandcampValue || profile.bandcamp_username}
                  </p>
                )}

                {/* ── Collection photo ── */}
                {/* CollectionPhotos self-guards (returns null for non-owners with no photo set) */}
                <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                  <CollectionPhotos initialPhoto={collectionPhoto} isOwner={isOwner} />
                </div>

                {/* ── Essentials wall ── */}
                {essentials && essentials.total > 0 && (
                  <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                    <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 10px 0" }}>
                      Essentials Wall
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: "3px", maxWidth: 360, marginBottom: "10px" }}>
                      {essentials.covers.slice(0, 9).map((c, i) => (
                        <div key={i} style={{ aspectRatio: "1 / 1", background: "#f0ede8", overflow: "hidden" }}>
                          {c.coverUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setEssentialsModalOpen(true)}
                      style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      View Essentials Wall →
                    </button>
                    {essentialsModalOpen && (
                      <EssentialsWallModal
                        onClose={() => setEssentialsModalOpen(false)}
                        username={profile.username}
                        covers={essentials.covers}
                        total={essentials.total}
                        primaryGenre={essentials.primaryGenre}
                        primaryGenrePct={essentials.primaryGenrePct}
                      />
                    )}
                  </div>
                )}

                {/* ── SPOTIFY + BANDCAMP + WANTLIST ── */}
                {isOwner && (
                  <div style={{ marginTop: "0", paddingTop: "16px", borderTop: `1px solid ${RULE}`, display: "flex", gap: "0", alignItems: "flex-start" }}>

                    {/* Spotify */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 10px 0" }}>
                        Spotify
                      </p>

                      {spotifyError && (
                        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#9a1f1f", margin: "0 0 8px 0" }}>
                          Connection failed. Please try again.
                        </p>
                      )}

                      {spotifyConnected ? (
                        <>
                          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#0a0a0a", margin: "0 0 2px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1DB954", flexShrink: 0, display: "inline-block" }} />
                            {spotifyDisplayName ?? "Connected"}
                          </p>
                          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 10px 0" }}>
                            {spotifyProduct === "premium" ? "Premium account" : "Free account"}
                          </p>
                          <button
                            onClick={spotifyDisconnecting ? undefined : handleSpotifyDisconnect}
                            disabled={spotifyDisconnecting}
                            style={{
                              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                              color: spotifyDisconnecting ? "#aaaaaa" : "#0a0a0a", background: "transparent",
                              border: `1px solid ${spotifyDisconnecting ? "#dddddd" : RULE}`,
                              padding: "5px 12px", cursor: spotifyDisconnecting ? "default" : "pointer",
                            }}
                            onMouseEnter={e => { if (!spotifyDisconnecting) { (e.currentTarget as HTMLButtonElement).style.color = "#9a1f1f"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#9a1f1f"; }}}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0a0a0a"; (e.currentTarget as HTMLButtonElement).style.borderColor = RULE; }}
                          >
                            {spotifyDisconnecting ? "Disconnecting…" : "Disconnect"}
                          </button>
                        </>
                      ) : (
                        <>
                          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 10px 0", lineHeight: 1.6 }}>
                            Connect Spotify to enable playback on your Collection and Dig pages.
                          </p>
                          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /api/auth/spotify is an OAuth-kickoff route, not a page; needs a real navigation, not client-side routing */}
                          <a
                            href="/api/auth/spotify"
                            style={{
                              fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                              color: "#0a0a0a", border: `1px solid ${RULE}`, padding: "5px 12px",
                              textDecoration: "none", display: "inline-block",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = ORANGE; (e.currentTarget as HTMLAnchorElement).style.borderColor = ORANGE; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#0a0a0a"; (e.currentTarget as HTMLAnchorElement).style.borderColor = RULE; }}
                          >
                            Connect Spotify →
                          </a>
                        </>
                      )}
                    </div>

                    {/* Divider */}
                    <div style={{ width: "1px", background: RULE, alignSelf: "stretch", margin: "0 16px", flexShrink: 0 }} />

                    {/* Bandcamp */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 10px 0" }}>
                        Bandcamp
                      </p>

                      {(bandcampValue || profile.bandcamp_username) ? (
                        <>
                          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#0a0a0a", margin: "0 0 6px 0", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1DA0C3", flexShrink: 0, display: "inline-block" }} />
                            <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>bandcamp.com/{bandcampValue || profile.bandcamp_username}</span>
                          </p>
                          {bcResult && (
                            <>
                              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#0a0a0a", margin: "0 0 1px 0" }}>
                                ✓ {bcResult.total.toLocaleString()} albums · {bcResult.duplicates.toLocaleString()} already in your physical collection
                              </p>
                              {bcResult.date && (
                                <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 8px 0" }}>
                                  Last synced: {formatSyncDate(bcResult.date)}
                                </p>
                              )}
                            </>
                          )}
                          <div style={{ marginTop: bcResult ? 0 : "10px" }}>
                            <button
                              type="button"
                              onClick={bcSyncing ? undefined : runBandcampSync}
                              disabled={bcSyncing}
                              style={{
                                fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                                color: bcSyncing ? "#aaaaaa" : "#0a0a0a", background: "transparent",
                                border: `1px solid ${bcSyncing ? "#dddddd" : RULE}`,
                                padding: "5px 12px", cursor: bcSyncing ? "default" : "pointer",
                              }}
                              onMouseEnter={e => { if (!bcSyncing) { (e.currentTarget as HTMLButtonElement).style.color = ORANGE; (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0a0a0a"; (e.currentTarget as HTMLButtonElement).style.borderColor = RULE; }}
                            >
                              {bcSyncing ? "Syncing…" : bcResult ? "Re-sync →" : "Sync collection →"}
                            </button>
                            {bcError && (
                              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em", color: "#cc3300", margin: "6px 0 0" }}>
                                {bcError}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 10px 0", lineHeight: 1.6 }}>
                            Connect your Bandcamp to import your digital collection.
                          </p>
                          <button
                            onClick={openEdit}
                            style={{
                            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#0a0a0a",
                            border: `1px solid ${RULE}`,
                            padding: "5px 12px",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = ORANGE; (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0a0a0a"; (e.currentTarget as HTMLButtonElement).style.borderColor = RULE; }}
                        >
                          Add username in settings →
                        </button>
                      </>
                    )}
                    </div>

                    {/* Divider */}
                    <div style={{ width: "1px", background: RULE, alignSelf: "stretch", margin: "0 16px", flexShrink: 0 }} />

                    {/* Wantlist */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <WantlistClient isOwner={true} isSupporter={isSupporter} userId={profile.id} embedded />
                    </div>

                  </div>
                )}

              </>
            )}

            {/* ── EDIT MODE ── */}
            {editing && (
              <div style={{ maxWidth: 520 }}>
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelSt}>Display name</label>
                  <input type="text" value={nameValue} onChange={e => setNameValue(e.target.value)} placeholder="Your name" maxLength={60} autoComplete="off" autoFocus style={inputSt} />
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelSt}>City <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>required for Gigs</span></label>
                  <input type="text" value={cityValue} onChange={e => setCityValue(e.target.value)} placeholder="Sydney" maxLength={80} autoComplete="off" style={inputSt} />
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelSt}>Country</label>
                  <div style={{ position: "relative" }}>
                    <select value={countryCode} onChange={e => { const code = e.target.value; const found = COUNTRIES.find(c => c.code === code); setCountryCode(code); setCountryValue(found?.name ?? ""); }} style={{ ...inputSt, appearance: "none", paddingRight: "20px", cursor: "pointer" }}>
                      <option value="" disabled>Select country</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <span style={{ position: "absolute", right: "2px", bottom: "13px", fontFamily: MONO, fontSize: "9px", color: MUTED, pointerEvents: "none" }}>▾</span>
                  </div>
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelSt}>Star sign</label>
                  <div style={{ position: "relative" }}>
                    <select value={starSignValue} onChange={e => setStarSignValue(e.target.value)} style={{ ...inputSt, appearance: "none", paddingRight: "20px", cursor: "pointer" }}>
                      <option value="">Select star sign</option>
                      {STAR_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span style={{ position: "absolute", right: "2px", bottom: "13px", fontFamily: MONO, fontSize: "9px", color: MUTED, pointerEvents: "none" }}>▾</span>
                  </div>
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ ...labelSt, color: ORANGE }}>Bandcamp</label>
                  <input type="text" value={bandcampValue} onChange={e => setBandcampValue(e.target.value.trim().toLowerCase())} placeholder="your-username" maxLength={80} autoComplete="off" style={inputSt} />
                  <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: INK, margin: "5px 0 0" }}>bandcamp.com/your-username — must be set to public</p>
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelSt}>Taste Statement <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>optional · 160 chars</span></label>
                  <textarea value={bioValue} onChange={e => setBioValue(e.target.value.slice(0, 160))} placeholder="How would you describe your taste in music?" rows={4}
                    style={{ ...inputSt, border: "none", borderBottom: "1px solid rgba(0,0,0,0.14)", resize: "none", lineHeight: 1.6, fontFamily: SERIF, fontStyle: "italic", fontSize: "14px" }} />
                  <p style={{ fontFamily: MONO, fontSize: "9px", color: bioValue.length >= 140 ? ORANGE : "#dddddd", margin: "4px 0 0", textAlign: "right" }}>
                    {bioValue.length} / 160
                  </p>
                </div>
                {saveError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "0 0 12px 0" }}>{saveError}</p>}
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button onClick={handleSave} disabled={saving} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving ? "rgba(204,85,0,0.6)" : ORANGE, border: "none", cursor: saving ? "default" : "pointer", padding: "10px 20px" }}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button onClick={cancelEdit} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "10px 0" }}>
                    Cancel
                  </button>
                </div>

                <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: `1px solid ${RULE}` }}>
                  <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a1f1f", margin: "0 0 10px" }}>
                    Danger zone
                  </p>
                  {deleteError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "0 0 10px" }}>{deleteError}</p>}
                  {!deleteConfirming ? (
                    <button onClick={() => setDeleteConfirming(true)} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a1f1f", background: "none", border: "1px solid #9a1f1f", cursor: "pointer", padding: "8px 14px" }}>
                      Delete account
                    </button>
                  ) : (
                    <div>
                      <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, margin: "0 0 12px", maxWidth: "380px" }}>
                        This permanently deletes your collection, lists, and connections. There&rsquo;s no undo.
                      </p>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <button onClick={handleDeleteAccount} disabled={deleting} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: deleting ? "rgba(154,31,31,0.6)" : "#9a1f1f", border: "none", cursor: deleting ? "default" : "pointer", padding: "10px 20px" }}>
                          {deleting ? "Deleting…" : "Yes, delete everything"}
                        </button>
                        <button onClick={() => setDeleteConfirming(false)} disabled={deleting} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "10px 0" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </main>

    </div>
  );
}
