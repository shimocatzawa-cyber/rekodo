import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/app/admin/lib";
import SpotlightsAdminClient from "./SpotlightsAdminClient";
import type { Spotlight } from "@/lib/spotlights/types";

export const dynamic = "force-dynamic";

export default async function SpotlightsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const adminDb = getAdminDb();
  const { data } = await (adminDb as any)
    .from("spotlights")
    .select("*")
    .order("month", { ascending: false });

  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: "48px 40px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <a
          href="/admin"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#aaa", textDecoration: "none" }}
        >
          ← Admin
        </a>
      </div>
      <SpotlightsAdminClient spotlights={(data ?? []) as Spotlight[]} />
    </div>
  );
}
