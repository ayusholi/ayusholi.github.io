"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useDatabases } from "./DatabasesProvider";
import { describe, ROLES } from "./databases-content";
import * as engine from "./databases-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./databases-scenarios";
import type { Commit, DbFrame, DbNodeId, DbState } from "./databases-types";

const IDS: DbNodeId[] = ["client", "planner", "executor", "buffer", "disk", "wal"];
const EDGES: [DbNodeId, DbNodeId][] = [["client", "planner"], ["planner", "executor"], ["executor", "client"], ["executor", "buffer"], ["buffer", "disk"], ["executor", "wal"], ["wal", "disk"], ["wal", "buffer"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { client: [0.25, 50], planner: [0.75, 50], executor: [0.5, 190], wal: [0.25, 330], buffer: [0.75, 330], disk: [0.5, 470] } }
  : { height: 380, at: { client: [0.09, 190], planner: [0.34, 75], executor: [0.34, 305], buffer: [0.62, 190], disk: [0.88, 75], wal: [0.88, 305] } });
const HEIGHTS = { wide: 380, narrow: 540 };
const LABEL = { find: "customer_id = 42", email: "lower(email) = …", insert: "INSERT" } as const;

const n = (v: number) => v.toLocaleString("en");

const counters = (s: DbState) => [
  ["queries", "Statements", s.stats.queries], ["examined", "Rows examined", s.stats.examined], ["diskReads", "Pages from disk", s.stats.diskReads],
  ["cacheHits", "Pages from memory", s.stats.cacheHits], ["fsyncs", "Log flushes", s.stats.fsyncs], ["lost", "Commits lost", s.stats.lost],
] as const;

const nodesFor = (frame: DbFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "planner") node.sub = s.index ? "Index on customer_id" : "No indexes";
    if (id === "executor" && s.runs.length) node.tag = s.runs[s.runs.length - 1]?.plan;
    if (id === "buffer") {
      node.sub = s.cached.includes("heap") ? "Whole table cached" : s.cached.length ? "A few pages cached" : "Empty";
      if (s.dirty) node.tag = `${s.dirty} dirty`;
      node.down = frame.type === "crashed";
    }
    if (id === "disk") node.tag = `${n(s.rows)} rows`;
    if (id === "wal") {
      node.sub = s.commit === "sync" ? "Flushed on commit" : "Flushed later";
      const waiting = s.wal.filter((w) => !w.flushed).length;
      if (waiting) node.tag = `${waiting} not on disk`;
    }
    return node;
  });
};

const Runs = ({ s }: { s: DbState }) => (
  <table className="keys mono">
    <thead><tr><th>#</th><th>statement</th><th>plan</th><th>pages read / hit</th><th>rows examined</th><th>ms</th></tr></thead>
    <tbody>
      {[...s.runs].reverse().map((r) => (
        <tr key={r.n}>
          <td>{r.n}</td><td>{LABEL[r.query]}</td><td>{r.plan}</td>
          <td>{r.plan === "Insert" ? "–" : `${n(r.read)} / ${n(r.hit)}`}</td><td>{r.plan === "Insert" ? "–" : n(r.examined)}</td><td>{r.ms || ""}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const DatabasesBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useDatabases();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<DbNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("scan"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as DbNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Run a statement</span>
          <button type="button" className="btn btn--solid btn--wide" id="q-find" onClick={() => act(ACTIONS.run("find"))}>Orders for customer 42</button>
          <button type="button" className="btn btn--wide" id="q-email" onClick={() => act(ACTIONS.run("email"))}>Orders by email</button>
          <button type="button" className="btn btn--wide" id="q-insert" onClick={() => act(ACTIONS.run("insert"))}>Insert an order</button>
        </div>
        <div className="control">
          <span className="label">Schema and settings</span>
          <button type="button" className="btn btn--wide" id="toggle-index" onClick={() => act(ACTIONS.index())}>{present.index ? "DROP INDEX" : "CREATE INDEX on customer_id"}</button>
          <Segmented<Commit> id="commit" label="synchronous_commit" value={present.commit} options={[["sync", "Commit waits"], ["async", "Commit returns early"]]} onChange={(commit) => act((st) => engine.configure(st, { commit }))} />
        </div>
        <div className="control">
          <span className="label">Server</span>
          <button type="button" className="btn btn--wide" id="crash" onClick={() => act(ACTIONS.crash())}>Pull the plug</button>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Statements, newest first</span></div>
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
      titleblock={["Sheet 12 · One statement, from SQL to disk", "One table, one optional index", "Costs per page illustrative"]}
    />
  );
};
