import Link from "next/link";
import { HOW_URL, PUBLICATION, PORTFOLIO_URL } from "@/lib/site";

export const SiteHeader = () => (
  <header className="mast">
    <div className="mast__in wrap">
      <Link className="wordmark" href={HOW_URL}>{PUBLICATION.name}</Link>
      <nav className="label" aria-label="Publication">
        <Link href={`${HOW_URL}#plates`}>Topics</Link>
        <Link href={`${HOW_URL}#collections`}>Collections</Link>
        <a href={PORTFOLIO_URL}>← Ayush Oli</a>
      </nav>
    </div>
  </header>
);
