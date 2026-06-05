import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import CollectorsLikeYou from "@/components/collectors/CollectorsLikeYou";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, location, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* ── Minimal settings nav ── */}
      <nav style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 40px", display: "flex", alignItems: "center" }}>
        <a
          href="/"
          aria-label="rekōdo home"
          style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "22px", color: "#CC5500", textDecoration: "none" }}
        >
          ō
        </a>
      </nav>

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
          location={profile.location ?? ""}
          bio={profile.bio ?? ""}
          userId={user.id}
          avatarUrl={profile.avatar_url ?? null}
        />

        <CollectorsLikeYou userId={user.id} currentUserId={user.id} />

      </main>
    </div>
  );
}
