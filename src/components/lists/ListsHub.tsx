"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import AppNav from "@/components/AppNav";
import ProfileListsTab from "@/components/profile/ProfileListsTab";
import WantlistClient from "@/components/wantlist/WantlistClient";
import SellListClient from "@/components/profile/SellListClient";
import CommunityTab from "@/components/community/CommunityTab";

const MONO  = "var(--font-mono)";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";

type SubTab = "top5" | "wantlist" | "selllist" | "community";

const TABS: Array<{ key: SubTab; label: string; jp: string }> = [
  { key: "top5",      label: "Top 5",    jp: "トップ5" },
  { key: "wantlist",  label: "Want List", jp: "欲しい物" },
  { key: "selllist",  label: "Sell List", jp: "売りリスト" },
  { key: "community", label: "Community", jp: "コミュニティ" },
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
      <div style={{ borderBottom: `1px solid ${RULE}`, display: "flex", justifyContent: "center", gap: "0", background: "#ffffff", flexShrink: 0 }}>
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
              marginBottom: "-1px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-noto-jp), sans-serif",
                fontSize: "10px",
                letterSpacing: 0,
                textTransform: "none",
                color: activeTab === t.key ? "#0d0d0d" : "#d0d0d0",
              }}
            >
              {t.jp}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {activeTab === "top5" && (
          <ProfileListsTab initialLists={[]} username={username} />
        )}
        {activeTab === "wantlist" && (
          <WantlistClient isOwner={true} isSupporter={isSupporter} userId={profileId} embedded />
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
