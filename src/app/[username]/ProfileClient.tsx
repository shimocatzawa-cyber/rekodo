"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { STAR_SIGNS } from "@/lib/starSigns";
import { saveAvatarUrl, saveDisplayName, saveProfileSettings } from "@/app/settings/profile/actions";
import { generateTasteSummary } from "./actions";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";

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
}

export interface ListRow {
  id: string;
  title: string;
  slug: string;
  list_type: string;
}

export interface ListItemRow {
  list_id: string;
  position: number;
  item_type: string;
  record_id: string | null;
  song_cover_url: string | null;
  song_artist: string | null;
  song_album: string | null;
}

export interface CoverRecord {
  id: string;
  cover_url: string | null;
  artist: string | null;
  album: string | null;
}

interface Props {
  profile: ProfileData;
  isOwner: boolean;
  totalRecords: number;
  topGenre: string | null;
  topCountry: string | null;
  topLabel: string | null;
  lists: ListRow[];
  listItems: ListItemRow[];
  coverRecords: CoverRecord[];
  followerCount: number;
  followingCount: number;
}

export default function ProfileClient({
  profile, isOwner, totalRecords, topGenre, topCountry, topLabel,
  lists, listItems, coverRecords, followerCount, followingCount,
}: Props) {
  const router = useRouter();

  // ── Avatar ────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarSrc,       setAvatarSrc]       = useState<string | null>(profile.avatar_url);
  const [avatarHover,     setAvatarHover]     = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError,     setAvatarError]     = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  // "details" covers city/country/bio/star_sign together (saveProfileSettings requires city+country)
  const [editingSection, setEditingSection] = useState<"name" | "details" | null>(null);
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [nameValue,    setNameValue]    = useState(profile.display_name ?? "");
  const [cityValue,    setCityValue]    = useState(profile.city ?? "");
  const [countryCode,  setCountryCode]  = useState(profile.country_code ?? "");
  const [countryValue, setCountryValue] = useState(profile.country ?? "");
  const [bioValue,     setBioValue]     = useState(profile.bio ?? "");
  const [starSignValue,setStarSignValue]= useState(profile.star_sign ?? "");

  // ── Taste summary ─────────────────────────────────────────────────────────
  const [summaryPending, startSummaryTransition] = useTransition();
  const [summaryError,   setSummaryError]        = useState<string | null>(null);

  // ── Share ─────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function cancelEdit() {
    setNameValue(profile.display_name ?? "");
    setCityValue(profile.city ?? "");
    setCountryCode(profile.country_code ?? "");
    setCountryValue(profile.country ?? "");
    setBioValue(profile.bio ?? "");
    setStarSignValue(profile.star_sign ?? "");
    setEditingSection(null);
    setSaveError(null);
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
      const path = `${profile.id}/avatar.jpg`;
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

  function handleSaveName() {
    setSaveError(null);
    startSaving(async () => {
      const result = await saveDisplayName(nameValue);
      if ("error" in result) { setSaveError(result.error); return; }
      setEditingSection(null);
      router.refresh();
    });
  }

  function handleSaveDetails() {
    setSaveError(null);
    startSaving(async () => {
      const result = await saveProfileSettings(cityValue, countryValue, countryCode, bioValue, starSignValue);
      if ("error" in result) { setSaveError(result.error); return; }
      setEditingSection(null);
      router.refresh();
    });
  }

  function handleGenerateSummary() {
    setSummaryError(null);
    startSummaryTransition(async () => {
      const result = await generateTasteSummary(profile.id);
      if ("error" in result) { setSummaryError(result.error); return; }
      router.refresh();
    });
  }

  function handleShare() {
    try {
      navigator.clipboard.writeText(`${window.location.origin}/@${profile.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* non-fatal */ }
  }

  // ── List data ─────────────────────────────────────────────────────────────
  const coverById    = new Map(coverRecords.map(r => [r.id, r]));
  const itemsByList  = new Map<string, ListItemRow[]>(lists.map(l => [l.id, []]));
  for (const item of listItems) itemsByList.get(item.list_id)?.push(item);

  const displayName    = nameValue || profile.username;
  const displayInitial = displayName.charAt(0).toUpperCase();
  const hasLocation    = Boolean(cityValue || countryValue);
  const hasBio         = Boolean(bioValue);
  const hasSummary     = Boolean(profile.taste_summary);

  // ── Shared styles ─────────────────────────────────────────────────────────
  const labelSt: React.CSSProperties = {
    display: "block", fontFamily: MONO, fontSize: "9px",
    letterSpacing: "0.14em", textTransform: "uppercase",
    color: MUTED, marginBottom: "8px",
  };
  const inputSt: React.CSSProperties = {
    width: "100%", fontFamily: MONO, fontSize: "15px",
    letterSpacing: "0.02em", color: INK,
    background: "transparent", border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.14)",
    outline: "none", padding: "8px 0 10px", boxSizing: "border-box",
  };
  const saveCancelRow: React.CSSProperties = {
    display: "flex", gap: "12px", alignItems: "center", marginTop: "12px",
  };
  const saveBtnSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em",
    textTransform: "uppercase", color: "#fff",
    background: saving ? "rgba(204,85,0,0.6)" : ORANGE,
    border: "none", cursor: saving ? "default" : "pointer",
    padding: "8px 16px",
  };
  const cancelBtnSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em",
    textTransform: "uppercase", color: MUTED,
    background: "none", border: "none", cursor: "pointer", padding: "8px 0",
  };
  const pencilSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "10px", color: MUTED,
    background: "none", border: "none", cursor: "pointer",
    padding: "0 0 0 6px", opacity: 0.45, lineHeight: 1,
  };
  const eyebrowSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em",
    textTransform: "uppercase", color: ORANGE, margin: "0 0 20px 0",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: `1px solid ${RULE}`,
        padding: "2rem 1.5rem",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        <Link href="/collection" style={{
          fontFamily: SERIF, fontSize: "1rem", fontWeight: 700,
          color: ORANGE, textDecoration: "none", letterSpacing: "-0.01em",
        }}>
          rekōdo
        </Link>

        <nav style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {/* Profile — always active */}
          <div style={{ padding: "4px 0" }}>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE }}>
              Profile
            </span>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", color: ORANGE, marginTop: "0.1rem" }}>
              プロフィール
            </span>
          </div>

          {/* Lists */}
          <Link href="/lists" style={{ textDecoration: "none", padding: "4px 0", display: "block" }}>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, opacity: 0.5 }}>
              Lists
            </span>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", color: INK, opacity: 0.5, marginTop: "0.1rem" }}>
              リスト
            </span>
          </Link>

          {/* Community — coming soon */}
          <div style={{ padding: "4px 0" }}>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, opacity: 0.3 }}>
              Community
            </span>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", color: INK, opacity: 0.3, marginTop: "0.1rem" }}>
              コミュニティ
            </span>
            <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: INK, opacity: 0.3, marginTop: "2px" }}>
              Coming soon
            </span>
          </div>
        </nav>

        {isOwner && (
          <div style={{ marginTop: "auto" }}>
            <button onClick={handleShare} style={{
              fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.08em",
              color: copied ? MUTED : ORANGE, background: "none", border: "none",
              cursor: "pointer", padding: 0,
            }}>
              {copied ? "Copied ✓" : "Share profile ↗"}
            </button>
          </div>
        )}
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "3rem 3.5rem", maxWidth: 860 }}>

        {/* ── Avatar ── */}
        <div style={{ marginBottom: "20px" }}>
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                title="Change photo"
                style={{
                  position: "relative", width: 64, height: 64, borderRadius: "50%",
                  overflow: "hidden", border: "none", padding: 0,
                  cursor: avatarUploading ? "default" : "pointer",
                  background: ORANGE, display: "block",
                }}
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontFamily: MONO, fontSize: "22px", fontWeight: 600, color: "#ffffff" }}>
                    {displayInitial}
                  </span>
                )}
                <span style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.35)",
                  opacity: (avatarHover || avatarUploading) ? 1 : 0, transition: "opacity 0.15s",
                  fontFamily: MONO, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff",
                }}>
                  {avatarUploading ? "…" : "Change"}
                </span>
              </button>
              {avatarError && (
                <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "6px 0 0" }}>{avatarError}</p>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} style={{ display: "none" }} />
            </>
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
        </div>

        {/* ── Display name ── */}
        {editingSection === "name" ? (
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Display name</label>
            <input
              type="text" value={nameValue} onChange={e => setNameValue(e.target.value)}
              placeholder="Your name" maxLength={60} autoComplete="off" autoFocus style={inputSt}
            />
            <div style={saveCancelRow}>
              <button onClick={handleSaveName} disabled={saving} style={saveBtnSt}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={cancelEdit} style={cancelBtnSt}>Cancel</button>
              {saveError && <span style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300" }}>{saveError}</span>}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: "12px" }}>
            <h1 style={{ fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400, color: INK, lineHeight: 1.1, margin: 0 }}>
              {displayName}
            </h1>
            {isOwner && (
              <button onClick={() => { cancelEdit(); setEditingSection("name"); }} style={pencilSt} title="Edit name">✎</button>
            )}
          </div>
        )}

        {/* ── Handle + donor badge ── */}
        <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: MUTED, margin: "0 0 6px 0", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>@{profile.username}</span>
          {profile.is_donor && (
            <span style={{ fontFamily: SERIF, fontSize: "0.75rem", color: "#B8860B" }} title="rekōdo supporter">ō</span>
          )}
        </p>

        {/* ── Follower counts ── */}
        {(followerCount > 0 || followingCount > 0) && (
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.05em", color: "#cccccc", margin: "0 0 12px 0" }}>
            {followerCount > 0 && <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>}
            {followerCount > 0 && followingCount > 0 && <span style={{ margin: "0 8px" }}>·</span>}
            {followingCount > 0 && <span>following {followingCount}</span>}
          </p>
        )}

        {/* ── Location + bio + star sign (combined edit section) ── */}
        {editingSection === "details" ? (
          <div style={{ marginBottom: "24px", maxWidth: 520 }}>
            <div style={{ marginBottom: "20px" }}>
              <label style={labelSt}>
                City
                <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>required for Gigs</span>
              </label>
              <input
                type="text" value={cityValue} onChange={e => setCityValue(e.target.value)}
                placeholder="Sydney" maxLength={80} autoComplete="off" autoFocus style={inputSt}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={labelSt}>Country</label>
              <div style={{ position: "relative" }}>
                <select
                  value={countryCode}
                  onChange={e => {
                    const code = e.target.value;
                    const found = COUNTRIES.find(c => c.code === code);
                    setCountryCode(code);
                    setCountryValue(found?.name ?? "");
                  }}
                  style={{ ...inputSt, appearance: "none", paddingRight: "20px", cursor: "pointer" }}
                >
                  <option value="" disabled>Select country</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                <span style={{ position: "absolute", right: "2px", bottom: "13px", fontFamily: MONO, fontSize: "9px", color: MUTED, pointerEvents: "none" }}>▾</span>
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={labelSt}>
                Taste essay
                <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>optional · 160 chars</span>
              </label>
              <textarea
                value={bioValue}
                onChange={e => setBioValue(e.target.value.slice(0, 160))}
                placeholder="How would you describe your taste in music?"
                rows={4}
                style={{ ...inputSt, border: "none", borderBottom: "1px solid rgba(0,0,0,0.14)", resize: "none", lineHeight: 1.6, fontFamily: SERIF, fontStyle: "italic", fontSize: "14px" }}
              />
              <p style={{ fontFamily: MONO, fontSize: "9px", color: bioValue.length >= 140 ? ORANGE : "#dddddd", margin: "5px 0 0", textAlign: "right" }}>
                {bioValue.length} / 160
              </p>
            </div>
            <div style={{ marginBottom: "4px" }}>
              <label style={labelSt}>Star sign</label>
              <div style={{ position: "relative" }}>
                <select
                  value={starSignValue}
                  onChange={e => setStarSignValue(e.target.value)}
                  style={{ ...inputSt, appearance: "none", paddingRight: "20px", cursor: "pointer" }}
                >
                  <option value="">Select star sign</option>
                  {STAR_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: "2px", bottom: "13px", fontFamily: MONO, fontSize: "9px", color: MUTED, pointerEvents: "none" }}>▾</span>
              </div>
            </div>
            <div style={saveCancelRow}>
              <button onClick={handleSaveDetails} disabled={saving} style={saveBtnSt}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={cancelEdit} style={cancelBtnSt}>Cancel</button>
              {saveError && <span style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300" }}>{saveError}</span>}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: "24px" }}>
            {/* Location display */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: "10px" }}>
              {hasLocation ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: MUTED, margin: 0 }}>
                  {[cityValue, countryValue].filter(Boolean).join(", ")}
                </p>
              ) : isOwner ? (
                <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.04em", color: "#cccccc", margin: 0 }}>No location set</p>
              ) : null}
              {isOwner && (
                <button onClick={() => { cancelEdit(); setEditingSection("details"); }} style={pencilSt} title="Edit details">✎</button>
              )}
            </div>

            {/* Bio display */}
            {hasBio ? (
              <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontStyle: "italic", color: "#505050", lineHeight: 1.7, margin: "0 0 8px 0", maxWidth: 560 }}>
                {bioValue}
              </p>
            ) : isOwner && !hasLocation ? (
              <button
                onClick={() => { cancelEdit(); setEditingSection("details"); }}
                style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Add location &amp; taste essay →
              </button>
            ) : null}

            {/* Star sign */}
            {starSignValue && (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: "#cccccc", margin: 0 }}>
                ☽ {starSignValue}
              </p>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div style={{ height: 1, background: RULE, marginBottom: "32px" }} />

        {/* ── Taste summary ── */}
        {(hasSummary || isOwner) && (
          <>
            <div style={{ paddingBottom: "32px" }}>
              {hasSummary ? (
                <>
                  <p style={{ fontFamily: SERIF, fontSize: "1.1rem", fontStyle: "italic", color: "#505050", lineHeight: 1.8, margin: "0 0 20px 0", maxWidth: 620 }}>
                    {profile.taste_summary}
                  </p>
                  {isOwner && (
                    <div>
                      <button onClick={handleGenerateSummary} disabled={summaryPending} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: summaryPending ? "#cccccc" : "#bbbbbb", background: "none", border: "none", cursor: summaryPending ? "default" : "pointer", padding: 0 }}>
                        {summaryPending ? "Generating…" : "Regenerate summary →"}
                      </button>
                      {summaryError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "8px 0 0" }}>{summaryError}</p>}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <button onClick={handleGenerateSummary} disabled={summaryPending} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: summaryPending ? "#cccccc" : ORANGE, background: "none", border: "none", cursor: summaryPending ? "default" : "pointer", padding: 0 }}>
                    {summaryPending ? "Generating…" : "Generate your taste summary →"}
                  </button>
                  {summaryError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "8px 0 0" }}>{summaryError}</p>}
                </div>
              )}
            </div>
            <div style={{ height: 1, background: RULE, marginBottom: "32px" }} />
          </>
        )}

        {/* ── Stats strip ── */}
        {totalRecords > 0 && (
          <>
            <div style={{ paddingBottom: "40px" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <StatCell label="Total Records"        value={totalRecords.toLocaleString()} border={false} />
                <StatCell label="Top Genre"            value={topGenre   ?? "—"} />
                <StatCell label="Top Country"          value={topCountry ?? "—"} />
                <StatCell label="Most Collected Label" value={topLabel   ?? "—"} />
              </div>
            </div>
            <div style={{ height: 1, background: RULE, marginBottom: "40px" }} />
          </>
        )}

        {/* ── Lists ── */}
        <section style={{ marginBottom: "48px" }}>
          <p style={eyebrowSt}>Lists · リスト</p>

          {lists.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
              {lists.map(list => {
                const items    = itemsByList.get(list.id) ?? [];
                const maxSlots = list.list_type === "top5" ? 5 : Math.max(items.length, 1);
                return (
                  <div key={list.id}>
                    <Link href={`/@${profile.username}/${list.slug}`} style={{ textDecoration: "none" }}>
                      <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: INK, margin: "0 0 16px 0", lineHeight: 1.2 }}>
                        {list.title}
                      </h2>
                    </Link>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(maxSlots, 5)}, 1fr)`, gap: "10px" }}>
                      {Array.from({ length: maxSlots }, (_, i) => {
                        const pos      = i + 1;
                        const item     = items.find(it => it.position === pos);
                        const rec      = item?.record_id ? coverById.get(item.record_id) : undefined;
                        const coverUrl = item?.item_type === "song" ? item.song_cover_url : (rec?.cover_url ?? null);
                        return (
                          <div key={pos}>
                            <div style={{ aspectRatio: "1 / 1", position: "relative", overflow: "hidden", background: coverUrl ? "transparent" : "#f4f4f4", border: coverUrl ? "none" : "1px dashed rgba(0,0,0,0.10)" }}>
                              {coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={coverUrl} alt={item?.song_album ?? rec?.album ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8" }}>—</span>
                                </div>
                              )}
                              <span style={{ position: "absolute", top: "7px", left: "7px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", color: coverUrl ? "rgba(255,255,255,0.75)" : "#cccccc", textShadow: coverUrl ? "0 1px 3px rgba(0,0,0,0.5)" : "none", lineHeight: 1 }}>
                                {pos}
                              </span>
                            </div>
                            {item && (
                              <div style={{ marginTop: "8px" }}>
                                <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, margin: "0 0 3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.item_type === "song" ? item.song_artist : rec?.artist}
                                </p>
                                <p style={{ fontFamily: SERIF, fontSize: "12px", color: INK, lineHeight: 1.3, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                  {item.item_type === "song" ? item.song_album : rec?.album}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isOwner ? (
            <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: MUTED, margin: 0 }}>
              No public lists yet.{" "}
              <Link href="/lists" style={{ color: ORANGE, textDecoration: "none" }}>Create one in Lists →</Link>
            </p>
          ) : null}
        </section>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: RULE, marginBottom: "40px" }} />

        {/* ── Community ── */}
        <section>
          <p style={eyebrowSt}>Community · コミュニティ</p>
          <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: INK, opacity: 0.4, margin: 0 }}>
            Collector matching coming soon.
          </p>
        </section>

      </main>
    </div>
  );
}

function StatCell({ label, value, border = true }: { label: string; value: string; border?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, paddingLeft: border ? "20px" : 0, paddingRight: "20px", borderLeft: border ? `1px solid ${RULE}` : "none" }}>
      <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px 0", whiteSpace: "nowrap" }}>
        {label}
      </p>
      <p style={{ fontFamily: SERIF, fontSize: "clamp(16px, 2.2vw, 26px)", color: INK, margin: 0, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </p>
    </div>
  );
}
