"use client";

import { useState } from "react";
import { useOs } from "../OsContext";
import { PROJECTS } from "../os-content";
import { logById, projectById, roleById, techFor } from "../os-engine";
import type { Project, ProjectKind } from "../os-types";
import { Badge, Block, Panes, TechChips } from "./parts";

type Filter = "all" | "case-study" | "lead";
const FILTERS: [Filter, string, string][] = [
  ["all", "All", ""],
  ["case-study", "Case studies", " WHERE kind = 'case_study'"],
  ["lead", "Led", " WHERE role ~ 'lead|architect'"],
];
const KIND: Record<ProjectKind, string> = { "case-study": "Case study", entry: "Entry" };

const matches = (p: Project, f: Filter) =>
  f === "all" || (f === "case-study" ? p.kind === "case-study" : /lead|architect/i.test(p.role));

export function ProjectsApp() {
  const { state, select } = useOs();
  const [filter, setFilter] = useState<Filter>("all");
  const current = state.selection.projects ? projectById(state.selection.projects) : undefined;
  const rows = PROJECTS.filter((p) => matches(p, filter));
  const where = FILTERS.find(([f]) => f === filter)?.[2] ?? "";

  const list = (
    <>
      <p className="query" aria-hidden="true"><span>SELECT</span> name, client, role <span>FROM</span> projects{where};</p>
      <div className="seg" role="group" aria-label="Filter projects">
        {FILTERS.map(([f, label]) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
        ))}
      </div>
      <p className="rowcount">{rows.length} row{rows.length === 1 ? "" : "s"}</p>
      <ul className="rows">
        {rows.map((p) => (
          <li key={p.id}>
            <button type="button" className="row" aria-current={current?.id === p.id || undefined} onClick={() => select("projects", p.id)}>
              <span className="row__n">{String(PROJECTS.indexOf(p) + 1).padStart(2, "0")}</span>
              <span className="row__main"><strong>{p.name}</strong><small>{p.role}</small></span>
              <span className="row__kind" data-kind={p.kind}>{KIND[p.kind]}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className="app app--panes">
      <Panes list={list} showDetail={!!current} onBack={() => select("projects", undefined)} backLabel="All projects"
        detail={current ? <ProjectDetail p={current} key={current.id} /> : <Empty />} />
    </div>
  );
}

function Empty() {
  const cases = PROJECTS.filter((p) => p.kind === "case-study").length;
  return (
    <div className="empty">
      <p className="empty__big">{PROJECTS.length}<span> records</span></p>
      <p>{cases} full case studies, plus shorter entries. Pick a row to open it.</p>
      <p className="empty__hint">Start with <strong>Broadway Licensing</strong>: around six months of expected work, delivered in two.</p>
    </div>
  );
}

function ProjectDetail({ p }: { p: Project }) {
  const { open } = useOs();
  const role = roleById(p.roleId);
  const log = p.logId ? logById(p.logId) : undefined;
  return (
    <article className="detail" aria-labelledby={`p-${p.id}`}>
      <header className="detail__head">
        <p className="detail__meta">
          <Badge tone={p.kind === "case-study" ? "lime" : "dim"}>{KIND[p.kind]}</Badge>
          <span>{p.client}</span>
          {role && <button type="button" className="linkish linkish--inline" onClick={() => open("career", role.id)}>via {role.org}</button>}
        </p>
        <h3 className="detail__title" id={`p-${p.id}`}>{p.name}</h3>
        <p className="detail__sub">{p.role}</p>
      </header>
      <p className="detail__lead">{p.summary}</p>

      {p.challenge && p.solution && (
        <div className="cs">
          <section className="cs__card"><h4 className="block__label">Challenge</h4><p>{p.challenge}</p></section>
          <span className="cs__arrow" aria-hidden="true">→</span>
          <section className="cs__card cs__card--fix"><h4 className="block__label">Approach</h4><p>{p.solution}</p></section>
        </div>
      )}
      <Block label="My contribution" items={p.contributions.length ? p.contributions : undefined} />
      <Block label="Outcome" items={p.outcome} />
      {p.notes?.map((n) => <p className="note" key={n}>{n}</p>)}
      {!p.contributions.length && <p className="note">More detail to come.</p>}
      <TechChips techs={techFor(p.id)} />
      {log && (
        <button type="button" className="xref" onClick={() => open("log", log.id)}>
          <span className="xref__k">{log.id.toUpperCase()}</span> {log.title} <span aria-hidden="true">→</span>
        </button>
      )}
    </article>
  );
}
