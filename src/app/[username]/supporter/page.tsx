import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SupporterContent from "@/components/profile/SupporterContent";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

export default async function SupporterPage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;
  if (!rawHandle.startsWith("@")) notFound();
  const username = rawHandle.slice(1);

  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_donor")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;

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
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      {viewerNav && (
        <AppNav
          username={viewerNav.username}
          displayLabel={viewerNav.displayName ?? undefined}
          avatarUrl={viewerNav.avatarUrl}
        />
      )}
      <SupporterContent
        isOwner={isOwner}
        isSupporter={!!profile.is_donor}
      />
    </div>
  );
}
