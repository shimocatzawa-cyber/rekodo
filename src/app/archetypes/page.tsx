import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArchetypesClient from "@/components/archetypes/ArchetypesClient";
import SupporterGate from "@/components/SupporterGate";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

export const metadata: Metadata = {
  title: "Archetypes",
  description: "Discover what your vinyl collection says about you.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ArchetypesPage() {
  const supabase = await createClient();
  const user = await getUserWithTimeout(supabase);
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("username, display_name, avatar_url, is_supporter, role")
    .eq("id", user.id)
    .maybeSingle() as { data: { username?: string | null; display_name?: string | null; avatar_url?: string | null; is_supporter?: boolean | null; role?: string | null } | null };

  const username = profile?.username ?? user.email?.split("@")[0] ?? "user";
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl = profile?.avatar_url ?? null;

  const hasAccess = profile?.is_supporter || profile?.role === "admin";
  if (!hasAccess) {
    return <SupporterGate username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} feature="Archetypes" />;
  }

  const isAdmin     = profile?.role === "admin";
  const isSupporter = profile?.is_supporter === true || isAdmin;

  return (
    <ArchetypesClient
      userId={user.id}
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      isAdmin={isAdmin}
      isSupporter={isSupporter}
    />
  );
}
