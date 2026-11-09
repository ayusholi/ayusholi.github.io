/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { JOURNEY_URL } from "@/lib/site";
import "@/styles/portfolio.css";

export const viewport: Viewport = { themeColor: "#f3efe6" };

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ayusholi.com.np"),
  title: "Run & Debug — Ayush Oli",
  description: "Run & Debug: a growing collection of things Ayush Oli is building, learning, seeing, and figuring out along the way.",
  alternates: { canonical: JOURNEY_URL },
  icons: { icon: [{ url: "/images/assets/favicon.ico", sizes: "any" }] },
};

// Marks the page as JS-enabled before paint, so reveal styles only apply when
// the script can undo them.
export default function RunDebugLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.classList.add("sb-js");' }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet" />
      </head>
      <body className="run-debug">{children}</body>
    </html>
  );
}
