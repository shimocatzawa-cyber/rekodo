"use client";

import { useUrlTab } from "@/lib/useUrlTab";
import { useTranslations } from "next-intl";
import AppNav from "@/components/AppNav";
import Top5Tab from "@/components/lists/Top5Tab";
import ProfileListsTab from "@/components/profile/ProfileListsTab";
import SellListClient from "@/components/profile/SellListClient";
import PlaylistTab from "@/components/lists/PlaylistTab";
import BandcampListTab from "@/components/lists/BandcampListTab";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

type SubTab = "top5" | "wantlist" | "selllist" | "playlist" | "bandcamp";

interface Props {
  profileId:    string;
  username:     string;
  displayLabel?: string;
  avatarUrl?:   string | null;
  isSupporter:  boolean;
  isAdmin?:     boolean;
}

export default function ListsHub({ profileId, username, displayLabel, avatarUrl, isSupporter, isAdmin }: Props) {
  const t = useTranslations("lists");
  const baseTabs: Array<{ key: SubTab; label: string }> = [
    { key: "top5",      label: t("myLists") },
    { key: "wantlist",  label: t("wantList") },
    { key: "selllist",  label: t("sellList") },
    { key: "playlist",  label: t("playlist") },
  ];
  const TABS = isAdmin
    ? [
        { key: "top5" as SubTab,      label: t("myLists") },
        { key: "bandcamp" as SubTab,  label: "Bandcamp" },
        { key: "wantlist" as SubTab,  label: t("wantList") },
        { key: "selllist" as SubTab,  label: t("sellList") },
        { key: "playlist" as SubTab,  label: t("playlist") },
      ]
    : baseTabs;
  const [activeTab, setActiveTab] = useUrlTab<SubTab>("tab", TABS.map(t => t.key), "top5");

  // isSupporter kept in Props for potential future use
  void isSupporter;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column" }}>
      <AppNav username={username} displayLabel={displayLabel ?? undefined} avatarUrl={avatarUrl} />

      {/* Sub-tab bar */}
      <div className="rk-lists-tabs" style={{ display: "flex", justifyContent: "center", background: "#ffffff", flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: activeTab === t.key ? "#0d0d0d" : "#bbbbbb",
              background: "none",
              border: "none",
              borderBottom: `1.5px solid ${activeTab === t.key ? ORANGE : "transparent"}`,
              cursor: "pointer",
              padding: "14px 24px 12px",
              display: "inline-flex",
              alignItems: "center",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {activeTab === "top5" && (
          <Top5Tab username={username} />
        )}
        {activeTab === "wantlist" && (
          <ProfileListsTab initialLists={[]} username={username} listTypeFilter="wantlist" />
        )}
        {activeTab === "selllist" && (
          <SellListClient profileOwnerId={profileId} isOwner={true} />
        )}
        {/* Kept mounted (just hidden) rather than conditionally rendered like the
            other tabs — switching away used to fully unmount PlaylistTab, wiping
            its generated tracks/player state, so coming back showed an empty
            "pick a mood" placeholder with no way to resume what was still
            playing in the background via the persistent SpotifyPlayerProvider. */}
        <div style={{ display: activeTab === "playlist" ? "block" : "none" }}>
          <PlaylistTab username={username} />
        </div>
        {isAdmin && activeTab === "bandcamp" && (
          <BandcampListTab />
        )}
      </div>
    </div>
  );
}
