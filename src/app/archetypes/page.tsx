import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArchetypesClient from "@/components/archetypes/ArchetypesClient";
import SupporterGate from "@/components/SupporterGate";

export const metadata: Metadata = {
  title: "Archetypes",
  description: "Discover what your vinyl collection says about you.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ArchetypesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("username, display_name, avatar_url, is_supporter")
    .eq("id", user.id)
    .maybeSingle() as { data: { username?: string | null; display_name?: string | null; avatar_url?: string | null; is_supporter?: boolean | null } | null };

  const username = profile?.username ?? user.email?.split("@")[0] ?? "user";
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl = profile?.avatar_url ?? null;

  if (!profile?.is_supporter) {
    return <SupporterGate username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} feature="Archetypes" />;
  }

  return (
    <ArchetypesClient
      userId={user.id}
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
    />
  );
}
