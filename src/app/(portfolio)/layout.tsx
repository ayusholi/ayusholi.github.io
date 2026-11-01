/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/portfolio.css";

const TITLE = "Ayush Oli — Product Engineer, AI";
const SHARE = "https://www.ayusholi.com.np/images/assets/ayush-oli-favicon-512.png";

export const viewport: Viewport = { themeColor: "#FE3602" };

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ayusholi.com.np"),
  title: TITLE,
  description: "Ayush Oli — Product Engineer working on AI. Full stack, from Nepal, based in London.",
  authors: [{ name: "Ayush Oli" }],
  alternates: { canonical: "/" },
  icons: { icon: [{ url: "/images/assets/favicon.ico", sizes: "any" }, { url: "/images/assets/ayush-oli-favicon-512.png", type: "image/png", sizes: "512x512" }], apple: "/images/assets/ayush-oli-favicon-512.png" },
  openGraph: {
    type: "website", siteName: "Ayush Oli", url: "/", title: TITLE,
    description: "Full-stack product engineer working on AI. From Nepal, based in London. Projects, experience, and an interactive look under the hood.",
    images: [{ url: SHARE, width: 512, height: 512, alt: "AO monogram in black on yellow" }],
  },
  twitter: { card: "summary", title: TITLE, description: "Full-stack product engineer working on AI. From Nepal, based in London.", images: [SHARE] },
};

// Runs before first paint. Sets the saved theme, and the state the entrance
// animations start from, so the server-rendered page doesn't flash.
const BEFORE_PAINT = `(function () {
  var r = document.documentElement, t = null;
  try { t = localStorage.getItem("theme"); } catch (e) {}
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  r.setAttribute("data-theme", t);
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) r.classList.add("js-anim");
})();`;

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BEFORE_PAINT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400..700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
