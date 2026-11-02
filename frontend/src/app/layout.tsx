import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { PortfolioProvider } from "@/components/portfolio/PortfolioProvider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: { default: "FinTk", template: "%s | FinTk" },
  description: "Search financial data without the news noise.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans text-black antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:bg-white focus:p-3"
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
