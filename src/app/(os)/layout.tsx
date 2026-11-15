import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MotionRoot } from "@/components/ui/MotionRoot";
import { fontClasses } from "@/lib/fonts";
import "@/styles/os.css";

// AYUSH.OS has its own root layout, so its dark system never touches the
// portfolio's styles, and theirs never reach it.
export const viewport: Viewport = { themeColor: "#0e0b0a", colorScheme: "dark" };

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ayusholi.com.np"),
  title: "AYUSH.OS — Ayush Oli",
  description: "An interactive engineering portfolio: career, case studies, stack, engineering decisions and independent products, explored like an operating system.",
  alternates: { canonical: "/the-terminal/" },
  icons: { icon: [{ url: "/images/assets/favicon.ico", sizes: "any" }] },
  openGraph: {
    type: "website", siteName: "Ayush Oli", url: "/the-terminal/", title: "AYUSH.OS — Ayush Oli",
    description: "Senior Software Engineer · Technical Leader · Product Builder. Explore the career like an operating system.",
  },
};

export default function OsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontClasses}>
      <body className="os-body">
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
