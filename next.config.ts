import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const csp = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for hydration scripts; GTM/GA/Amazon/Spotify SDK are external
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://z-na.amazon-adsystem.com https://sdk.scdn.co",
  "style-src 'self' 'unsafe-inline'",
  // Images are mostly proxied through /api/image-proxy, but direct Supabase/Discogs/Spotify CDN loads still occur
  // Last.fm album art (lastfm.freetls.fastly.net) and iTunes artwork (*.mzstatic.com) needed for deep dive rankings
  "img-src 'self' data: blob: https://*.supabase.co https://i.discogs.com https://img.discogs.com https://a.discogs.com https://i.scdn.co https://mosaic.scdn.co https://www.google-analytics.com https://lastfm.freetls.fastly.net https://*.mzstatic.com https://upload.wikimedia.org https://f4.bcbits.com",
  // next/font/google self-hosts fonts under /_next/static/
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.spotify.com wss://*.spotify.com https://*.scdn.co wss://*.scdn.co https://api.discogs.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://vitals.vercel-insights.com",
  "media-src 'self' blob: https://*.scdn.co",
  "frame-src https://sdk.scdn.co https://bandcamp.com",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), display-capture=(), payment=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
