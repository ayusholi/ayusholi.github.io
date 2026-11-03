"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useAutomations } from "./AutomationsProvider";
import { describe, ROLES } from "./automations-content";
import * as engine from "./automations-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./automations-scenarios";
import type { AutoFrame, AutoNodeId, AutoState, Dedupe, OnError } from "./automations-types";

const IDS: AutoNodeId[] = ["trigger", "ai", "router", "sheet", "chat", "reply"];
const EDGES: [AutoNodeId, AutoNodeId][] = [["trigger", "ai"], ["ai", "router"], ["router", "sheet"], ["router", "chat"], ["sheet", "reply"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { trigger: [0.25, 50], ai: [0.75, 50], router: [0.5, 200], sheet: [0.25, 335], chat: [0.75, 335], reply: [0.25, 470] } }
  : { height: 380, at: { trigger: [0.09, 190], ai: [0.32, 190], router: [0.55, 190], sheet: [0.78, 80], reply: [0.78, 300], chat: [0.92, 190] } });
const HEIGHTS = { wide: 380, narrow: 540 };
const GLYPH = { running: "…", success: "✓", error: "✕", skipped: "–" } as const;

const counters = (s: AutoState) => [
  ["executions", "Executions", s.stats.executions], ["failed", "Failed", s.stats.failed], ["aiCalls", "AI calls", s.stats.aiCalls],
  ["rows", "Sheet rows", s.stats.rows], ["replies", "Replies sent", s.stats.replies], ["alerts", "Team alerts", s.stats.alerts],
] as const;

const nodesFor = (frame: AutoFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  const run = s.executions[s.executions.length - 1];
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "trigger") {
      if (s.dedupe === "on") node.sub = "Dedupes on message id";
      if (s.last) node.tag = s.last.messageId;
    }
    if (id === "ai") {
      node.sub = s.onError === "retry" ? "On error: retry" : "On error: stop";
      if (run?.status === "error") {
        node.tag = "invalid JSON";
        node.down = true;
      }
    }
    if (id === "router" && s.item?.category) node.tag = s.item.category;
    if (id === "sheet" && s.stats.rows) node.tag = `${s.stats.rows} row${s.stats.rows === 1 ? "" : "s"}`;
    if (id === "chat" && s.stats.alerts) node.tag = `${s.stats.alerts} alert${s.stats.alerts === 1 ? "" : "s"}`;
    if (id === "reply" && s.stats.replies) node.tag = `${s.stats.replies} sent`;
    node.rested = !!run && run.status !== "running" && !run.path.includes(id);
    return node;
  });
};

const Executions = ({ s }: { s: AutoState }) => (
  <table className="keys mono">
    <thead><tr><th>#</th><th>message</th><th>path</th><th></th></tr></thead>
    <tbody>
      {[...s.executions].reverse().map((e) => (
        <tr key={e.n} className={e.status === "skipped" ? "is-ghost" : undefined}>
          <td>{e.n}</td><td title={engine.EMAILS[e.email].subject}>{e.messageId}</td>
          <td>{e.path.join(" → ")}</td><td aria-label={e.status}>{GLYPH[e.status]}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const AutomationsBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useAutomations();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<AutoNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("one"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as AutoNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">An email arrives</span>
          <button type="button" className="btn btn--solid btn--wide" id="email-order" onClick={() => act(ACTIONS.receive("order"))}>Where is my order?</button>
          <div className="control__row">
            <button type="button" className="btn" id="email-complaint" onClick={() => act(ACTIONS.receive("complaint"))}>Angry customer</button>
            <button type="button" className="btn" id="email-spam" onClick={() => act(ACTIONS.receive("spam"))}>Spam</button>
          </div>
          <button type="button" className="btn btn--wide" id="email-messy" onClick={() => act(ACTIONS.receive("messy"))}>A messy forward</button>
        </div>
        <div className="control">
          <span className="label">Settings</span>
          <Segmented<OnError> id="on-error" label="On AI error" value={present.onError} options={[["stop", "Stop"], ["retry", "Retry with error"]]} onChange={(onError) => act((st) => engine.configure(st, { onError }))} />
          <Segmented<Dedupe> id="dedupe" label="Dedupe" value={present.dedupe} options={[["off", "No dedupe"], ["on", "Dedupe by id"]]} onChange={(dedupe) => act((st) => engine.configure(st, { dedupe }))} />
        </div>
        <div className="control">
          <span className="label">Trigger</span>
          <button type="button" className="btn btn--wide" id="redeliver" disabled={!present.last} onClick={() => act(ACTIONS.redeliver())}>Trigger fires again{present.last ? ` (${present.last.messageId})` : ""}</button>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Executions, newest first</span><span>✓ success ✕ failed – skipped</span></div>
            <div id="executions"><Executions s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 10 · One workflow, email to action", "One email per execution", "AI replies fixed per email"]}
    />
  );
};
