import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DigClient from "@/components/dig/DigClient";

export const metadata: Metadata = {
  title: "Dig",
  description: "AI-powered record recommendations based on your collection and taste profile.",
  robots: { index: false, follow: false },
};

export default async function DigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const emailPrefix = (user.email ?? "").split("@")[0] || "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const autoGen      = `${emailPrefix}_${user.id.slice(0, 6)}`;
  const rawUsername  = profile?.username ?? null;
  const username     = (rawUsername && rawUsername !== autoGen)
    ? rawUsername
    : (profile?.display_name?.trim() || emailPrefix);
  const displayLabel = profile?.display_name?.trim() || username;
  const avatarUrl    = profile?.avatar_url ?? null;

  // Collection count
  const { count: collectionCount } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Quiz profile (active, non-archived) — for users with no collection yet
  let hasQuizProfile = false;
  if ((collectionCount ?? 0) === 0) {
    const { data: quizRow } = await (supabase as any)
      .from("user_quiz_profile")
      .select("id")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .maybeSingle() as { data: { id: string } | null };
    hasQuizProfile = !!quizRow;
  }

  // Top 5 lists count
  const { data: listsRaw } = await supabase
    .from("lists")
    .select("id, list_type")
    .eq("user_id", user.id);

  const listsCount = (listsRaw ?? []).filter(
    (l) => !l.list_type || l.list_type === "top5"
  ).length;

  // Distinct styles across the collection — powers the Style Dig tab
  const { data: styleLinks } = await supabase
    .from("user_records")
    .select("record_id")
    .eq("user_id", user.id)
    .limit(5000);

  const styleRecordIds = (styleLinks ?? []).map((l) => l.record_id);
  const styleSet = new Set<string>();
  for (let i = 0; i < styleRecordIds.length; i += 400) {
    const { data: styleRows } = await supabase
      .from("records")
      .select("styles")
      .in("id", styleRecordIds.slice(i, i + 400));
    for (const r of styleRows ?? []) {
      for (const s of r.styles ?? []) if (s) styleSet.add(s);
    }
  }
  const availableStyles = [...styleSet].sort();

  return (
    <DigClient
      username={username}
      displayLabel={displayLabel}
      avatarUrl={avatarUrl}
      collectionCount={collectionCount ?? 0}
      listsCount={listsCount}
      availableStyles={availableStyles}
      hasQuizProfile={hasQuizProfile}
    />
  );
}
