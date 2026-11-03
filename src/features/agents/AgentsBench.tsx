"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useAgents } from "./AgentsProvider";
import { describe, ROLES } from "./agents-content";
import * as engine from "./agents-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./agents-scenarios";
import type { AgentsFrame, AgentsNodeId, AgentsState, Approval, Limit, Message } from "./agents-types";

const IDS: AgentsNodeId[] = ["user", "runtime", "model", "weather", "web", "email"];
const EDGES: [AgentsNodeId, AgentsNodeId][] = [["user", "runtime"], ["runtime", "model"], ["runtime", "weather"], ["runtime", "web"], ["runtime", "email"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { user: [0.25, 60], runtime: [0.25, 265], model: [0.25, 470], weather: [0.75, 130], web: [0.75, 265], email: [0.75, 400] } }
  : { height: 400, at: { user: [0.1, 90], model: [0.1, 310], runtime: [0.42, 200], weather: [0.82, 70], web: [0.82, 200], email: [0.82, 330] } });
const HEIGHTS = { wide: 400, narrow: 540 };

const counters = (s: AgentsState) => [
  ["modelCalls", "Model calls", s.stats.modelCalls], ["toolCalls", "Tool calls", s.stats.toolCalls], ["toolErrors", "Tool errors", s.stats.toolErrors],
  ["recipients", "People emailed", s.stats.recipients], ["tokens", "Tokens sent, in all", s.stats.tokens], ["stepsLeft", "Steps left", Number(s.limit) - s.steps],
] as const;

const nodesFor = (frame: AgentsFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "user" && s.pending) node.tag = "approve?";
    if (id === "user" && s.done) node.tag = s.done === "answered" ? "answered" : "stopped";
    if (id === "runtime") node.tag = `step ${s.steps}/${s.limit}`;
    if (id === "model" && s.stats.modelCalls) node.tag = `${engine.tokensOf(s.transcript)} tokens`;
    if (id === "weather" && s.weatherDown) {
      node.sub = "503 errors";
      node.down = true;
    }
    if (id === "email") {
      node.sub = s.approval === "ask" ? "Side effect · asks first" : "Side effect";
      if (s.stats.recipients) node.tag = `${s.stats.recipients} emailed`;
    }
    return node;
  });
};

const ROLE_LABEL = (m: Message) => (m.role === "tool" ? `tool · ${m.status}` : "call" in m ? "assistant · call" : m.role);

const Transcript = ({ s }: { s: AgentsState }) => (
  <table className="keys mono">
    <thead><tr><th>#</th><th>role</th><th>content</th></tr></thead>
    <tbody>
      {s.transcript.map((m, i) => ({ m, i })).slice(-7).reverse().map(({ m, i }) => (
        <tr key={`${s.task}-${i}`} className={m.role === "tool" && m.text.includes("<!--") ? "is-diff" : undefined}>
          <td>{i + 1}</td><td>{ROLE_LABEL(m)}</td><td>{engine.messageText(m)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const AgentsBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useAgents();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<AgentsNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("tool"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as AgentsNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Give it a task</span>
          <button type="button" className="btn btn--solid btn--wide" id="task-weather" onClick={() => act(ACTIONS.assign("weather"))}>Will it rain tomorrow?</button>
          <div className="control__row">
            <button type="button" className="btn" id="task-hike" onClick={() => act(ACTIONS.assign("hike"))}>Email the team</button>
            <button type="button" className="btn" id="task-research" onClick={() => act(ACTIONS.assign("research"))}>Read reviews</button>
          </div>
          <button type="button" className="btn btn--wide" id="task-loop" onClick={() => act(ACTIONS.assign("loop"))}>Find the cheapest flight</button>
        </div>
        <div className="control">
          <span className="label">Guardrails</span>
          <Segmented<Approval> id="approval" label="Side effects" value={present.approval} options={[["auto", "Run freely"], ["ask", "Ask first"]]} onChange={(approval) => act((st) => engine.configure(st, { approval }))} />
          <Segmented<Limit> id="limit" label="Step budget" value={present.limit} options={[["4", "4 steps"], ["10", "10 steps"]]} onChange={(limit) => act((st) => engine.configure(st, { limit }))} />
          <div className="control__row">
            <button type="button" className="btn" id="approve" disabled={!present.pending} onClick={() => act(ACTIONS.approve())}>Approve</button>
            <button type="button" className="btn" id="deny" disabled={!present.pending} onClick={() => act(ACTIONS.deny())}>Deny</button>
          </div>
        </div>
        <div className="control">
          <span className="label">Tools</span>
          <button type="button" className="btn btn--wide" id="toggle-weather" onClick={() => act((st) => engine.configure(st, { weatherDown: !st.weatherDown }))}>
            {present.weatherDown ? "Restore the weather API" : "Break the weather API"}
          </button>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>The transcript, newest first</span><span>All of it is resent on every call</span></div>
            <div id="transcript"><Transcript s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 08 · The agent loop, call by call", "One model, three tools", "Tokens estimated at four characters each"]}
    />
  );
};
