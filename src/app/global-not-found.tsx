import type { Metadata } from "next";
import { fontClasses } from "@/lib/fonts";
import { NotFoundPage } from "@/templates/how/NotFoundPage";
import "./(how)/globals.css";

export const metadata: Metadata = { title: "Not found — Ayush Oli" };

// The whole site has one 404. It sits outside the root layouts, so it brings its own.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontClasses}>
      <body><NotFoundPage /></body>
    </html>
  );
}
