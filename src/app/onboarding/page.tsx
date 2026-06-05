import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, location")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <OnboardingForm
      emailPrefix={emailPrefix}
      currentUsername={profile?.username ?? emailPrefix}
      currentDisplayName={profile?.display_name ?? ""}
      currentLocation={profile?.location ?? ""}
    />
  );
}
