import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/AppNav";
import DigitalClient from "@/components/digital/DigitalClient";

export const metadata: Metadata = {
  title: "Digital",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export type DigitalImport = {
  id: string;
  artist: string;
  album: string;
  purchased_at: string | null;
  item_url: string | null;
  release_date: string | null;
  label: string | null;
  tags: string[] | null;
  source: string;
};

export default async function DigitalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [importsRes, navProfileRes] = await Promise.all([
    supabase
      .from("digital_imports")
      .select("id, artist, album, purchased_at, item_url, release_date, label, tags, source")
      .eq("user_id", user.id)
      .or("is_duplicate.is.null,is_duplicate.eq.false")
      .order("artist", { ascending: true })
      .order("album", { ascending: true }),
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url, bandcamp_username")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const navProfile = navProfileRes.data;
  const imports = (importsRes.data ?? []) as DigitalImport[];
  const hasBandcampUsername = !!navProfile?.bandcamp_username;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav
        username={navProfile?.username ?? ""}
        displayLabel={navProfile?.display_name ?? undefined}
        avatarUrl={navProfile?.avatar_url ?? null}
      />
      <DigitalClient
        imports={imports}
        hasBandcampUsername={hasBandcampUsername}
      />
    </div>
  );
}
