import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const autoGen     = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const raw         = profile?.username ?? null;
  const username    = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl   = profile?.avatar_url ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav username={username} displayLabel={displayLabel} avatarUrl={avatarUrl} />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "120px 32px 120px" }}>
        <p style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#bbbbbb",
          margin: "0 0 24px 0",
        }}>
          Library · ライブラリ
        </p>

        <h1 style={{
          fontFamily: SERIF,
          fontSize: "clamp(36px, 6vw, 64px)",
          fontWeight: 400,
          color: "#0d0d0d",
          lineHeight: 1.1,
          margin: "0 0 24px 0",
        }}>
          Coming soon.
        </h1>

        <p style={{
          fontFamily: SERIF,
          fontSize: "clamp(15px, 2vw, 18px)",
          fontStyle: "italic",
          color: "#aaaaaa",
          lineHeight: 1.7,
          margin: 0,
          maxWidth: 480,
        }}>
          Library is where your collection becomes a reference.
          <br />We&rsquo;re still building it.
        </p>
      </main>
    </div>
  );
}
