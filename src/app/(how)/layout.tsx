import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MotionRoot } from "@/components/ui/MotionRoot";
import { fontClasses } from "@/lib/fonts";
import { PUBLICATION } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ayusholi.com.np"),
  title: { default: `${PUBLICATION.name} — Ayush Oli`, template: `%s · ${PUBLICATION.name} — Ayush Oli` },
  description: "Interactive simulations of how Redis, Kafka and the systems behind modern software actually work. Watch it happen, then break it.",
  openGraph: { type: "website", siteName: "Ayush Oli", title: PUBLICATION.name, description: `${PUBLICATION.tagline} Interactive simulations of the systems behind modern software.` },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontClasses}>
      <body>
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
