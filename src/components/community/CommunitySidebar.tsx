"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const GOLD   = "#C9A84C";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";
const ORANGE = "#CC5500";

const TIER_ORDER = [
  "Twins",
  "Same Record, Different Pressing",
  "Bandmates",
  "Label Mate",
  "The A Side to My B",
  "Regular at the Same Shop",
  "Passing Acquaintance",
  "Complete Stranger",
];

function compatLabel(score: number): string {
  if (score >= 55) return "Twins";
  if (score >= 35) return "Same Record, Different Pressing";
  if (score >= 20) return "Bandmates";
  if (score >= 10) return "Label Mate";
  if (score >=  5) return "The A Side to My B";
  if (score >=  2) return "Regular at the Same Shop";
  if (score >=  1) return "Passing Acquaintance";
  return "Complete Stranger";
}

type Person = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_donor: boolean | null;
};

function Avatar({ avatarUrl, name, username, size = 36 }: {
  avatarUrl: string | null; name: string | null; username: string; size?: number;
}) {
  const init = name
    ? name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase()
    : (username[0] ?? "?").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f0ede8", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name ?? username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontFamily: MONO, fontSize: `${Math.floor(size * 0.28)}px`, color: "#666", fontWeight: 600 }}>{init}</span>
      )}
    </div>
  );
}

const SOCIAL_CAP = 30;

function AvatarGrid({ people }: { people: Person[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px", marginTop: "10px" }}>
      {people.map(f => (
        <Link key={f.id} href={`/@${f.username}`} title={f.display_name ?? f.username} style={{ textDecoration: "none", position: "relative", display: "inline-block" }}>
          <Avatar avatarUrl={f.avatar_url} name={f.display_name} username={f.username} size={36} />
          {f.is_donor && (
            <span style={{ position: "absolute", bottom: -1, right: -1, fontFamily: SERIF, fontSize: "9px", color: GOLD, lineHeight: 1, background: "#fff", borderRadius: "50%", padding: "1px" }} title="rekōdo supporter">ō</span>
          )}
        </Link>
      ))}
    </div>
  );
}

function Section({ title, people }: { title: string; people: Person[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? people : people.slice(0, SOCIAL_CAP);
  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#0a0a0a", margin: 0 }}>
          {title}
        </p>
        <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: MUTED }}>{people.length}</span>
      </div>
      {people.length === 0 ? (
        <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, lineHeight: 1.6, margin: 0 }}>
          {title === "Following" ? "Not following anyone yet." : "No followers yet."}
        </p>
      ) : (
        <>
          <AvatarGrid people={visible} />
          {people.length > SOCIAL_CAP && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.08em", color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "8px 0 0", textDecoration: "underline" }}
            >
              {expanded ? "Show less" : `See all ${people.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

type TierItem = { userId: string; score: number; sharedTags: string[] };

export default function CommunitySidebar({ profileOwnerId, onTierClick, onTierData, activeTier }: {
  profileOwnerId: string;
  onTierClick?: (tier: string, items: TierItem[]) => void;
  onTierData?: (map: Map<string, TierItem[]>) => void;
  activeTier?: string | null;
}) {
  const [followers,     setFollowers]     = useState<Person[]>([]);
  const [following,     setFollowing]     = useState<Person[]>([]);
  const [tierItems,     setTierItems]     = useState<Map<string, TierItem[]>>(new Map());
  const [socialLoaded,  setSocialLoaded]  = useState(false);
  const [tiersLoaded,   setTiersLoaded]   = useState(false);

  // Phase 1: load followers/following immediately (fast)
  useEffect(() => {
    const supabase = createClient();

    async function resolveProfiles(ids: string[]): Promise<Person[]> {
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_donor")
        .in("id", ids);
      const byId = new Map((data ?? []).map(p => [p.id, p]));
      return ids.map(id => byId.get(id)).filter(Boolean) as Person[];
    }

    Promise.all([
      supabase.from("follows").select("follower_id").eq("following_id", profileOwnerId).order("created_at", { ascending: false }).limit(100),
      supabase.from("follows").select("following_id").eq("follower_id", profileOwnerId).order("created_at", { ascending: false }).limit(100),
    ]).then(async ([followerRes, followingRes]) => {
      const [followerProfiles, followingProfiles] = await Promise.all([
        resolveProfiles((followerRes.data ?? []).map((r: any) => r.follower_id)),
        resolveProfiles((followingRes.data ?? []).map((r: any) => r.following_id)),
      ]);
      setFollowers(followerProfiles);
      setFollowing(followingProfiles);
      setSocialLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOwnerId]);

  // Phase 2: load tier counts separately (can be slow on cache miss)
  useEffect(() => {
    fetch(`/api/collectors/matches?userId=${profileOwnerId}`)
      .then(r => r.ok ? r.json() : { allScores: [] })
      .then(matchesData => {
        const byTier = new Map<string, TierItem[]>();
        for (const { userId, score, sharedTags } of (matchesData.allScores ?? [])) {
          const label = compatLabel(score);
          const arr = byTier.get(label) ?? [];
          arr.push({ userId, score, sharedTags: sharedTags ?? [] });
          byTier.set(label, arr);
        }
        setTierItems(byTier);
        onTierData?.(byTier);
        setTiersLoaded(true);
      })
      .catch(() => setTiersLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOwnerId]);

  if (!socialLoaded) return (
    <div style={{ padding: "28px 0" }}>
      <div style={{ width: "60%", height: "0.6rem", background: "#f0ede8", marginBottom: "16px" }} />
      <div style={{ display: "flex", gap: "8px" }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 36, height: 36, borderRadius: "50%", background: "#f0ede8" }} />)}
      </div>
    </div>
  );

  return (
    <aside style={{ padding: "28px 0", minWidth: 0 }}>

      {/* Collection Similarity */}
      <div style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: `1px solid ${RULE}` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#0a0a0a", margin: 0 }}>
            Collection Similarity
          </p>
          <span style={{ fontFamily: MONO, fontSize: "0.46rem", color: MUTED, letterSpacing: "0.04em", flexShrink: 0 }}>
            Updated daily
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: "0.52rem", color: MUTED, margin: "0 0 12px", letterSpacing: "0.04em" }}>
          Artist overlap · style boosted
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {TIER_ORDER.map(tier => {
            const items = tierItems.get(tier) ?? [];
            return (
              <div key={tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.64rem", color: activeTier === tier ? ORANGE : MUTED, letterSpacing: "0.04em", lineHeight: 1.4 }}>
                  {tier}
                </span>
                {!tiersLoaded ? (
                  <span style={{ fontFamily: MONO, fontSize: "0.64rem", color: MUTED, flexShrink: 0 }}>—</span>
                ) : items.length > 0 ? (
                  <button
                    onClick={() => onTierClick?.(tier, items)}
                    style={{ fontFamily: MONO, fontSize: "0.64rem", color: activeTier === tier ? ORANGE : "#0a0a0a", flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    {items.length}
                  </button>
                ) : (
                  <span style={{ fontFamily: MONO, fontSize: "0.64rem", color: MUTED, flexShrink: 0 }}>0</span>
                )}
              </div>
            );
          })}
        </div>
      </div>


<Section title="Followers" people={followers} />
      <Section title="Following" people={following} />
    </aside>
  );
}
