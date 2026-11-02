"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useActions } from "./ActionsProvider";
import { describe, ROLES } from "./actions-content";
import * as engine from "./actions-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./actions-scenarios";
import type { ActionsFrame, ActionsNodeId, ActionsState, JobStatus, StepStatus } from "./actions-types";

const IDS: ActionsNodeId[] = ["dev", "github", "r1", "r2", "r3", "cache"];
const EDGES: [ActionsNodeId, ActionsNodeId][] = [["dev", "github"], ["github", "r1"], ["github", "r2"], ["github", "r3"], ["r1", "cache"], ["r2", "cache"], ["r3", "cache"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 560, at: { dev: [0.25, 50], github: [0.25, 200], cache: [0.25, 470], r1: [0.75, 200], r2: [0.75, 335], r3: [0.75, 470] } }
  : { height: 400, at: { dev: [0.09, 200], github: [0.33, 200], r1: [0.6, 70], r2: [0.6, 200], r3: [0.6, 330], cache: [0.88, 200] } });
const HEIGHTS = { wide: 400, narrow: 560 };
const STEP_GLYPH: Record<StepStatus, string> = { pending: "·", running: "▸", success: "✓", failure: "✕", skipped: "–" };
const JOB_LABEL: Record<JobStatus, string> = { waiting: "waiting", queued: "queued", running: "running", success: "✓ success", failure: "✕ failure", skipped: "– skipped", cancelled: "⊘ cancelled" };

const counters = (s: ActionsState) => [
  ["runs", "Runs", s.stats.runs], ["minutes", "Runner ticks billed", s.stats.minutes], ["queued", "Jobs queued", s.runs.flatMap((r) => r.jobs).filter((j) => j.status === "queued").length],
  ["hits", "Cache hits", s.stats.hits], ["misses", "Cache misses", s.stats.misses], ["cancelled", "Jobs cancelled", s.stats.cancelled],
] as const;

const nodesFor = (frame: ActionsFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    const slot = s.runners.findIndex((r) => r.id === id);
    if (slot >= 0) {
      const found = engine.findJob(s, s.runners[slot]?.job ?? null);
      const step = found?.job.steps.find((st) => st.status === "running" || st.status === "pending");
      node.rested = slot >= s.capacity && !found;
      node.tag = found ? `#${found.run.id} ${engine.JOB_NAME[found.job.id]}` : node.rested ? "not available" : "idle";
      node.sub = found ? `▸ ${step?.name ?? "finishing"}` : node.rested ? "over the limit" : "no machine yet";
    }
    if (id === "github") {
      const live = s.runs.filter((r) => r.status === "in_progress").length;
      node.tag = live ? `${live} run${live === 1 ? "" : "s"} in progress` : "idle";
    }
    if (id === "cache") node.tag = s.cache.join(" ");
    return node;
  });
};

const Board = ({ s }: { s: ActionsState }) => {
  if (!s.runs.length) return <p className="mono">(no runs yet)</p>;
  return (
    <table className="keys mono">
      <thead><tr><th>run</th><th>job</th><th>status</th><th>steps</th></tr></thead>
      <tbody>
        {[...s.runs].reverse().slice(0, 2).flatMap((r) => r.jobs.map((j) => (
          <tr key={`${r.id}${j.id}`} className={j.status === "cancelled" || j.status === "skipped" ? "is-ghost" : ""}>
            <td title={r.trigger.event === "push" ? `push to ${r.trigger.ref}` : "pull request"}>#{r.id}{r.trigger.event === "push" ? "" : " PR"}</td>
            <td>{engine.JOB_NAME[j.id]}</td>
            <td>{JOB_LABEL[j.status]}{j.runner ? ` · ${j.runner}` : ""}</td>
            <td aria-label={j.steps.map((st) => `${st.name} ${st.status}`).join(", ")}>{j.steps.map((st) => STEP_GLYPH[st.status]).join(" ")}</td>
          </tr>
        )))}
      </tbody>
    </table>
  );
};

export const ActionsBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useActions();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<ActionsNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("push"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as ActionsNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `tick ${tl.frame.state.tick}`}
      controls={<>
        <div className="control">
          <span className="label">Push to main</span>
          <button type="button" className="btn btn--solid btn--wide" id="push" onClick={() => act(ACTIONS.push())}>git push</button>
          <div className="control__row">
            <button type="button" className="btn" id="push-failing" onClick={() => act(ACTIONS.push({ failing: true }))}>With a failing test</button>
            <button type="button" className="btn" id="push-deps" onClick={() => act(ACTIONS.push({ deps: true }))}>New dependency</button>
          </div>
          <button type="button" className="btn btn--wide" id="push-docs" onClick={() => act(ACTIONS.push({ docs: true }))}>Docs-only change</button>
        </div>
        <div className="control">
          <span className="label">From a branch</span>
          <button type="button" className="btn btn--wide" id="pr" onClick={() => act(ACTIONS.pr())}>Open a pull request</button>
        </div>
        <div className="control">
          <span className="label">Runners available at once</span>
          <Segmented id="capacity" label="Runners available" value={String(present.capacity) as "1" | "2" | "3"} options={[["1", "1"], ["2", "2"], ["3", "3"]]} onChange={(v) => act(ACTIONS.capacity(Number(v)))} />
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Latest runs</span><span>✓ done ▸ running · to do – skipped</span></div>
            <div id="board"><Board s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 06 · One workflow, from event to runners", "GitHub-hosted runners, one job each", "Ticks stand in for minutes"]}
    />
  );
};
