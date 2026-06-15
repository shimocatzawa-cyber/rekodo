import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://rekodo.co";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  try {
    const supabase = await createClient();

    // Public profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("username")
      .not("username", "is", null)
      .limit(1000);

    const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
      url: `${base}/@${p.username}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Public lists
    const { data: lists } = await supabase
      .from("lists")
      .select("slug, user_id, profiles!inner(username)")
      .eq("is_public", true)
      .limit(5000);

    const listRoutes: MetadataRoute.Sitemap = (lists ?? []).flatMap((l) => {
      const profile = l.profiles as unknown as { username: string } | null;
      if (!profile?.username) return [];
      return [{
        url: `${base}/@${profile.username}/${l.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }];
    });

    return [...staticRoutes, ...profileRoutes, ...listRoutes];
  } catch {
    return staticRoutes;
  }
}
