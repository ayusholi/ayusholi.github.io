"use client";

import { topicUrl } from "@/lib/site";
import { useLayoutEffect, useRef } from "react";
import { useOs } from "../OsContext";
import { TECH, TECH_GROUPS, TECH_LINKS } from "../os-content";
import { linksForTarget, linksForTech, projectById, STACK_TARGETS, targetName, techById } from "../os-engine";

const SVG_NS = "http://www.w3.org/2000/svg";

// The selection is a technology id, or "@<target>" for a project or role.
export function StackApp() {
  const { state, select, open, compact } = useOs();
  const sel = state.selection.stack;
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const target = sel?.startsWith("@") ? sel.slice(1) : undefined;
  const tech = !target && sel ? techById(sel) : undefined;
  const links = tech ? linksForTech(tech.id) : target ? linksForTarget(target) : [];
  const litTech = new Set(target ? links.map((l) => l.tech) : tech ? [tech.id] : []);
  const litTarget = new Set(tech ? links.map((l) => l.target) : target ? [target] : []);
  const linked = new Set(TECH_LINKS.map((l) => l.tech));

  // Connectors are drawn straight into the SVG: they follow layout, not state.
  useLayoutEffect(() => {
    const root = rootRef.current, svg = svgRef.current;
    if (!root || !svg) return;
    const draw = () => {
      svg.replaceChildren();
      const R = root.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
      if (compact) return;
      for (const l of links) {
        const a = root.querySelector(`[data-tech="${l.tech}"]`), b = root.querySelector(`[data-target="${l.target}"]`);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x1 = ra.right - R.left, y1 = ra.top + ra.height / 2 - R.top;
        const x2 = rb.left - R.left, y2 = rb.top + rb.height / 2 - R.top;
        const dx = Math.max(40, (x2 - x1) * 0.45);
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
        path.setAttribute("pathLength", "1");
        path.setAttribute("class", "smap__wire");
        svg.append(path);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(root);
    return () => ro.disconnect();
  });

  const pick = (id: string) => select("stack", sel === id ? undefined : id);

  return (
    <div className="app stack">
      <div className="app__head">
        <p className="app__kicker">{TECH.length} technologies · {linked.size} traced to specific work</p>
        <p className="legend"><span className="legend__k legend__k--on" /> used in featured work <span className="legend__k" /> toolkit</p>
      </div>
      <div className="stack__grid">
        <div className="smap" ref={rootRef}>
          <svg className="smap__wires" ref={svgRef} aria-hidden="true" />
          <div className="smap__techs">
            {TECH_GROUPS.map((g) => (
              <section key={g} className="smap__group" aria-label={g}>
                <h3 className="block__label">{g}</h3>
                <ul className="chips">
                  {TECH.filter((t) => t.group === g).map((t) => (
                    <li key={t.id}>
                      <button type="button" className="chip chip--tech" data-tech={t.id} aria-pressed={tech?.id === t.id}
                        data-lit={litTech.has(t.id) || undefined} data-dim={(sel && !litTech.has(t.id)) || undefined} data-toolkit={!linked.has(t.id) || undefined}
                        onClick={() => pick(t.id)}>{t.name}</button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className="smap__targets" aria-label="Projects and roles">
            <h3 className="block__label">Where</h3>
            <ul>
              {STACK_TARGETS.map((t) => (
                <li key={t.id}>
                  <button type="button" className="target" data-target={t.id} aria-pressed={target === t.id}
                    data-lit={litTarget.has(t.id) || undefined} data-dim={(sel && !litTarget.has(t.id)) || undefined}
                    onClick={() => pick(`@${t.id}`)}>
                    <span>{t.name}</span><small>{t.kind === "role" ? "role" : `${linksForTarget(t.id).length}`}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="trace-panel" aria-live="polite">
          {tech ? (
            <>
              <p className="block__label">{tech.group}</p>
              <h3 className="trace-panel__title">{tech.name}</h3>
              {links.length ? (
                <>
                  <p className="trace-panel__sub">Used in {links.length} place{links.length > 1 ? "s" : ""}</p>
                  <ul className="uses">
                    {links.map((l) => (
                      <li key={l.target}>
                        <button type="button" className="linkish" onClick={() => open(projectById(l.target) ? "projects" : "career", l.target)}>
                          {targetName(l.target)} <span aria-hidden="true">→</span>
                        </button>
                        <span>{l.note}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="trace-panel__sub">Part of the toolkit. Not tied to a featured project yet.</p>
              )}
              {tech.explainer && <a className="xref" href={topicUrl(tech.explainer)}>I wrote an interactive explainer on this <span aria-hidden="true">↗</span></a>}
            </>
          ) : target ? (
            <>
              <p className="block__label">{projectById(target) ? "Project" : "Role"}</p>
              <h3 className="trace-panel__title">{targetName(target)}</h3>
              <ul className="uses">
                {links.map((l) => <li key={l.tech}><strong>{techById(l.tech)?.name}</strong><span>{l.note}</span></li>)}
              </ul>
              <button type="button" className="xref" onClick={() => open(projectById(target) ? "projects" : "career", target)}>
                Open {projectById(target) ? "case study" : "chapter"} <span aria-hidden="true">→</span>
              </button>
            </>
          ) : (
            <>
              <h3 className="trace-panel__title">Trace a technology</h3>
              <p className="trace-panel__sub">Select a technology to see where it was used, and what for. Or select a project to see its stack.</p>
              <p className="note">Only stated uses are linked. Nothing here implies every tool was used everywhere.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
