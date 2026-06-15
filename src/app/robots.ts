import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/@"],
        disallow: [
          "/collection",
          "/dig",
          "/deep-dive",
          "/insights",
          "/selects",
          "/archetypes",
          "/settings",
          "/onboarding",
          "/admin",
          "/api/",
        ],
      },
    ],
    sitemap: "https://rekodo.co/sitemap.xml",
  };
}
