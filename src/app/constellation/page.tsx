import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConstellationPOC from "@/components/constellation/ConstellationPOC";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Collection Constellation – rekōdo",
  robots: "noindex, nofollow",
};

export default async function ConstellationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("username, is_supporter, is_donor, role, subscription_tier")
    .eq("id", user.id)
    .maybeSingle() as { data: { username?: string | null; is_supporter?: boolean; is_donor?: boolean; role?: string | null; subscription_tier?: string | null } | null };

  const isSupporter =
    profile?.is_supporter ||
    profile?.is_donor ||
    profile?.role === "admin" ||
    ["plus", "premium", "supporter"].includes(profile?.subscription_tier ?? "");

  if (!isSupporter) redirect("/about");

  const username = profile?.username ?? undefined;

  return <ConstellationPOC username={username} />;
}
