import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans, Inter, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { Footer, Navbar, SectionFrame, visibleSections } from "@/features/shell";
import { PREFERENCES_INIT_SCRIPT } from "@/features/appearance";
import "./globals.css";

// Inter is the default and is preloaded. The alternates are not preloaded, so the browser only
// downloads them when a visitor actually picks that typeface.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
  preload: false,
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  preload: false,
});

// Feature flags come from environment variables at request time, so pages must not be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Virello", template: "%s | Virello" },
  description: "Crypto market data and official filings, shown as published.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The proxy makes a fresh nonce per request; the inline script must carry it or the browser refuses it.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning: the script below sets class/data attributes before React hydrates.
    <html
      lang="en"
      className={`${inter.variable} ${plex.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PREFERENCES_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main"
          className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:p-3"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="flex-1">
          {/* Adds the sidebar when the page belongs to a section with several pages. */}
          <SectionFrame sections={visibleSections()}>{children}</SectionFrame>
        </main>
        <Footer />
      </body>
    </html>
  );
}
