"use client";

import { CV_FILENAME, CV_URL, PORTFOLIO_URL } from "@/lib/site";
import { Glyph } from "./Glyph";
import { toMonth, useNow, useOs } from "./OsContext";
import { FEATURED, IDENTITY, PHASES, PRODUCTS, PROJECTS } from "./os-content";
import { APPS, appName, currentTitle, formatDuration, formatMonth, formatRange, mainRoles, monthIndex } from "./os-engine";

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
        <dl className="ident__stats">
          <div><dt>Engineers led</dt><dd>18–22</dd></div>
          <div><dt>Client projects</dt><dd>{PROJECTS.length}</dd></div>
          <div><dt>Own products</dt><dd>{PRODUCTS.length}</dd></div>
        </dl>
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
                  <span className="tile__blurb">{a.blurb}</span>
                  <span className="tile__open" aria-hidden="true">open →</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="desk__row">
          <CareerTrace />
          <section className="start" aria-labelledby="start-title">
            <h2 className="start__cap" id="start-title"><span>Start here</span> strongest stories</h2>
            <ul className="start__list">
              {FEATURED.map((f) => (
                <li key={f.id}>
                  <button type="button" className="start__item" onClick={() => open(f.app, f.id)}>
                    <span className="start__app">{appName(f.app)}</span>
                    <strong>{f.title}</strong>
                    <small>{f.line}</small>
                    <span className="start__go" aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
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

// ---------- The career trace: the desktop's one animated element ----------

const START = monthIndex(IDENTITY.careerStart);
const END = monthIndex({ y: 2026, m: 12 });
const W = 1000, H = 120;
const xOf = (mi: number) => 16 + ((mi - START) / (END - START)) * (W - 48);
const LEVEL_Y = [92, 72, 50, 30];

// A step line that rises one level per career phase, with a node per chapter.
function CareerTrace() {
  const { open } = useOs();
  const roles = mainRoles();
  const levelAt = (mi: number) => Math.max(0, PHASES.findIndex((p) => mi >= monthIndex(p.start) && mi <= monthIndex(p.end)));
  const steps = PHASES.flatMap((p, i) => {
    const x0 = xOf(monthIndex(p.start)), x1 = xOf(monthIndex(p.end)), y = LEVEL_Y[i] ?? 30;
    return i === 0 ? [`M${x0},${y}`, `H${x1}`] : [`V${y}`, `H${x1}`];
  }).join(" ");
  const years = Array.from({ length: 10 }, (_, i) => 2017 + i);
  const branches = roles.filter((r) => r.kind === "parallel").map((r) => {
    const x0 = xOf(monthIndex(r.start)), x1 = xOf(monthIndex(r.end)), y = LEVEL_Y[levelAt(monthIndex(r.start))] ?? 30;
    return `M${x0},${y} V${y + 16} H${x1} V${y}`;
  });

  return (
    <figure className="trace" aria-labelledby="trace-cap">
      <figcaption id="trace-cap" className="trace__cap">
        <span>System trace</span> career, {formatMonth(IDENTITY.careerStart)} → now
      </figcaption>
      <div className="trace__plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {years.map((y) => {
            const x = xOf(monthIndex({ y, m: 1 }));
            return x >= 0 ? <line key={y} className="trace__grid" x1={x} x2={x} y1={10} y2={H - 6} /> : null;
          })}
          {branches.map((d) => <path key={d} className="trace__branch" d={d} />)}
          <path className="trace__line" d={steps} />
        </svg>
        {years.map((y) => {
          const x = xOf(monthIndex({ y, m: 1 }));
          return x >= 0 ? <span key={y} className="trace__year" style={{ left: `${(x / W) * 100}%` }} aria-hidden="true">{y}</span> : null;
        })}
        <span className="trace__now" style={{ left: `${(xOf(END - 1) / W) * 100}%`, top: `${((LEVEL_Y[3] ?? 30) / H) * 100}%` }} aria-hidden="true" />
        <ol className="trace__nodes">
          {roles.map((r) => {
            const mi = monthIndex(r.start), lvl = levelAt(mi);
            const y = r.kind === "parallel" ? (LEVEL_Y[lvl] ?? 30) + 16 : LEVEL_Y[lvl] ?? 30;
            return (
              <li key={r.id} style={{ left: `${(xOf(mi) / W) * 100}%`, top: `${(y / H) * 100}%` }}>
                <button type="button" className="trace__node" data-kind={r.kind} onClick={() => open("career", r.id)}
                  aria-label={`${r.org}, ${currentTitle(r)}, ${formatRange(r.start, r.end)}`}>
                  <span className="trace__tip" aria-hidden="true"><strong>{r.org}</strong>{formatRange(r.start, r.end)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}
