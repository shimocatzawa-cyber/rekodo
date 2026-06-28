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
    .select("username, display_name, city, country, country_code")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <OnboardingForm
      emailPrefix={emailPrefix}
      userId={user.id}
      currentUsername={profile?.username ?? emailPrefix}
      currentDisplayName={profile?.display_name ?? ""}
      currentCity={profile?.city ?? ""}
      currentCountry={profile?.country ?? ""}
      currentCountryCode={profile?.country_code ?? ""}
    />
  );
}
