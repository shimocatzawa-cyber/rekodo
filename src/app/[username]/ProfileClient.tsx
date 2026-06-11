"use client";

import { useRef, useState, useTransition, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { STAR_SIGNS } from "@/lib/starSigns";
import { saveAvatarUrl, saveDisplayName, saveProfileSettings } from "@/app/settings/profile/actions";
import { generateTasteSummary } from "./actions";
import AppNav from "@/components/AppNav";
import ProfileListsTab from "@/components/profile/ProfileListsTab";
import CollectionPhotos from "@/app/p/[username]/CollectionPhotos";
import Top5Editor, { type EditorSlot } from "@/components/profile/Top5Editor";
import { createList } from "@/app/lists/actions";
import WantlistClient from "@/components/wantlist/WantlistClient";
import type { UserList, DiscoverList } from "@/app/lists/types";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const RULE   = "#e0e0da";
const MUTED  = "#aaaaaa";

const SIGN_SYMBOL: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

// ─── Static placeholder discover cards ────────────────────────────────────────

const STATIC_DISCOVER_CARDS = [
  { id: "s1", title: "Top 5 Japanese Jazz",       username: "tokyovinyl",  count: "892 records",   badge: "Label Mate · 71%",             saves: 312 },
  { id: "s2", title: "Top 5 Kosmische",            username: "analogdrift", count: "634 records",   badge: "Bandmates · 79%",              saves: 156 },
  { id: "s3", title: "Top 5 Drag City Records",    username: "indiehead",   count: "445 records",   badge: "A Side to my B · 58%",         saves: 89  },
  { id: "s4", title: "Top 5 Records of 1972",      username: "cratedigger", count: "23 versions",   badge: "Trending 🔥",                  saves: 847 },
  { id: "s5", title: "Top 5 Blue Note Originals",  username: "jazzhead",    count: "1,204 records", badge: "Regular at the Same Shop · 42%", saves: 234 },
] as const;

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
  viewer?: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  fullLists?: UserList[];
  discoverLists?: DiscoverList[];
  collectionPhoto?: string | null;
}

type ProfileTab  = "profile" | "lists" | "community";
type DiscoverTab = "similar" | "following" | "trending" | "all";

// ─── Discover card component ──────────────────────────────────────────────────

