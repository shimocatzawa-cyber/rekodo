import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ListsHub from "@/components/lists/ListsHub";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const supabase = await createClient();
  const user = await getUserWithTimeout(supabase);
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_supporter, is_donor, role")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: { id: string; username: string; display_name: string | null; avatar_url: string | null; is_supporter: boolean | null; is_donor: boolean | null; role: string | null } | null };

  if (!profile) redirect("/login");

  return (
    <ListsHub
      profileId={profile.id}
      username={profile.username}
      displayLabel={profile.display_name ?? undefined}
      avatarUrl={profile.avatar_url}
      isSupporter={!!(profile.is_supporter || profile.is_donor || profile.role === "admin")}
      isAdmin={profile.role === "admin"}
    />
  );
}
