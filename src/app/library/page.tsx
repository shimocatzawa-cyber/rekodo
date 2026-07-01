import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LibraryClient from "@/components/library/LibraryClient";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, subscription_tier, role")
    .eq("id", user.id)
    .maybeSingle();

  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw          = profile?.username ?? null;
  const username     = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;
  const supporter    = ["plus", "premium", "supporter"].includes(profile?.subscription_tier ?? "") || profile?.role === "admin";

  return (
    <LibraryClient
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      isSupporter={supporter}
    />
  );
}
