import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WaitlistAdminClient from "./WaitlistAdminClient";

export default async function WaitlistAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: entries, error } = await supabase
    .from("waitlist_emails")
    .select("id, email, name, est_collection_size, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "12px", color: "#cc2200" }}>
          Failed to load waitlist data.
        </p>
      </div>
    );
  }

  return <WaitlistAdminClient entries={entries ?? []} />;
}
