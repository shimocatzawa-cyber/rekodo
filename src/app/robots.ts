import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/login", "/signup", "/privacy", "/terms"],
        disallow: [
          "/@",
          "/p/",
          "/collection",
          "/dig",
          "/deep-dive",
          "/insights",
          "/selects",
          "/archetypes",
          "/settings",
          "/onboarding",
          "/admin",
          "/digital",
          "/api/",
        ],
      },
    ],
    sitemap: "https://rekodo.co/sitemap.xml",
  };
}
