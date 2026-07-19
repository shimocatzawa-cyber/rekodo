"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import LocaleSwitcher from "@/components/LocaleSwitcher";

const SERIF = "var(--font-editorial)";
const MONO = "var(--font-mono)";
const JP = "var(--font-noto-jp), sans-serif";
const ORANGE = "#CC5500";

const NAV_ITEMS = [
  { href: "/selects",    label: "Rekōdo Selects", jp: "選集" },
  { href: "/collection", label: "Collection",     jp: "コレクション" },
  { href: "/digital",    label: "Digital",        jp: "デジタル" },
  { href: "/dig",        label: "Dig",            jp: "発掘" },
  { href: "/deep-dive",  label: "Deep Dive",      jp: "ディープダイブ" },
  { href: "/lists",      label: "Lists",          jp: "リスト" },
  { href: "/insights",   label: "Insights",       jp: "インサイト" },
  { href: "/community",  label: "Community",      jp: "コミュニティ" },
] as const;

export default function AppNav({ username, displayLabel, avatarUrl }: { username: string; displayLabel?: string; avatarUrl?: string | null }) {
  const pathname = usePathname();
  const locale = useLocale();
  const isJa = locale === "ja";
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [isSupporter,  setIsSupporter]  = useState(false);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const userDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userDropOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userDropRef.current && !userDropRef.current.contains(e.target as Node)) {
        setUserDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userDropOpen]);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      (sb as any).from("profiles")
        .select("is_donor, is_supporter, role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }: { data: { is_donor?: boolean; is_supporter?: boolean; role?: string } | null }) => {
          if (data?.is_donor || data?.is_supporter || data?.role === "admin") setIsSupporter(true);
          if (data?.role === "admin") setIsAdmin(true);
        });
    });
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <nav
        style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
        className="flex items-center justify-between px-8 md:px-12 py-5 bg-white"
      >
        {/* Left — ō wordmark (desktop: Link to home; mobile: menu trigger) */}
        <Link
          href="/"
          aria-label="rekōdo home"
          className="hidden md:block"
          style={{
            fontFamily: SERIF, fontWeight: 700, fontSize: "28px", color: ORANGE,
            textDecoration: "none", lineHeight: 1,
          }}
        >
          ō
        </Link>
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          style={{
            fontFamily: SERIF, fontWeight: 700, fontSize: "28px",
            color: menuOpen ? "#0d0d0d" : ORANGE,
            background: "none", border: "none", cursor: "pointer",
            padding: 0, lineHeight: 1,
            transition: "color 0.2s",
          }}
        >
          ō
        </button>

        {/* Centre — desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map(({ href, label, jp, ...rest }) => {
            const newTab = "newTab" in rest && rest.newTab;
            const active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
            return (
              <Link
                key={href}
                href={href}
                {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{
                  fontFamily: MONO,
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: active ? "#0d0d0d" : "#767676",
                  textDecoration: "none",
                  borderBottom: `1.5px solid ${active ? ORANGE : "transparent"}`,
                  paddingBottom: "3px",
                  transition: "color 0.15s, border-color 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
                className="hover:text-black"
              >
                {isJa ? jp : label}
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: isJa ? MONO : JP,
                    fontSize: "10px",
                    letterSpacing: isJa ? "0.06em" : 0,
                    textTransform: isJa ? "uppercase" : "none",
                    color: active ? "#0d0d0d" : "#c0c0c0",
                  }}
                >
                  {isJa ? label : jp}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Right — avatar + @username dropdown (locale switcher sits inside, next to avatar) */}
        <div className="flex items-center gap-3">
          <div ref={userDropRef} style={{ position: "relative" }}>
            <button
              onClick={() => setUserDropOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: "9px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: "50%", background: ORANGE,
                    fontFamily: MONO, fontSize: "11px", fontWeight: 600, color: "#ffffff",
                    lineHeight: 1, flexShrink: 0, textTransform: "uppercase",
                  }}
                >
                  {(displayLabel ?? username).charAt(0)}
                </span>
              )}
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", color: "#888888" }}>
                @{username}{isSupporter && <span style={{ fontFamily: SERIF, fontSize: "10px", color: "#B8860B", marginLeft: "3px" }} title="rekōdo supporter">ō</span>}
              </span>
              <LocaleSwitcher locale={locale} />
            </button>

            {userDropOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                background: "#ffffff", border: "1px solid #e0e0da",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 100, minWidth: 160,
              }}>
                {[
                  { href: `/@${username}`,  label: "Profile",       jp: "プロフィール" },
                  { href: "/archetypes",    label: "Archetypes",    jp: "アーキタイプ" },
                  { href: "/constellation", label: "Constellation", jp: "星座" },
                  { href: "/about",         label: "Support",       jp: "サポート" },
                ].map(({ href, label, jp }, i, arr) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setUserDropOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "11px 16px", whiteSpace: "nowrap",
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                      textTransform: "uppercase", color: "#0a0a0a", textDecoration: "none",
                      borderBottom: i < arr.length - 1 ? "1px solid #e0e0da" : "none",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f7f5f0")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {isJa ? jp : label}
                    <span style={{
                      fontFamily: isJa ? MONO : JP,
                      fontSize: "9px",
                      letterSpacing: isJa ? "0.06em" : 0,
                      textTransform: isJa ? "uppercase" : "none",
                      color: "#c0c0c0",
                    }}>
                      {isJa ? label : jp}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div
          className="md:hidden"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#ffffff",
            borderBottom: "1px solid #e8e8e8",
            zIndex: 50,
            padding: "1.5rem 2rem 2rem",
          }}
        >
          {NAV_ITEMS.map(({ href, label, jp, ...rest }) => {
            const newTab = "newTab" in rest && rest.newTab;
            const active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: "0.5px solid #f0f0f0",
                  fontFamily: MONO,
                  fontSize: "13px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active ? "#0d0d0d" : "#888888",
                  textDecoration: "none",
                }}
              >
                {isJa ? jp : label}
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: isJa ? MONO : JP,
                    fontSize: "12px",
                    letterSpacing: isJa ? "0.06em" : 0,
                    textTransform: isJa ? "uppercase" : "none",
                    color: active ? "#CC5500" : "#c0c0c0",
                  }}
                >
                  {isJa ? label : jp}
                </span>
              </Link>
            );
          })}

          <div style={{ marginTop: "1.5rem" }}>
            {[
              { href: "/archetypes",    label: "Archetypes",    jp: "アーキタイプ" },
              { href: "/constellation", label: "Constellation", jp: "星座" },
              { href: "/about",         label: "Support",       jp: "サポート" },
            ].map(({ href, label, jp }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: "0.5px solid #f0f0f0",
                  fontFamily: MONO,
                  fontSize: "13px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: pathname === href ? "#0d0d0d" : "#888888",
                  textDecoration: "none",
                }}
              >
                {isJa ? jp : label}
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: isJa ? MONO : JP,
                    fontSize: "12px",
                    letterSpacing: isJa ? "0.06em" : 0,
                    textTransform: isJa ? "uppercase" : "none",
                    color: pathname === href ? ORANGE : "#c0c0c0",
                  }}
                >
                  {isJa ? label : jp}
                </span>
              </Link>
            ))}
            <Link
              href={`/@${username}`}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: MONO,
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#888888",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "1.25rem",
              }}
            >
              @{username}{isSupporter && <span style={{ fontFamily: SERIF, fontSize: "12px", color: "#B8860B" }} title="rekōdo supporter">ō</span>}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
