import { createClient } from "@/lib/supabase/server";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import WaitlistSection from "@/components/landing/WaitlistSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let username: string | null = null;
  let displayLabel: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    const emailPrefix = (user.email ?? "").split("@")[0] || "user";
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? emailPrefix;
    displayLabel = profile?.display_name?.trim() || username;
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <LandingNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />
      <HeroSection />
      <WaitlistSection />
      <LandingFooter />
    </main>
  );
}
