import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Inter, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { PortfolioProvider } from "@/components/portfolio/PortfolioProvider";
import { PREFERENCES_INIT_SCRIPT } from "@/lib/preferences";
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

export const metadata: Metadata = {
  title: { default: "Virello", template: "%s | Virello" },
  description: "Research public companies from primary sources.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets class/data attributes before React hydrates.
    <html
      lang="en"
      className={`${inter.variable} ${plex.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:p-3"
        >
          Skip to content
        </a>
        <PortfolioProvider>
          <Navbar />
          <main id="main">{children}</main>
        </PortfolioProvider>
      </body>
    </html>
  );
}
