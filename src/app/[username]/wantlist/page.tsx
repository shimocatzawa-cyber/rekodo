import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import WantlistClient from "@/components/wantlist/WantlistClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

export default async function WantlistPage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;
  if (!rawHandle.startsWith("@")) notFound();
  const username = rawHandle.slice(1);

  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_supporter")
    .eq("username", username)
    .maybeSingle() as { data: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null; is_supporter?: boolean | null } | null };

  if (!profile) notFound();

  const isOwner     = viewer?.id === profile.id;
  const isSupporter = !!profile.is_supporter;

  let viewerNav: { username: string; displayName: string | null; avatarUrl: string | null } | null = null;
  if (viewer) {
    if (isOwner) {
      viewerNav = { username: profile.username ?? "", displayName: profile.display_name ?? null, avatarUrl: profile.avatar_url ?? null };
    } else {
      const { data: vp } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", viewer.id).maybeSingle();
      if (vp?.username) viewerNav = { username: vp.username, displayName: vp.display_name ?? null, avatarUrl: vp.avatar_url ?? null };
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDF6F0" }}>
      {viewerNav && (
        <AppNav
          username={viewerNav.username}
          displayLabel={viewerNav.displayName ?? undefined}
          avatarUrl={viewerNav.avatarUrl}
        />
      )}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        <div style={{ marginBottom: "2rem", borderBottom: "1px solid #e0e0da", paddingBottom: "1.5rem" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#CC5500", margin: "0 0 8px" }}>
            @{username}
          </p>
          <h1 style={{ fontFamily: "var(--font-editorial)", fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0a0a0a", margin: 0, lineHeight: 1 }}>
            Wantlist
          </h1>
        </div>
        <WantlistClient
          isOwner={isOwner}
          isSupporter={isSupporter}
          userId={viewer?.id ?? null}
        />
      </div>
    </div>
  );
}
