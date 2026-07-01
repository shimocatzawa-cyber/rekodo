import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserWithTimeout } from "@/lib/supabase/withTimeout";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const user = await getUserWithTimeout(supabase);
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.username) redirect("/onboarding");
  redirect(`/@${profile.username}`);
}
