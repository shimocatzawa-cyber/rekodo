import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AboutClient from "@/components/about/AboutClient";

export const metadata: Metadata = {
  title: "Support rekōdo",
  description:
    "rekōdo is independent, ad-free, and built by people who own too many records. Support the project with a monthly subscription or a one-off donation.",
  alternates: { canonical: "https://rekodo.co/about" },
  openGraph: {
    title: "Support rekōdo",
    description:
      "rekōdo is independent, ad-free, and built by people who own too many records. Support the project and unlock perks for serious collectors.",
    url: "https://rekodo.co/about",
  },
};

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { success } = await searchParams;
  const paymentSuccess =
    success === "subscription" || success === "donation" ? success : null;

  let username: string | null = null;
  let displayLabel: string | null = null;
  let avatarUrl: string | null = null;
  let isSubscriber = false;
  let isDonor      = false;

  if (user) {
    const emailPrefix = (user.email ?? "").split("@")[0] || "user";
    type ProfileRow = {
      username: string | null; display_name: string | null;
      avatar_url: string | null; is_donor: boolean | null; is_supporter: boolean | null;
    };
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("username, display_name, avatar_url, is_donor, is_supporter")
      .eq("id", user.id)
      .maybeSingle() as { data: ProfileRow | null };

    const autoGen = `${emailPrefix}_${user.id.slice(0, 6)}`;
    const raw = profile?.username ?? null;
    username     = (raw && raw !== autoGen) ? raw : (profile?.display_name?.trim() || emailPrefix);
    displayLabel = profile?.display_name?.trim() || username;
    avatarUrl    = profile?.avatar_url ?? null;
    isSubscriber = !!profile?.is_supporter;
    isDonor      = !!profile?.is_donor;
  }

  return (
    <AboutClient
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      isOwner={!!user}
      isSubscriber={isSubscriber}
      isDonor={isDonor}
      userId={user?.id}
      success={paymentSuccess}
    />
  );
}
