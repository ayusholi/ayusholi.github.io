import { PUBLICATION, PORTFOLIO_URL } from "@/lib/site";

export const SiteFooter = () => (
  <footer className="foot">
    <div className="foot__in wrap label">
      <span>{PUBLICATION.name} · Simplified models with their limits stated</span>
      <span>Hand-built by <a href={PORTFOLIO_URL}>Ayush Oli</a></span>
    </div>
  </footer>
);
