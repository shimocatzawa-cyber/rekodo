import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import CommunityClient from "@/components/community/CommunityClient";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle() as unknown as {
      data: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
    };

  if (!profile) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav
        username={profile.username}
        displayLabel={profile.display_name ?? undefined}
        avatarUrl={profile.avatar_url}
      />
      <CommunityClient
        profileId={profile.id}
        username={profile.username}
        displayName={profile.display_name ?? undefined}
        avatarUrl={profile.avatar_url ?? undefined}
      />
    </div>
  );
}
