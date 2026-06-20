import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuizFlow from "@/components/quiz/QuizFlow";

export const metadata: Metadata = {
  title: "Taste Quiz — rekōdo",
  robots: { index: false, follow: false },
};

export default async function QuizPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("user_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) redirect("/collection");

  // Already completed the quiz — send to Dig to see their starter picks
  const { data: existingQuiz } = await (supabase as any)
    .from("user_quiz_profile")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle() as { data: { id: string } | null };

  if (existingQuiz) redirect("/dig");

  return <QuizFlow />;
}
