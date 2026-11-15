"use client";

import { CV_FILENAME, CV_URL, PORTFOLIO_URL } from "@/lib/site";
import { AyushWorld } from "../world/AyushWorld";
import { Glyph } from "./Glyph";
import { toMonth, useNow, useOs } from "./OsContext";
import { IDENTITY } from "./os-content";
import { APPS, formatDuration, formatMonth, monthIndex } from "./os-engine";

export function Desktop({ hidden }: { hidden: boolean }) {
  const { open } = useOs();
  const now = useNow();
  const uptime = now ? formatDuration(monthIndex(toMonth(now)) - monthIndex(IDENTITY.careerStart)) : "—";

  return (
    <div className="desk" hidden={hidden}>
      <section className="ident" aria-labelledby="ident-name">
        <p className="ident__label"><span className="ident__pulse" aria-hidden="true" />user · {IDENTITY.system.toLowerCase()}</p>
        <h1 className="ident__name" id="ident-name">
          <span className="sr-only">{IDENTITY.system}: </span>{IDENTITY.name}
        </h1>
        <p className="ident__titles">{IDENTITY.titles.map((t, i) => <span key={t}>{i > 0 && <i aria-hidden="true"> · </i>}{t}</span>)}</p>
        <p className="ident__intro">{IDENTITY.intro}</p>
        <dl className="ident__meta">
          <div><dt>Location</dt><dd>{IDENTITY.location} · {IDENTITY.origin}</dd></div>
          <div><dt>Now</dt><dd>{IDENTITY.current}</dd></div>
          <div><dt>Uptime</dt><dd suppressHydrationWarning>{uptime} <span>since {formatMonth(IDENTITY.careerStart)}</span></dd></div>
        </dl>
        <ul className="ident__links">
          <li><a href={CV_URL} download={CV_FILENAME}>CV ↓</a></li>
          <li><a href={IDENTITY.github} target="_blank" rel="noopener">GitHub ↗</a></li>
          <li><a href={IDENTITY.linkedin} target="_blank" rel="noopener">LinkedIn ↗</a></li>
          <li><a href={`mailto:${IDENTITY.email}`}>Email</a></li>
        </ul>
        <a className="ident__classic" href={PORTFOLIO_URL}>← Classic portfolio</a>
      </section>

      <div className="desk__right">
        <nav className="launch" id="os-apps" aria-label="Apps">
          <p className="launch__label">Applications <span>everything opens</span></p>
          <ul className="launch__grid">
            {APPS.map((a, i) => (
              <li key={a.id} style={{ "--i": i } as React.CSSProperties}>
                <button type="button" className="tile" onClick={() => open(a.id)} aria-keyshortcuts={a.key}>
                  <span className="tile__top">
                    <span className="tile__icon"><Glyph app={a.id} size={22} /></span>
                    <kbd className="tile__key" aria-hidden="true">{a.key}</kbd>
                  </span>
                  <span className="tile__name">{a.name}</span>
                  <span className="tile__open" aria-hidden="true">open →</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <AyushWorld />
        <p className="desk__hint">
          <span><kbd>1</kbd>–<kbd>5</kbd> open apps</span>
          <span><kbd>`</kbd> terminal</span>
          <span><kbd>Esc</kbd> close</span>
          <span className="desk__hint-touch">Tap any app to explore</span>
        </p>
      </div>
    </div>
  );
}
