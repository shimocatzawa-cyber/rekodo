import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import SettingsForm from "./SettingsForm";
import CollectorsLikeYou from "@/components/collectors/CollectorsLikeYou";

const MONO = "var(--font-mono)";
const SERIF = "var(--font-editorial)";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, city, country, country_code, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const autoGen     = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw         = profile.username ?? null;
  const username    = (raw && raw !== autoGen) ? raw : (profile.display_name?.trim() || emailPrefix);
  const displayLabel = profile.display_name?.trim() || username;
  const avatarUrl   = profile.avatar_url ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "64px 40px 80px" }}>

        <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 12px 0" }}>
          Settings
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "30px", fontWeight: 400, color: "#0d0d0d", lineHeight: 1.2, margin: "0 0 48px 0" }}>
          Your profile
        </h1>

        <SettingsForm
          username={profile.username}
          displayName={profile.display_name ?? ""}
          city={profile.city ?? ""}
          country={profile.country ?? ""}
          countryCode={profile.country_code ?? ""}
          bio={profile.bio ?? ""}
          userId={user.id}
          avatarUrl={profile.avatar_url ?? null}
        />

        <CollectorsLikeYou userId={user.id} currentUserId={user.id} />

      </main>
    </div>
  );
}
