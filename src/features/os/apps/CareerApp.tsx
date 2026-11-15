"use client";

import { useEffect, useRef, useState } from "react";
import { useOs } from "../OsContext";
import { IDENTITY, PHASES, ROLES } from "../os-content";
import { formatDuration, formatRange, linksForTarget, monthIndex, monthsBetween, projectById, roleById, techById, currentTitle } from "../os-engine";
import type { Role, RoleKind, Tech } from "../os-types";
import { Badge, Block, TechChips } from "./parts";

const S = monthIndex(IDENTITY.careerStart);
const E = monthIndex({ y: 2026, m: 12 });
const pct = (mi: number) => ((mi - S) / (E - S)) * 100;
const YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i).filter((y) => monthIndex({ y, m: 1 }) >= S);

const KIND_LABEL: Record<RoleKind, string> = { main: "Chapter", parallel: "Parallel contract", transition: "Transition", side: "Side quest" };
const LANES: { id: string; label: string; kinds: RoleKind[] }[] = [
  { id: "main", label: "Main path", kinds: ["main", "transition"] },
  { id: "parallel", label: "Parallel", kinds: ["parallel"] },
  { id: "side", label: "Side quests", kinds: ["side"] },
];

// A bar ends with its last month, but never runs into the next bar in its lane.
const barEnd = (r: Role, next?: Role) => Math.min(monthIndex(r.end) + 1, next ? monthIndex(next.start) : Infinity);

const byStart = (a: Role, b: Role) => monthIndex(a.start) - monthIndex(b.start);

