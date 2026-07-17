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
  subsonic_id: string | null;
  source: string;
};

export default async function DigitalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [importsRes, navProfileRes, subsonicRes] = await Promise.all([
    supabase
      .from("digital_imports")
      .select("id, artist, album, purchased_at, item_url, release_date, label, tags, subsonic_id, source")
      .eq("user_id", user.id)
      .or("is_duplicate.is.null,is_duplicate.eq.false")
      .order("artist", { ascending: true })
      .order("album", { ascending: true }),
    // Nav fields in their own query — must never fail
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    // Subsonic fields separately so a missing column doesn't blank the nav
    supabase
      .from("profiles")
      .select("bandcamp_subsonic_username, bandcamp_subsonic_synced_at")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const navProfile = navProfileRes.data;
  const imports = (importsRes.data ?? []) as DigitalImport[];
  const connected = !!(subsonicRes.data?.bandcamp_subsonic_username);
  const syncedAt = subsonicRes.data?.bandcamp_subsonic_synced_at ?? null;
  const subsonicUsername = subsonicRes.data?.bandcamp_subsonic_username ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <AppNav
        username={navProfile?.username ?? ""}
        displayLabel={navProfile?.display_name ?? undefined}
        avatarUrl={navProfile?.avatar_url ?? null}
      />
      <DigitalClient
        imports={imports}
        connected={connected}
        syncedAt={syncedAt}
        subsonicUsername={subsonicUsername}
      />
    </div>
  );
}
