import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// force-dynamic prevents build-time static generation (which would hang if
// Supabase is down). unstable_cache below provides the 24h caching instead.
export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function deadline<T>(ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(fallback), ms));
}

const getDynamicRoutes = unstable_cache(
  async (): Promise<{ profileRoutes: MetadataRoute.Sitemap; listRoutes: MetadataRoute.Sitemap }> => {
    const supabase = serviceClient();
    const base = "https://rekodo.co";

    const [profilesResult, listsResult] = await Promise.all([
      Promise.race([
        supabase.from("profiles").select("username").not("username", "is", null).limit(1000),
        deadline(10000, { data: null }),
      ]),
      Promise.race([
        supabase.from("lists").select("slug, user_id, profiles!inner(username)").eq("is_public", true).limit(5000),
        deadline(10000, { data: null }),
      ]),
    ]);

    const profileRoutes: MetadataRoute.Sitemap = ((profilesResult.data ?? []) as { username: string }[]).map((p) => ({
      url: `${base}/@${p.username}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const listRoutes: MetadataRoute.Sitemap = ((listsResult.data ?? []) as { slug: string; profiles: unknown }[]).flatMap((l) => {
      const profile = l.profiles as { username: string } | null;
      if (!profile?.username) return [];
      return [{ url: `${base}/p/${profile.username}/${l.slug}`, changeFrequency: "monthly" as const, priority: 0.7 }];
    });

    return { profileRoutes, listRoutes };
  },
  ["sitemap-dynamic-routes"],
  { revalidate: 86400 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://rekodo.co";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const { profileRoutes, listRoutes } = await getDynamicRoutes();
    return [...staticRoutes, ...profileRoutes, ...listRoutes];
  } catch {
    return staticRoutes;
  }
}
