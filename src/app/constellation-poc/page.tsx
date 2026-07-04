import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConstellationPOC from "@/components/constellation/ConstellationPOC";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Collection Constellation – shimocatzawa",
  robots: "noindex, nofollow",
};

export default async function ConstellationPOCPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle() as { data: { role?: string | null } | null };

  if (profile?.role !== "admin") redirect("/");

  return <ConstellationPOC username="shimocatzawa" />;
}
