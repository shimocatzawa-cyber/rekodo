import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SelectsClient from "@/components/selects/SelectsClient";

export const dynamic = "force-dynamic";

export default async function SelectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const autoGen = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const rawUsername = profile?.username ?? null;
  const username = (rawUsername && rawUsername !== autoGen)
    ? rawUsername
    : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <SelectsClient
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
    />
  );
}
