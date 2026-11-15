import { OsShell } from "@/features/os/OsShell";
import { PORTFOLIO_URL } from "@/lib/site";

// AYUSH.OS: the whole page is one interactive shell. The noscript fallback
// keeps the portfolio reachable without JavaScript.
export const OsPage = () => (
  <>
    <OsShell />
    <noscript>
      <p className="os-noscript">AYUSH.OS needs JavaScript. <a href={PORTFOLIO_URL}>Read the portfolio instead →</a></p>
    </noscript>
  </>
);
