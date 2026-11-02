"use client";

import { useRef, type ReactNode } from "react";
import type { Timeline } from "@/lib/simulation/timeline";
import type { SimFrame } from "@/lib/simulation/simulation-types";
import { transportKeys, useFirstSight, usePauseWhenHidden } from "@/lib/simulation/useTimeline";
import { Caption } from "./Caption";
import { ComponentInspector } from "./ComponentInspector";
import { SimulationControls } from "./SimulationControls";

// The sheet a scenario-driven simulation sits on: scenario tabs, a stage with
// its caption and transport, a column of controls, readouts underneath and a
// title block. The topic supplies every part that knows its domain.
type Props<F extends SimFrame<unknown>> = {
  timeline: Timeline<F>;
  tabs: { id: string; label: string; title: string }[];
  current: string | null;
  lesson: string;
  onTab: (id: string) => void;
  onFirstSight: () => void;
  stage: ReactNode;
  inspect: { name: string; role: string } | null;
  caption: [title: string, text: string];
  speak: boolean;            // announce the caption: at rest, not on every packet
  position: (timeline: Timeline<F>) => string;
  controls: ReactNode;
  readouts: ReactNode;
  titleblock: [string, string, string];
};

export const BenchFrame = <F extends SimFrame<unknown>>(p: Props<F>) => {
  const bench = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(bench, p.timeline);
  useFirstSight(stage, p.onFirstSight, 0.35);
  const [title, text] = p.caption;
  const [sheet, ...notes] = p.titleblock;

  return (
    <div className="bench sheet" id="bench" ref={bench} onKeyDown={transportKeys(p.timeline)}>
      <div className="tabs" id="tabs" role="group" aria-label="Scenarios">
        {p.tabs.map((t) => (
          <button key={t.id} type="button" className="tab" data-value={t.id} aria-pressed={p.current === t.id} onClick={() => p.onTab(t.id)}>
            <span className="label">{t.label}</span><b>{t.title}</b>
          </button>
        ))}
      </div>
      <p className="lesson" id="lesson">{p.lesson}</p>

      <div className="bench-grid">
        <div className="bench-main">
          <div id="stage" ref={stage}>{p.stage}</div>
          <ComponentInspector item={p.inspect} className="bench-inspect" />
          <Caption id="caption" title={title} text={text} />
          <p className="sr" id="status" role="status">{p.speak ? `${title}. ${text}` : ""}</p>
          <div className="transport-bar">
            <SimulationControls timeline={p.timeline} label={p.position} />
          </div>
        </div>
        <div className="controls" aria-label="Experiment">{p.controls}</div>
      </div>

      {p.readouts}

      <div className="titleblock label">
        <span><b>{sheet?.split(" · ")[0]}</b> · {sheet?.split(" · ").slice(1).join(" · ")}</span>
        {notes.map((n) => <span key={n}>{n}</span>)}
      </div>
    </div>
  );
};
