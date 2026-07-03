import type { Metadata } from "next";
import { Shippori_Mincho, DM_Mono, Caveat, Noto_Sans_JP } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { SpotifyPlayerProvider } from "@/components/SpotifyPlayerProvider";
import PageViewTracker from "@/components/PageViewTracker";
import TimezoneSetter from "@/components/TimezoneSetter";
import "./globals.css";

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rekodo.co"),
  title: {
    default: "rekōdo — Your records say everything about you",
    template: "%s — rekōdo",
  },
  description:
    "The music identity platform for serious vinyl collectors. Catalogue your collection, discover your taste archetype, explore artist deep dives, and share curated lists.",
  applicationName: "rekōdo",
  authors: [{ name: "rekōdo", url: "https://rekodo.co" }],
  creator: "rekōdo",
  keywords: [
    "vinyl collection app", "record collector", "music identity", "vinyl tracking",
    "Discogs alternative", "record collection manager", "music taste profile",
    "vinyl archetype", "record recommendations", "collector community",
  ],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "rekōdo — Your records say everything about you",
    description:
      "The music identity platform for serious vinyl collectors. Catalogue your collection, discover your taste archetype, and share curated lists.",
    url: "https://rekodo.co",
    siteName: "rekōdo",
    images: [
      {
        url: "/rekodo-record-spinner.png",
        width: 800,
        height: 800,
        alt: "rekōdo — vinyl collection app",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "rekōdo — Your records say everything about you",
    description:
      "The music identity platform for serious vinyl collectors. Catalogue your collection, discover your taste archetype, and share curated lists.",
    images: ["/rekodo-record-spinner.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: "https://rekodo.co",
  },
  verification: {
    google: "kMpeXcCUB13vm-WVWPIU7SJpQqYfPTyXqcNYNZ_ii94",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, locale] = await Promise.all([getMessages(), getLocale()]);
  return (
    <html
      lang={locale}
      className={`${shipporiMincho.variable} ${dmMono.variable} ${caveat.variable} ${notoSansJp.variable} h-full`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-black antialiased">
        <PageViewTracker />
        <TimezoneSetter />
        <NextIntlClientProvider messages={messages}>
          <SpotifyPlayerProvider>
            {children}
          </SpotifyPlayerProvider>
        </NextIntlClientProvider>
        {process.env.NEXT_PUBLIC_AMAZON_ONELINK_ID && (
          <Script
            src={`//z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US&adInstanceId=${process.env.NEXT_PUBLIC_AMAZON_ONELINK_ID}`}
            strategy="afterInteractive"
          />
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
