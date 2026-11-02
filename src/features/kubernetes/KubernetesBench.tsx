"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useKubernetes } from "./KubernetesProvider";
import { describe, ROLES } from "./kubernetes-content";
import * as engine from "./kubernetes-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./kubernetes-scenarios";
import type { K8sFrame, K8sNodeId, K8sState, Version } from "./kubernetes-types";

const IDS: K8sNodeId[] = ["kubectl", "api", "controller", "scheduler", "node1", "node2", "node3"];
const EDGES: [K8sNodeId, K8sNodeId][] = [["kubectl", "api"], ["controller", "api"], ["scheduler", "api"], ["api", "node1"], ["api", "node2"], ["api", "node3"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 640, at: { kubectl: [0.5, 50], controller: [0.25, 175], scheduler: [0.75, 175], api: [0.5, 310], node1: [0.25, 450], node2: [0.75, 450], node3: [0.5, 580] } }
  : { height: 420, at: { kubectl: [0.1, 210], controller: [0.39, 70], api: [0.39, 210], scheduler: [0.39, 350], node1: [0.82, 75], node2: [0.82, 210], node3: [0.82, 345] } });
const HEIGHTS = { wide: 420, narrow: 640 };
const VERSIONS: [Version, string][] = [["v1", "web:v1"], ["v2", "web:v2"], ["v3", "web:v3 (broken)"]];

const counters = (s: K8sState) => [
  ["desired", "Desired", s.desired], ["ready", "Ready", engine.reportedReady(s)], ["serving", "Serving", engine.serving(s)],
  ["pending", "Pending", engine.pending(s)], ["created", "Pods created", s.stats.created], ["evicted", "Evicted", s.stats.evicted],
] as const;

const nodesFor = (frame: K8sFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "api") node.tag = `want ${s.desired} × ${s.version}`;
    const w = engine.worker(s, id as never);
    if (w) {
      const pods = s.pods.filter((p) => p.node === w.id);
      node.down = !w.up;
      node.tag = !w.up ? (w.ready ? "down · still “Ready”" : "down · NotReady") : `${pods.length}/${engine.CAPACITY} pods`;
      node.sub = pods.length ? pods.map((p) => `${p.name.replace("web-", "#")}${p.version === s.version ? "" : `·${p.version}`}`).join(" ") : "empty";
      node.cells = Array.from({ length: engine.CAPACITY }, (_, i) => {
        const p = pods[i];
        return !p ? "off" : p.ready && w.up ? "on" : "ghost";
      });
    }
    return node;
  });
};

const Pods = ({ s }: { s: K8sState }) => (
  <table className="keys mono">
    <thead><tr><th>pod</th><th>image</th><th>node</th><th>status</th></tr></thead>
    <tbody>
      {s.pods.map((p) => {
        const dead = p.node && !engine.worker(s, p.node)?.up;
        return (
          <tr key={p.name} className={p.phase === "Terminating" ? "is-ghost" : ""}>
            <td>{p.name}</td><td>{p.version}</td><td>{p.node ?? "—"}</td>
            <td>{p.phase}{p.ready ? " · ready" : ""}{dead && p.ready ? " ◐ not really" : ""}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const KubernetesBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useKubernetes();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<K8sNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("heal"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as K8sNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `tick ${tl.frame.state.tick}`}
      controls={<>
        <div className="control">
          <span className="label">Replicas · <span id="replicas">{present.desired}</span></span>
          <div className="control__row">
            <button type="button" className="btn" id="scale-down" disabled={present.desired <= 1} onClick={() => act(ACTIONS.scaleBy(-1))}>− 1</button>
            <button type="button" className="btn" id="scale-up" disabled={present.desired >= engine.MAX_REPLICAS} onClick={() => act(ACTIONS.scaleBy(1))}>+ 1</button>
          </div>
          <button type="button" className="btn btn--wide" id="delete-pod" onClick={() => act(ACTIONS.deletePod())}>kubectl delete pod</button>
        </div>
        <div className="control">
          <span className="label">Image</span>
          <div className="control__row">
            {VERSIONS.map(([v, text]) => (
              <button key={v} type="button" className={`btn${present.version === v ? " btn--solid" : ""}`} data-version={v} aria-pressed={present.version === v} onClick={() => act(ACTIONS.image(v))}>{text}</button>
            ))}
          </div>
          <button type="button" className="btn btn--wide" id="undo" disabled={!present.previous} onClick={() => act(ACTIONS.undo())}>kubectl rollout undo</button>
        </div>
        <div className="control">
          <span className="label">Machines</span>
          <div className="control__row">
            {present.workers.map((w) => (
              <button key={w.id} type="button" className="btn" data-node={w.id} onClick={() => act(w.up ? ACTIONS.fail(w.id) : ACTIONS.restore(w.id))}>
                {w.up ? `Kill ${w.id}` : `Start ${w.id}`}
              </button>
            ))}
          </div>
        </div>
        <div className="control">
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset the cluster</button>
          <span className="control__hint">The loops keep running while this plays. Pause to freeze the cluster.</span>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Pods, as the API server sees them</span><span>◐ = its node is gone</span></div>
            <div id="pods"><Pods s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 04 · One Deployment, its control loops", "Three nodes, three slots each", "Ticks stand in for timeouts"]}
    />
  );
};