function DiscoverCard({ title, username, recordCount, badge, saves, onSave, saved }: {
  title: string; username: string; recordCount: string;
  badge: string | null; saves: number;
  onSave: () => void; saved: boolean;
}) {
  return (
    <div style={{ borderBottom: "1px solid #e0e0da", padding: "16px 0" }}>
      <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </p>
      <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED, letterSpacing: "0.06em", marginBottom: "12px" }}>
        @{username} · {recordCount}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        {badge ? (
          <span style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.06em", fontStyle: "italic", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {badge}
          </span>
        ) : <span />}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <button onClick={onSave} disabled={saved}
            style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.06em", color: saved ? MUTED : ORANGE, background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0 }}>
            {saved ? "Saved ✓" : "Save ↓"}
          </button>
          <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED, letterSpacing: "0.04em" }}>
            {saves.toLocaleString()} saves
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileClient({
  profile, isOwner, totalRecords, topGenre, topCountry, topLabel,
  lists, listItems, coverRecords, followerCount, followingCount, viewer,
  fullLists, discoverLists = [], collectionPhoto = null,
}: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [profileTab, setProfileTab] = useState<ProfileTab>(() => {
    const p = searchParams.get("tab");
    if (p === "lists" && isOwner) return "lists";
    if (p === "community") return "community";
    return "profile";
  });
  // ── Top 5 editor ─────────────────────────────────────────────────────────
  type EditorModal =
    | null
    | { step: "template"; customMode: boolean; customTitle: string }
    | { step: "editor";   listId: string; listTitle: string; slots: EditorSlot[] };

  const [editorModal,    setEditorModal]    = useState<EditorModal>(null);
  const [creatingList,   startCreatingList] = useTransition();

  const TOP5_TEMPLATES = [
    "Top 5 All Time",
    "Top 5 Desert Island Records",
    "Top 5 Break Up Records",
    "Top 5 Make Up Records",
    "Top 5 Sunday Morning Records",
    "Top 5 Saturday Night Records",
    "Top 5 Records That Changed My Life",
    "Top 5 Gateway Records",
    "Top 5 Most Played",
    "Top 5 Hidden Gems",
  ] as const;

  function openCreate() {
    setEditorModal({ step: "template", customMode: false, customTitle: "" });
  }

  function handlePickTemplate(title: string) {
    startCreatingList(async () => {
      const res = await createList(title, "top5");
      if (res && "success" in res && res.success && res.list) {
        setEditorModal({ step: "editor", listId: res.list.id, listTitle: res.list.title, slots: [] });
      }
    });
  }

  function handleCustomCreate() {
    if (editorModal?.step !== "template") return;
    const raw = editorModal.customTitle.trim();
    if (!raw) return;
    const title = raw.replace(/^top\s+5\s+/i, "");
    handlePickTemplate(`Top 5 ${title}`);
  }

  function openListEdit(listId: string, listTitle: string) {
    const items = itemsByList.get(listId) ?? [];
    const slots: EditorSlot[] = Array.from({ length: 5 }, (_, i) => {
      const pos  = i + 1;
      const item = items.find(it => it.position === pos);
      const rec  = item?.record_id ? coverById.get(item.record_id) : undefined;
      return {
        position: pos,
        recordId: item?.record_id ?? null,
        coverUrl: item?.item_type === "song" ? item.song_cover_url : (rec?.cover_url ?? null),
        artist:   item?.item_type === "song" ? item.song_artist   : (rec?.artist    ?? null),
        album:    item?.item_type === "song" ? item.song_album    : (rec?.album     ?? null),
      };
    });
    setEditorModal({ step: "editor", listId, listTitle, slots });
  }

  function handleEditorClose() {
    setEditorModal(null);
    router.refresh();
  }

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

  // ── Taste summary ─────────────────────────────────────────────────────────
  const [summaryPending, startSummaryTransition] = useTransition();
  const [summaryError,   setSummaryError]        = useState<string | null>(null);

  // ── Share ─────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Community tab state ───────────────────────────────────────────────────
  const [discoverTab,    setDiscoverTab]    = useState<DiscoverTab>("similar");
  const [followingLists, setFollowingLists] = useState<DiscoverList[]>([]);
  const [followingState, setFollowingState] = useState<"idle" | "loading" | "done" | "empty">("idle");
  const [savedCards,     setSavedCards]     = useState<Array<{ id: string; title: string; username: string }>>([]);

  useEffect(() => {
    if (discoverTab !== "following" || followingState !== "idle") return;
    setFollowingState("loading");
    fetch("/api/lists/following")
      .then(r => r.ok ? r.json() : { lists: [] })
      .then((data: { lists?: DiscoverList[] }) => {
        const ls = data.lists ?? [];
        setFollowingLists(ls);
        setFollowingState(ls.length === 0 ? "empty" : "done");
      })
      .catch(() => setFollowingState("empty"));
  }, [discoverTab, followingState]);

  const sortedDiscoverLists = useMemo(() => {
    if (discoverTab === "trending") return [...discoverLists].sort((a, b) => b.itemCount - a.itemCount);
    return discoverLists;
  }, [discoverLists, discoverTab]);

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

  function saveCard(id: string, title: string, username: string) {
    setSavedCards(prev => prev.some(c => c.id === id) ? prev : [...prev, { id, title, username }]);
  }

  // ── List data (for Profile tab cover grid) ────────────────────────────────
  const coverById   = new Map(coverRecords.map(r => [r.id, r]));
  const itemsByList = new Map<string, ListItemRow[]>(lists.map(l => [l.id, []]));
  for (const item of listItems) itemsByList.get(item.list_id)?.push(item);

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
  const eyebrowSt: React.CSSProperties = {
    fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em",
    textTransform: "uppercase", color: ORANGE, margin: "0 0 20px 0",
  };

  const tabItems: Array<{ key: ProfileTab; label: string }> = [
    { key: "profile",   label: "Profile" },
    ...(isOwner ? [{ key: "lists" as ProfileTab, label: "Wantlist" }] : []),
    { key: "community", label: "Community" },
  ];

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

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", justifyContent: "center", gap: "24px", paddingTop: "14px", paddingBottom: "2px", background: "#ffffff" }}>
        {tabItems.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setProfileTab(key)}
            style={{
              fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", background: "none", border: "none",
              borderBottom: `1.5px solid ${profileTab === key ? ORANGE : "transparent"}`,
              padding: "6px 0",
              color: profileTab === key ? INK : "#bbbbbb",
              cursor: "pointer", display: "inline-block",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─────────────── PROFILE TAB ─────────────────────────────────────────── */}
      {profileTab === "profile" && (
        <main style={{ padding: "3rem 3.5rem", maxWidth: 860, margin: "0 auto", minWidth: 0, width: "100%" }}>

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

              {/* Edit / Share — owner only, not while editing */}
              {isOwner && !editing && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end", flexShrink: 0 }}>
                  <button onClick={openEdit} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Edit profile
                  </button>
                  <button onClick={handleShare} style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: copied ? MUTED : ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {copied ? "Copied ✓" : "Share profile ↗"}
                  </button>
                </div>
              )}
            </div>

            {/* ── DISPLAY MODE ── */}
            {!editing && (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", margin: "0 0 12px 0", flexWrap: "wrap" }}>
                  <h1 style={{ fontFamily: SERIF, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400, color: INK, lineHeight: 1.1, margin: 0 }}>
                    {displayName}
                  </h1>
                  {(profile.is_donor || profile.role === "admin") && (
                    <span style={{ fontFamily: SERIF, fontSize: "clamp(16px, 2.5vw, 24px)", fontWeight: 400, color: "#B8860B", lineHeight: 1.1 }} title="rekōdo supporter">ō</span>
                  )}
                  {profile.role === "admin" && (
                    <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, border: `1px solid ${ORANGE}`, padding: "3px 7px", lineHeight: 1, whiteSpace: "nowrap" }}>
                      Admin
                    </span>
                  )}
                </div>

                <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 6px 0" }}>
                  @{profile.username}
                </p>

                {(followerCount > 0 || followingCount > 0) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 8px 0" }}>
                    {followerCount > 0 && <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>}
                    {followerCount > 0 && followingCount > 0 && <span style={{ margin: "0 8px" }}>·</span>}
                    {followingCount > 0 && <span>following {followingCount}</span>}
                  </p>
                )}

                {(cityValue || countryValue) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 6px 0" }}>
                    {[cityValue || profile.city, countryValue || profile.country].filter(Boolean).join(", ")}
                  </p>
                )}

                {(bioValue || profile.bio) && (
                  <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontStyle: "italic", color: "#505050", lineHeight: 1.7, margin: "0 0 8px 0", maxWidth: 560 }}>
                    {bioValue || profile.bio}
                  </p>
                )}

                {(starSignValue || profile.star_sign) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: "0 0 6px 0" }}>
                    {SIGN_SYMBOL[starSignValue || profile.star_sign || ""] ?? "☽"}{" "}
                    {starSignValue || profile.star_sign}
                  </p>
                )}

                {(bandcampValue || profile.bandcamp_username) && (
                  <p style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.04em", color: MUTED, margin: 0 }}>
                    bandcamp.com/{bandcampValue || profile.bandcamp_username}
                  </p>
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
                  <label style={labelSt}>Taste essay <span style={{ opacity: 0.45, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>optional · 160 chars</span></label>
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
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: RULE, marginBottom: "32px" }} />

          {/* Taste summary */}
          {(profile.taste_summary || isOwner) && (
            <>
              <div style={{ paddingBottom: "32px" }}>
                {profile.taste_summary ? (
                  <>
                    <p style={{ fontFamily: SERIF, fontSize: "1.1rem", fontStyle: "italic", color: "#505050", lineHeight: 1.8, margin: "0 0 20px 0" }}>
                      {profile.taste_summary}
                    </p>
                    {isOwner && (
                      <div>
                        <button onClick={handleGenerateSummary} disabled={summaryPending} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: summaryPending ? "#ccc" : "#bbb", background: "none", border: "none", cursor: summaryPending ? "default" : "pointer", padding: 0 }}>
                          {summaryPending ? "Generating…" : "Regenerate summary →"}
                        </button>
                        {summaryError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "8px 0 0" }}>{summaryError}</p>}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <button onClick={handleGenerateSummary} disabled={summaryPending} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: summaryPending ? "#ccc" : ORANGE, background: "none", border: "none", cursor: summaryPending ? "default" : "pointer", padding: 0 }}>
                      {summaryPending ? "Generating…" : "Generate your taste summary →"}
                    </button>
                    {summaryError && <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", margin: "8px 0 0" }}>{summaryError}</p>}
                  </div>
                )}
              </div>
              <div style={{ height: 1, background: RULE, marginBottom: "32px" }} />
            </>
          )}

          {/* ── Collection photo ── */}
          <div style={{ marginBottom: "48px" }}>
            <CollectionPhotos
              initialPhoto={collectionPhoto}
              userId={profile.id}
              isOwner={isOwner}
            />
          </div>

          {/* ── Lists section ── */}
          <section style={{ marginBottom: "48px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <p style={eyebrowSt}>Lists</p>
              {isOwner && (
                <button
                  onClick={openCreate}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: `1px solid ${ORANGE}`, borderRadius: "3px", cursor: "pointer", padding: "4px 10px", whiteSpace: "nowrap" }}
                >
                  + New Top 5
                </button>
              )}
            </div>

            {lists.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
                {lists.map(list => {
                  const items    = itemsByList.get(list.id) ?? [];
                  const maxSlots = list.list_type === "top5" ? 5 : Math.max(items.length, 1);
                  return (
                    <div key={list.id}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
                        <Link href={`/@${profile.username}/${list.slug}`} style={{ textDecoration: "none" }}>
                          <h2 style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 400, color: INK, margin: 0, lineHeight: 1.2 }}>
                            {list.title}
                          </h2>
                        </Link>
                        {isOwner && (
                          <button
                            onClick={() => openListEdit(list.id, list.title)}
                            style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginLeft: "16px" }}
                          >
                            Edit →
                          </button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(maxSlots, 5)}, 1fr)`, gap: "10px" }}>
                        {Array.from({ length: maxSlots }, (_, i) => {
                          const pos      = i + 1;
                          const item     = items.find(it => it.position === pos);
                          const rec      = item?.record_id ? coverById.get(item.record_id) : undefined;
                          const coverUrl = item?.item_type === "song" ? item.song_cover_url : (rec?.cover_url ?? null);
                          return (
                            <div key={pos}>
                              <div style={{ position: "relative", overflow: "hidden", lineHeight: 0 }}>
                                {coverUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={coverUrl} alt={item?.song_album ?? rec?.album ?? ""} style={{ display: "block", width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
                                ) : (
                                  <div style={{ width: "100%", aspectRatio: "1/1", background: "#f4f4f4", border: "1px dashed rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontFamily: SERIF, fontSize: "18px", color: "#d8d8d8", lineHeight: 1 }}>—</span>
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
                <button onClick={openCreate} style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em", color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Create one →
                </button>
              </p>
            ) : null}
          </section>

        </main>
      )}

      {/* ─────────────── WANTLIST TAB ────────────────────────────────────────── */}
      {profileTab === "lists" && (
        <>
          <WantlistClient
            isOwner={isOwner}
            userId={isOwner ? profile.id : null}
            embedded
          />
          {isOwner && (
            <ProfileListsTab
              initialLists={fullLists ?? []}
              username={profile.username}
            />
          )}
        </>
      )}

      {/* ─────────────── COMMUNITY TAB ───────────────────────────────────────── */}
      {profileTab === "community" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 1.5rem 3rem", width: "100%" }}>

          {/* Sticky header */}
          <div style={{ position: "sticky", top: 0, background: "#ffffff", zIndex: 1, padding: "24px 0 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 0 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.3rem", fontWeight: 400, color: INK, marginBottom: "14px" }}>
              Community
            </h2>
            <div style={{ display: "flex", gap: "24px" }}>
              {(["similar", "following", "trending", "all"] as DiscoverTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDiscoverTab(tab)}
                  style={{
                    fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em",
                    textTransform: "capitalize", background: "none", border: "none",
                    cursor: "pointer", padding: "0 0 4px",
                    color: discoverTab === tab ? INK : MUTED,
                    borderBottom: `1px solid ${discoverTab === tab ? INK : "transparent"}`,
                    transition: "color 0.15s",
                  }}
                >
                  {tab === "similar" ? "Similar" : tab === "following" ? "Following" : tab === "trending" ? "Trending" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Following tab content */}
          {discoverTab === "following" ? (
            followingState === "loading" ? (
              <div style={{ padding: "32px 0" }}>
                <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ccc" }}>Loading…</p>
              </div>
            ) : followingState === "empty" ? (
              <div style={{ padding: "32px 0" }}>
                <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "13px", color: "#ccc", lineHeight: 1.6 }}>
                  No lists yet from people you follow.
                </p>
              </div>
            ) : (
              followingLists.map(list => (
                <DiscoverCard
                  key={list.id}
                  title={list.title}
                  username={list.username}
                  recordCount={`${list.itemCount} records`}
                  badge={null}
                  saves={list.saveCount}
                  onSave={() => saveCard(list.id, list.title, list.username)}
                  saved={savedCards.some(c => c.id === list.id)}
                />
              ))
            )
          ) : (
            /* Similar / Trending / All tabs */
            <>
              {STATIC_DISCOVER_CARDS.map(card => (
                <DiscoverCard
                  key={card.id}
                  title={card.title}
                  username={card.username}
                  recordCount={card.count}
                  badge={card.badge}
                  saves={card.saves}
                  onSave={() => saveCard(card.id, card.title, card.username)}
                  saved={savedCards.some(c => c.id === card.id)}
                />
              ))}
              {sortedDiscoverLists.map(list => (
                <DiscoverCard
                  key={list.id}
                  title={list.title}
                  username={list.username}
                  recordCount={`${list.itemCount} records`}
                  badge={null}
                  saves={list.saveCount}
                  onSave={() => saveCard(list.id, list.title, list.username)}
                  saved={savedCards.some(c => c.id === list.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Template picker modal ── */}
      {editorModal?.step === "template" && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onClick={e => { if (e.target === e.currentTarget) setEditorModal(null); }}
        >
          <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", width: "100%", maxWidth: "660px", padding: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "6px" }}>New list</p>
                <p style={{ fontFamily: SERIF, fontSize: "18px", color: INK, margin: 0 }}>Top 5 list</p>
              </div>
              <button onClick={() => setEditorModal(null)} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {!editorModal.customMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
                {TOP5_TEMPLATES.map(title => (
                  <button key={title} disabled={creatingList}
                    onClick={() => handlePickTemplate(title)}
                    style={{ textAlign: "left", padding: "16px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", cursor: creatingList ? "wait" : "pointer" }}
                    onMouseEnter={e => { if (!creatingList) (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
                  >
                    <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, lineHeight: 1.35, margin: 0 }}>{title}</p>
                  </button>
                ))}
                <button disabled={creatingList}
                  onClick={() => setEditorModal({ ...editorModal, customMode: true })}
                  style={{ textAlign: "left", padding: "16px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
                >
                  <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, lineHeight: 1.35, margin: 0 }}>+ Custom</p>
                </button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleCustomCreate(); }} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "baseline", borderBottom: "1px solid rgba(0,0,0,0.2)", paddingBottom: "6px" }}>
                  <span style={{ fontFamily: SERIF, fontSize: "20px", color: "#cccccc", whiteSpace: "nowrap", userSelect: "none" }}>Top 5 </span>
                  <input
                    autoFocus type="text"
                    value={editorModal.customTitle}
                    onChange={e => setEditorModal({ ...editorModal, customTitle: e.target.value })}
                    placeholder="Rainy Day Records…"
                    maxLength={60}
                    style={{ flex: 1, outline: "none", fontFamily: SERIF, fontSize: "20px", color: INK, background: "transparent", border: "none" }}
                  />
                </div>
                <button type="submit" disabled={!editorModal.customTitle.trim() || creatingList}
                  style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: editorModal.customTitle.trim() ? ORANGE : "#cccccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {creatingList ? "Creating…" : "Create →"}
                </button>
                <button type="button" onClick={() => setEditorModal({ ...editorModal, customMode: false })}
                  style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  ← Back
                </button>
              </form>
            )}

            {creatingList && (
              <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginTop: "20px" }}>Creating…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Top 5 editor overlay ── */}
      {editorModal?.step === "editor" && (
        <Top5Editor
          listId={editorModal.listId}
          listTitle={editorModal.listTitle}
          initialSlots={editorModal.slots}
          onClose={handleEditorClose}
        />
      )}

    </div>
  );
}
