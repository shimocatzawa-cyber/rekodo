import type { MetadataRoute } from "next";

// Profiles and lists are members-only — no dynamic URLs in the sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://rekodo.co";

  return [
    { url: base,                   lastModified: new Date(), changeFrequency: "weekly",  priority: 1   },
    { url: `${base}/about`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/login`,        lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/signup`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
    { url: `${base}/privacy`,      lastModified: new Date(), changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/terms`,        lastModified: new Date(), changeFrequency: "yearly",  priority: 0.2 },
  ];
}