export function CareerApp() {
  const { state, select, discover } = useOs();
  const [sideToggle, setSide] = useState(false);
  const selected = state.selection.career ? roleById(state.selection.career) : undefined;
  const showSide = sideToggle || selected?.kind === "side";
  const visible = ROLES.filter((r) => showSide || r.kind !== "side").sort(byStart);
  const idx = selected ? visible.findIndex((r) => r.id === selected.id) : -1;
  const tlRef = useRef<HTMLDivElement>(null);

  // On narrow screens the timeline scrolls sideways: keep the chosen chapter in view.
  useEffect(() => {
    const tl = tlRef.current, bar = tl?.querySelector<HTMLElement>(".tl__bar[aria-pressed='true']");
    if (!tl || !bar || tl.scrollWidth <= tl.clientWidth) return;
    const t = tl.getBoundingClientRect(), b = bar.getBoundingClientRect();
    tl.scrollTo({ left: tl.scrollLeft + b.left - t.left - (t.width - b.width) / 2, behavior: "smooth" });
  }, [selected?.id]);

  const toggleSide = () => {
    setSide(!showSide);
    if (!showSide) discover("sidequests");
    if (showSide && selected?.kind === "side") select("career", undefined);
  };

  return (
    <div className="app career">
      <div className="app__head">
        <p className="app__kicker">{visible.filter((r) => r.kind !== "side").length} chapters · 2017 → 2026</p>
        <button type="button" className="toggle" aria-pressed={showSide} onClick={toggleSide}>
          <span className="toggle__box" aria-hidden="true" /> Side quests <span className="toggle__n">{ROLES.filter((r) => r.kind === "side").length}</span>
        </button>
      </div>

      <div className="tl" ref={tlRef} role="group" aria-label="Career timeline">
        <div className="tl__inner">
          <div className="tl__phases" aria-hidden="true">
            {PHASES.map((p) => (
              <span key={p.id} style={{ left: `${pct(monthIndex(p.start))}%`, width: `${pct(monthIndex(p.end) + 1) - pct(monthIndex(p.start))}%` }}>{p.label}</span>
            ))}
          </div>
          {LANES.filter((l) => l.id !== "side" || showSide).map((lane) => (
            <div key={lane.id} className="tl__lane" data-lane={lane.id}>
              <span className="tl__lane-label">{lane.label}</span>
              {visible.filter((r) => lane.kinds.includes(r.kind)).map((r, i, inLane) => (
                <button key={r.id} type="button" className="tl__bar" data-kind={r.kind} aria-pressed={selected?.id === r.id}
                  style={{ left: `${pct(monthIndex(r.start))}%`, width: `calc(${pct(barEnd(r, inLane[i + 1])) - pct(monthIndex(r.start))}% - 3px)` }}
                  onClick={() => select("career", selected?.id === r.id ? undefined : r.id)}
                  aria-label={`${r.org}: ${currentTitle(r)}, ${formatRange(r.start, r.end)}`} title={`${r.org} · ${formatRange(r.start, r.end)}`}>
                  <span>{r.short ?? r.org}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="tl__axis" aria-hidden="true">
            {YEARS.map((y) => <span key={y} style={{ left: `${pct(monthIndex({ y, m: 1 }))}%` }}>{y}</span>)}
          </div>
        </div>
      </div>

      <div className="career__body" key={selected?.id ?? "overview"}>
        {selected ? (
          <RoleDetail role={selected}
            prev={idx > 0 ? visible[idx - 1] : undefined}
            next={idx >= 0 && idx < visible.length - 1 ? visible[idx + 1] : undefined}
            onPick={(id) => select("career", id)} />
        ) : (
          <Overview onPick={(id) => select("career", id)} />
        )}
      </div>
    </div>
  );
}

function Overview({ onPick }: { onPick: (id: string) => void }) {
  const roles = ROLES.filter((r) => r.kind !== "side");
  return (
    <div className="phases">
      {PHASES.map((p, i) => {
        const inPhase = roles.filter((r) => monthIndex(r.start) >= monthIndex(p.start) && monthIndex(r.start) <= monthIndex(p.end));
        return (
          <section key={p.id} className="phase" style={{ "--i": i } as React.CSSProperties}>
            <p className="phase__n">0{i + 1}</p>
            <h3 className="phase__title">{p.label}</h3>
            <p className="phase__sum">{p.summary}</p>
            <ul className="phase__roles">
              {inPhase.map((r) => (
                <li key={r.id}><button type="button" className="linkish" onClick={() => onPick(r.id)}>{r.org}<span>{currentTitle(r)}</span></button></li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function RoleDetail({ role, prev, next, onPick }: { role: Role; prev?: Role; next?: Role; onPick: (id: string) => void }) {
  const { open } = useOs();
  const projects = (role.projects ?? []).map(projectById).filter((p) => !!p);
  const techs = [role.id, ...(role.projects ?? [])].flatMap(linksForTarget).map((l) => techById(l.tech)).filter((t): t is Tech => !!t);
  return (
    <article className="detail" aria-labelledby={`role-${role.id}`}>
      <header className="detail__head">
        <p className="detail__meta">
          <Badge tone={role.kind === "side" ? "dim" : role.kind === "transition" ? "warn" : "lime"}>{KIND_LABEL[role.kind]}</Badge>
          <span>{formatRange(role.start, role.end)}</span>
          <span>{formatDuration(monthsBetween(role.start, role.end))}</span>
          {role.location && <span>{role.location}</span>}
        </p>
        <h3 className="detail__title" id={`role-${role.id}`}>{role.org}</h3>
        {role.titles.length > 1 ? (
          <ol className="steps">
            {role.titles.map((t) => <li key={t.title}><strong>{t.title}</strong><span>{formatRange(t.start, t.end)}</span></li>)}
          </ol>
        ) : <p className="detail__sub">{currentTitle(role)}</p>}
      </header>
      <p className="detail__lead">{role.summary}</p>
      {role.note && <p className="note">{role.note}</p>}
      <Block label="What I did" items={role.points.length ? role.points : undefined} />
      {projects.length > 0 && (
        <div className="block">
          <h4 className="block__label">Projects</h4>
          <ul className="chips">
            {projects.map((p) => <li key={p.id}><button type="button" className="chip chip--project" onClick={() => open("projects", p.id)}>{p.name} →</button></li>)}
          </ul>
        </div>
      )}
      <TechChips techs={techs} label={projects.length ? "Stack across this work" : "Stack"} />
      <nav className="pager" aria-label="Chapters">
        {prev ? <button type="button" onClick={() => onPick(prev.id)}>← {prev.org}</button> : <span />}
        {next ? <button type="button" onClick={() => onPick(next.id)}>{next.org} →</button> : <span />}
      </nav>
    </article>
  );
}
