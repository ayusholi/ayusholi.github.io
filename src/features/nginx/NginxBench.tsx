"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useNginx } from "./NginxProvider";
import { describe, ROLES } from "./nginx-content";
import * as engine from "./nginx-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./nginx-scenarios";
import type { Buffering, Model, NginxFrame, NginxNodeId, NginxState, Req } from "./nginx-types";

const IDS: NginxNodeId[] = ["clients", "nginx", "disk", "app1", "app2", "app3"];
const EDGES: [NginxNodeId, NginxNodeId][] = [["clients", "nginx"], ["nginx", "disk"], ["nginx", "app1"], ["nginx", "app2"], ["nginx", "app3"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { clients: [0.25, 60], nginx: [0.25, 265], disk: [0.25, 470], app1: [0.75, 130], app2: [0.75, 265], app3: [0.75, 400] } }
  : { height: 380, at: { clients: [0.1, 190], nginx: [0.42, 190], disk: [0.42, 320], app1: [0.82, 70], app2: [0.82, 190], app3: [0.82, 310] } });
const HEIGHTS = { wide: 380, narrow: 540 };
const STATUS: Record<Req["status"], string> = { running: "…", "200": "200", "502": "502", timeout: "timeout" };

const counters = (s: NginxState) => [
  ["requests", "Requests", s.stats.requests], ["errors", "Errors to clients", s.stats.errors], ["retries", "Retried upstream", s.stats.retries],
  ["connections", "Open connections", s.stats.connections], ["memoryMb", "Memory, MB", s.stats.memoryMb], ["appBusyMs", "App time, ms", s.stats.appBusyMs],
] as const;

const nodesFor = (frame: NginxFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  const last = s.requests[s.requests.length - 1];
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "clients" && s.idle) node.tag = `${s.idle.toLocaleString("en")} idle`;
    if (id === "nginx") {
      node.sub = s.model === "event" ? "4 workers, event loop" : `${engine.THREADS} threads, one each`;
      if (s.stats.waiting) {
        node.tag = `${s.stats.waiting.toLocaleString("en")} waiting`;
        node.down = s.model === "threads";
      }
    }
    if (id === "app1" || id === "app2" || id === "app3") {
      const u = s.upstreams[id];
      node.sub = !u.up ? "Not running" : u.marked ? "Marked down" : ROLES[id].sub;
      node.down = !u.up;
      if (u.served) node.tag = `${u.served} served`;
      node.rested = !!last && last.status !== "running" && last.upstream !== id && !last.tried.includes(id);
    }
    if (id === "disk") node.rested = !!last && last.status !== "running" && last.kind !== "static";
    return node;
  });
};

const Requests = ({ s }: { s: NginxState }) => (
  <table className="keys mono">
    <thead><tr><th>#</th><th>request</th><th>served by</th><th>status</th><th>ms</th></tr></thead>
    <tbody>
      {[...s.requests].reverse().map((r) => (
        <tr key={r.n} className={r.status === "timeout" || r.status === "502" ? "is-ghost" : undefined}>
          <td>{r.n}</td><td>{r.kind === "slow" ? `${r.path} (slow)` : r.path}</td>
          <td>{r.kind === "static" ? "disk" : r.tried.length ? r.tried.map((t) => (t === r.upstream ? t : `${t}✕`)).join(" → ") : "–"}</td>
          <td>{STATUS[r.status]}</td><td>{r.status === "running" ? "" : r.ms.toLocaleString("en")}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const NginxBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useNginx();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<NginxNodeId | null>(null);
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
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as NginxNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Send a request</span>
          <button type="button" className="btn btn--solid btn--wide" id="req-page" onClick={() => act(ACTIONS.request("page"))}>GET /orders</button>
          <div className="control__row">
            <button type="button" className="btn" id="req-static" onClick={() => act(ACTIONS.request("static"))}>A static file</button>
            <button type="button" className="btn" id="req-slow" onClick={() => act(ACTIONS.request("slow"))}>A slow phone</button>
          </div>
          <button type="button" className="btn btn--wide" id="burst" onClick={() => act(ACTIONS.burst())}>Open {engine.BURST.toLocaleString("en")} idle connections</button>
        </div>
        <div className="control">
          <span className="label">Server</span>
          <Segmented<Model> id="model" label="Connection model" value={present.model} options={[["event", "Event loop"], ["threads", "Thread each"]]} onChange={(model) => act((st) => engine.configure(st, { model }))} />
          <Segmented<Buffering> id="buffering" label="proxy_buffering" value={present.buffering} options={[["on", "Buffering on"], ["off", "Buffering off"]]} onChange={(buffering) => act((st) => engine.configure(st, { buffering }))} />
        </div>
        <div className="control">
          <span className="label">App servers</span>
          <div className="control__row">
            {engine.UPSTREAMS.map((id) => (
              <button key={id} type="button" className="btn" id={`toggle-${id}`} aria-pressed={!present.upstreams[id].up} onClick={() => act(ACTIONS.toggle(id))}>{present.upstreams[id].up ? `Crash ${id}` : `Start ${id}`}</button>
            ))}
          </div>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Requests, newest first</span><span>✕ refused</span></div>
            <div id="requests"><Requests s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 11 · One proxy, many connections", "Requests run one at a time", "Memory and timings illustrative"]}
    />
  );
};
