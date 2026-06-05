import type { Metadata } from "next";
import { Shippori_Mincho, DM_Mono, Noto_Sans_JP, Caveat } from "next/font/google";
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

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "rekōdo — Your records say everything about you",
  description:
    "The music identity app for serious vinyl collectors. Catalogue your collection, build your lists, and let your records speak.",
  metadataBase: new URL("https://rekodo.co"),
  openGraph: {
    title: "rekōdo",
    description: "Your records say everything about you",
    url: "https://rekodo.co",
    siteName: "rekōdo",
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
      className={`${shipporiMincho.variable} ${dmMono.variable} ${notoSansJP.variable} ${caveat.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-white text-black antialiased">
        {children}
      </body>
    </html>
  );
}
