import Link from "next/link";
import { PUBLICATION, PORTFOLIO_URL } from "@/lib/site";

export const SiteHeader = () => (
  <header className="mast">
    <div className="mast__in wrap">
      <Link className="wordmark" href="/how">{PUBLICATION.name}</Link>
      <nav className="label" aria-label="Publication">
        <Link href="/how#plates">Topics</Link>
        <Link href="/how#collections">Collections</Link>
        <a href={PORTFOLIO_URL}>← Ayush Oli</a>
      </nav>
    </div>
  </header>
);
