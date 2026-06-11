import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import WantlistClient from "@/components/wantlist/WantlistClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

export type WantlistItem = {
  id: string;
  discogs_release_id: number;
  catalog: string | null;
  artist: string;
  title: string;
  label: string | null;
  format: string | null;
  released: number | null;
  date_added: string | null;
  cover_image_url: string | null;
};

export default async function WantlistPage({ params }: { params: Params }) {
  const { username: rawHandle } = await params;
  if (!rawHandle.startsWith("@")) notFound();
  const username = rawHandle.slice(1);

  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
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

  const { data: items } = await supabase
    .from("wantlist")
    .select("id, discogs_release_id, catalog, artist, title, label, format, released, date_added, cover_image_url")
    .eq("user_id", profile.id)
    .order("date_added", { ascending: false });

  const wantlistItems: WantlistItem[] = (items ?? []) as WantlistItem[];

  return (
    <div style={{ minHeight: "100vh", background: "#FDF6F0" }}>
      {viewerNav && (
        <AppNav
          username={viewerNav.username}
          displayLabel={viewerNav.displayName ?? undefined}
          avatarUrl={viewerNav.avatarUrl}
        />
      )}
      <WantlistClient
        profileUsername={profile.username ?? username}
        isOwner={isOwner}
        userId={viewer?.id ?? null}
        initialItems={wantlistItems}
      />
    </div>
  );
}
