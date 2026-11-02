"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useCicd } from "./CicdProvider";
import { describe, ROLES } from "./cicd-content";
import * as engine from "./cicd-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./cicd-scenarios";
import type { CicdFrame, CicdNodeId, CicdState, Gate, StageStatus, Strategy } from "./cicd-types";

const IDS: CicdNodeId[] = ["dev", "repo", "ci", "registry", "staging", "prod"];
const EDGES: [CicdNodeId, CicdNodeId][] = [["dev", "repo"], ["repo", "ci"], ["ci", "registry"], ["registry", "staging"], ["registry", "prod"], ["staging", "ci"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { dev: [0.25, 50], repo: [0.75, 50], ci: [0.5, 185], registry: [0.5, 320], staging: [0.25, 470], prod: [0.75, 470] } }
  : { height: 380, at: { dev: [0.1, 80], repo: [0.1, 300], ci: [0.37, 190], registry: [0.63, 190], staging: [0.88, 80], prod: [0.88, 300] } });
const HEIGHTS = { wide: 380, narrow: 540 };
const GLYPH: Record<StageStatus, string> = { pending: "·", passed: "✓", failed: "✕", waiting: "‖", skipped: "–" };

const counters = (s: CicdState) => [
  ["runs", "Pipeline runs", s.stats.runs], ["failedRuns", "Stopped by tests", s.stats.failedRuns], ["deploys", "Releases", s.stats.deploys],
  ["rollbacks", "Rollbacks", s.stats.rollbacks], ["badResponses", "Failed requests /100", s.stats.badResponses], ["errorRate", "Error rate now %", engine.errorRate(s)],
] as const;

const nodesFor = (frame: CicdFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  const last = s.runs[s.runs.length - 1];
  const rate = engine.errorRate(s);
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "repo" && last) node.tag = `${last.sha} ${last.stages.test === "failed" ? "✕" : last.stages.test === "passed" ? "✓" : "…"}`;
    if (id === "ci" && last) node.tag = `#${last.id} ${engine.STAGES.map((st) => GLYPH[last.stages[st]]).join("")}`;
    if (id === "registry") node.tag = `${s.artifacts.length} artifact${s.artifacts.length === 1 ? "" : "s"}`;
    if (id === "staging") node.sub = s.staging ? `runs ${s.staging.sha}` : "empty";
    if (id === "prod") {
      node.sub = s.prod ? `runs ${s.prod.sha}` : "empty";
      node.tag = rate ? `${rate}% errors` : "healthy";
      node.down = rate === 100;
    }
    return node;
  });
};

const Runs = ({ s }: { s: CicdState }) => (
  <table className="keys mono">
    <thead><tr><th>#</th><th>commit</th>{engine.STAGES.map((st) => <th key={st}>{st}</th>)}</tr></thead>
    <tbody>
      {[...s.runs].reverse().map((r) => {
        const message = s.commits.find((c) => c.sha === r.sha)?.message;
        return (
          <tr key={r.id}>
            <td>{r.id}</td><td title={message}>{r.sha}</td>
            {engine.STAGES.map((st) => <td key={st} aria-label={r.stages[st]}>{GLYPH[r.stages[st]]}</td>)}
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const CicdBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useCicd();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<CicdNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("green"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as CicdNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Push a change</span>
          <button type="button" className="btn btn--solid btn--wide" id="push-good" onClick={() => act(ACTIONS.commit("good"))}>A good change</button>
          <div className="control__row">
            <button type="button" className="btn" id="push-red" onClick={() => act(ACTIONS.commit("breaks-test"))}>Breaks a test</button>
            <button type="button" className="btn" id="push-bug" onClick={() => act(ACTIONS.commit("hidden-bug"))}>Hidden bug</button>
          </div>
        </div>
        <div className="control">
          <span className="label">Release</span>
          <Segmented<Strategy> id="strategy" label="Release strategy" value={present.strategy} options={[["all", "All at once"], ["canary", "Canary 10%"]]} onChange={(strategy) => act((st) => engine.configure(st, { strategy }))} />
          <Segmented<Gate> id="gate" label="Before production" value={present.gate} options={[["auto", "Automatic"], ["manual", "Approval"]]} onChange={(gate) => act((st) => engine.configure(st, { gate }))} />
          <button type="button" className="btn btn--wide" id="approve" disabled={present.waiting === null} onClick={() => act(ACTIONS.approve())}>Approve #{present.waiting ?? "–"}</button>
        </div>
        <div className="control">
          <span className="label">Production</span>
          <button type="button" className="btn btn--wide" id="rollback" disabled={!engine.previousRelease(present)} onClick={() => act(ACTIONS.rollback())}>
            Roll back{engine.previousRelease(present) ? ` to ${engine.previousRelease(present)?.sha}` : ""}
          </button>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Pipeline runs, newest first</span><span>✓ passed ✕ failed ‖ waiting – skipped</span></div>
            <div id="runs"><Runs s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 05 · From commit to production", "One branch, one pipeline at a time", "Error counts per 100 requests"]}
    />
  );
};
