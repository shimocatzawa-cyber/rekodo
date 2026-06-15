import type { Metadata } from "next";
import { Shippori_Mincho, DM_Mono, Caveat } from "next/font/google";
import "./globals.css";

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
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
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${shipporiMincho.variable} ${dmMono.variable} ${caveat.variable} h-full`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-black antialiased">
        {children}
      </body>
    </html>
  );
}
