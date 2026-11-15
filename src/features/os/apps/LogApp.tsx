"use client";

import { useOs } from "../OsContext";
import { LOG } from "../os-content";
import { logById, projectById, techFor } from "../os-engine";
import type { LogEntry } from "../os-types";
import { Block, Panes, TechChips } from "./parts";

const STATUS: Record<LogEntry["status"], string> = { resolved: "Resolved", documented: "Documented" };

export function LogApp() {
  const { state, select } = useOs();
  const current = state.selection.log ? logById(state.selection.log) : undefined;

  const list = (
    <>
      <p className="query" aria-hidden="true"><span>$</span> tail engineering.log</p>
      <ul className="rows">
        {LOG.map((l) => (
          <li key={l.id}>
            <button type="button" className="row row--log" aria-current={current?.id === l.id || undefined} onClick={() => select("log", l.id)}>
              <span className="row__n">{l.id.toUpperCase()}</span>
              <span className="row__main"><strong>{l.title}</strong><small>{l.system} · {l.type}</small></span>
              <span className="row__status" data-status={l.status}>{STATUS[l.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className="app app--panes">
      <Panes list={list} showDetail={!!current} onBack={() => select("log", undefined)} backLabel="All entries"
        detail={current ? <Entry l={current} key={current.id} /> : (
          <div className="empty">
            <p className="empty__big">{LOG.length}<span> entries</span></p>
            <p>Constraints, decisions and outcomes from real projects, written up like incident reports.</p>
          </div>
        )} />
    </div>
  );
}

function Entry({ l }: { l: LogEntry }) {
  const { open } = useOs();
  const project = l.projectId ? projectById(l.projectId) : undefined;
  return (
    <article className="detail report" aria-labelledby={`log-${l.id}`}>
      <header className="report__head">
        <dl className="report__fields">
          <div><dt>ID</dt><dd>{l.id.toUpperCase()}</dd></div>
          <div><dt>System</dt><dd>{l.system}</dd></div>
          <div><dt>Type</dt><dd>{l.type}</dd></div>
          <div><dt>Status</dt><dd className="row__status" data-status={l.status}>{STATUS[l.status]}</dd></div>
        </dl>
        <h3 className="detail__title" id={`log-${l.id}`}>{l.title}</h3>
      </header>
      <p className="detail__lead">{l.summary}</p>
      <Block label="Context" items={l.context} />
      <Block label="Constraints" items={l.constraints} />
      <Block label="Approach" items={l.approach} />
      {l.diagram === "excitation" && <ExcitationDiagram />}
      <Block label="Outcome" items={l.outcome} />
      {project && <TechChips techs={techFor(project.id)} />}
      {project && (
        <button type="button" className="xref" onClick={() => open("projects", project.id)}>
          Open the {project.name} case study <span aria-hidden="true">→</span>
        </button>
      )}
    </article>
  );
}

// The parts of Excitation's platform that Ayush built or integrated. Deliberately
// not a full architecture: only components that are stated.
function ExcitationDiagram() {
  const channels = ["Facebook", "Instagram", "SMS", "Email", "Phone calls", "Contact forms"];
  const modules = ["Notifications", "Scheduling", "Automation"];
  const edges = ["Twilio", "Workato · Ruby", "Website plugins"];
  return (
    <figure className="diagram">
      <svg viewBox="0 0 640 300" role="img" aria-labelledby="exc-cap">
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" className="dg__arrowhead" /></marker>
        </defs>
        <text x="16" y="22" className="dg__label">CHANNELS</text>
        {channels.map((c, i) => (
          <g key={c}>
            <rect x="16" y={34 + i * 34} width="118" height="26" className="dg__box" />
            <text x="26" y={51 + i * 34} className="dg__text">{c}</text>
            <path d={`M134,${47 + i * 34} C170,${47 + i * 34} 170,130 196,130`} className="dg__wire" markerEnd="url(#arr)" />
          </g>
        ))}
        <text x="198" y="22" className="dg__label">PLATFORM</text>
        <rect x="198" y="34" width="264" height="40" className="dg__box dg__box--hi" />
        <text x="212" y="58" className="dg__text">Next.js frontend</text>
        <rect x="198" y="88" width="264" height="122" className="dg__box dg__box--hi" />
        <text x="212" y="108" className="dg__text dg__text--dim">Go · Express microservices</text>
        {modules.map((mod, i) => (
          <g key={mod}>
            <rect x={206 + i * 86} y="122" width="84" height="30" className="dg__box dg__box--mod" />
            <text x={248 + i * 86} y="141" textAnchor="middle" className="dg__text dg__text--sm">{mod}</text>
          </g>
        ))}
        <rect x="208" y="166" width="248" height="30" className="dg__box dg__box--mod" />
        <text x="332" y="185" textAnchor="middle" className="dg__text dg__text--sm">RabbitMQ · message broker</text>
        <text x="494" y="22" className="dg__label">INTEGRATIONS</text>
        {edges.map((e, i) => (
          <g key={e}>
            <rect x="494" y={88 + i * 42} width="130" height="28" className="dg__box" />
            <text x="504" y={106 + i * 42} className="dg__text">{e}</text>
            <path d={`M462,150 C478,150 476,${102 + i * 42} 492,${102 + i * 42}`} className="dg__wire" markerEnd="url(#arr)" />
          </g>
        ))}
        <rect x="16" y="252" width="608" height="32" className="dg__box dg__box--infra" />
        <text x="30" y="272" className="dg__text">Infrastructure: DigitalOcean · Nginx, built from scratch</text>
      </svg>
      <figcaption id="exc-cap">Components I built or integrated, simplified. Not a complete architecture diagram.</figcaption>
    </figure>
  );
}
