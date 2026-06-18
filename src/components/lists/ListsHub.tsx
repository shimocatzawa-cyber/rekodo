"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import AppNav from "@/components/AppNav";
import Top5Tab from "@/components/lists/Top5Tab";
import WantlistClient from "@/components/wantlist/WantlistClient";
import ProfileListsTab from "@/components/profile/ProfileListsTab";
import SellListClient from "@/components/profile/SellListClient";
import CommunityTab from "@/components/community/CommunityTab";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";

type SubTab = "top5" | "wantlist" | "selllist" | "community";

const TABS: Array<{ key: SubTab; label: string }> = [
  { key: "top5",      label: "Top 5" },
  { key: "wantlist",  label: "Want List" },
  { key: "selllist",  label: "Sell List" },
  { key: "community", label: "Community" },
];

interface Props {
  profileId:    string;
  username:     string;
  displayLabel?: string;
  avatarUrl?:   string | null;
  isSupporter:  boolean;
}

export default function ListsHub({ profileId, username, displayLabel, avatarUrl, isSupporter }: Props) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") as SubTab | null;
  const initial: SubTab = TABS.some(t => t.key === raw) ? raw! : "top5";
  const [activeTab, setActiveTab] = useState<SubTab>(initial);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column" }}>
      <AppNav username={username} displayLabel={displayLabel ?? undefined} avatarUrl={avatarUrl} />

      {/* Sub-tab bar */}
      <div style={{ display: "flex", justifyContent: "center", background: "#ffffff", flexShrink: 0 }}>
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
          <div>
            {/* CSV import at top, centered */}
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem 2rem 0" }}>
              <div style={{ width: "100%", maxWidth: 560 }}>
                <WantlistClient isOwner={true} isSupporter={isSupporter} userId={profileId} embedded />
              </div>
            </div>
            {/* Wantlist items below */}
            <ProfileListsTab initialLists={[]} username={username} listTypeFilter="wantlist" />
          </div>
        )}
        {activeTab === "selllist" && (
          <SellListClient profileOwnerId={profileId} isOwner={true} />
        )}
        {activeTab === "community" && (
          <CommunityTab profileOwnerId={profileId} />
        )}
      </div>
    </div>
  );
}
