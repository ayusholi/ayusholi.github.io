"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useDocker } from "./DockerProvider";
import { describe, ROLES } from "./docker-content";
import * as engine from "./docker-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./docker-scenarios";
import type { DockerConfig, DockerFrame, DockerNodeId, DockerState, ImageTag, MemoryLimit, RestartPolicy } from "./docker-types";

const IDS: DockerNodeId[] = ["cli", "daemon", "registry", "store", "runtime", "kernel"];
const EDGES: [DockerNodeId, DockerNodeId][] = [["cli", "daemon"], ["daemon", "registry"], ["daemon", "store"], ["daemon", "runtime"], ["runtime", "kernel"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 580, at: { cli: [0.5, 50], daemon: [0.5, 170], registry: [0.25, 300], store: [0.75, 300], runtime: [0.5, 420], kernel: [0.5, 530] } }
  : { height: 360, at: { cli: [0.1, 180], daemon: [0.36, 180], registry: [0.62, 60], runtime: [0.62, 180], store: [0.62, 300], kernel: [0.88, 180] } });
const HEIGHTS = { wide: 360, narrow: 580 };
const COUNTERS: [keyof DockerState["stats"], string][] = [["downloadedMb", "MB downloaded"], ["reusedLayers", "Layers reused"], ["started", "Containers started"], ["oomKills", "OOM kills"]];

const Layers = ({ s }: { s: DockerState }) => (
  <table className="keys mono">
    <thead><tr><th>layer</th><th>made by</th><th>size</th><th>in</th></tr></thead>
    <tbody>
      {Object.values(engine.LAYERS).map((l) => {
        const here = s.local.includes(l.id);
        const tags = engine.TAGS.filter((t) => s.images[t].includes(l.id)).map((t) => t.split(":")[1]);
        return (
          <tr key={l.id} className={here ? "" : "is-ghost"}>
            <td>{l.id}</td><td>{l.step}</td><td>{l.mb} MB</td><td>{tags.join(" ")}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const Containers = ({ s }: { s: DockerState }) => {
  if (!s.containers.length) return <p className="mono">(no containers)</p>;
  return (
    <table className="keys mono">
      <thead><tr><th>id</th><th>image</th><th>state</th><th>sees in /app/data</th></tr></thead>
      <tbody>
        {s.containers.map((c) => {
          const files = engine.filesSeenBy(s, c);
          return (
            <tr key={c.id} className={c.status === "running" ? "" : "is-ghost"}>
              <td>{c.id}</td><td>{c.image}</td>
              <td>{c.status === "running" ? `up · pid 1 (host ${c.pid})` : `exited ${c.exitCode ?? 0}`}</td>
              <td>{files.length ? files.join(" ") : "(empty)"}{c.volume ? " ⛁" : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const nodesFor = (frame: DockerFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "store") {
      node.tag = `${s.local.length} layers · ${engine.localMb(s)} MB`;
      node.cells = Object.keys(engine.LAYERS).map((l) => (s.local.includes(l) ? "on" : "off"));
    }
    if (id === "kernel") node.tag = `${engine.running(s).length} running`;
    if (id === "registry") {
      // A run that finds everything on disk should visibly leave the registry out of it.
      node.rested = !s.registryUsed && frame.type !== "ready" && frame.type !== "config.changed";
      node.sub = node.rested ? "Not contacted" : role.sub;
    }
    return node;
  });
};

export const DockerBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useDocker();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<DockerNodeId | null>(null);
  const present = timeline.present;
  const configure = (patch: DockerConfig) => act((s) => engine.configure(s, patch));
  const hasRunning = engine.running(present).length > 0;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("cold"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as DockerNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={frame.type === "run.done" || !timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Image</span>
          <Segmented<ImageTag> id="image" label="Image" value={present.image} options={engine.TAGS.map((t) => [t, t.split(":")[1] as string] as const)} onChange={(image) => configure({ image })} />
          <button type="button" className="btn btn--solid btn--wide" id="run" onClick={() => act(ACTIONS.run())}>docker run {present.image}</button>
        </div>
        <div className="control">
          <span className="label">Inside the newest container</span>
          <div className="control__row">
            <button type="button" className="btn" id="write" disabled={!hasRunning} onClick={() => act(ACTIONS.write())}>Write a file</button>
            <button type="button" className="btn" id="spike" disabled={!hasRunning} onClick={() => act(ACTIONS.spike())}>Use {engine.ALLOCATE_MB} MB</button>
          </div>
          <button type="button" className="btn btn--wide" id="rm" disabled={!present.containers.length} onClick={() => act(ACTIONS.remove())}>docker rm -f</button>
        </div>
        <div className="control">
          <span className="label">For new containers</span>
          <Segmented<`${MemoryLimit}`> id="mem" label="Memory limit" value={`${present.memoryLimit}`} options={[["128", "128 MB"], ["512", "512 MB"]]} onChange={(v) => configure({ memoryLimit: Number(v) as MemoryLimit })} />
          <Segmented id="volume" label="Volume" value={present.useVolume ? "on" : "off"} options={[["off", "No volume"], ["on", "Volume"]]} onChange={(v) => configure({ useVolume: v === "on" })} />
          <Segmented<RestartPolicy> id="restart" label="Restart policy" value={present.restart} options={[["no", "Restart: no"], ["always", "always"]]} onChange={(restart) => configure({ restart })} />
        </div>
        <div className="control">
          <div className="control__row">
            <button type="button" className="btn" id="prune" onClick={() => act(ACTIONS.prune())}>Prune images</button>
            <button type="button" className="btn" id="reset" onClick={reset}>Reset</button>
          </div>
        </div>
      </>}
      readouts={<>
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Layers</span><span>struck through = not on this machine</span></div>
            <div id="layers"><Layers s={frame.state} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {COUNTERS.map(([k, name]) => <div className="counter" data-c={k} key={k}><b key={frame.state.stats[k]}>{frame.state.stats[k]}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
        <div className="readouts grid-cols-1!">
          <div className="readout">
            <div className="readout__h label"><span>Containers</span><span>⛁ = named volume mounted</span></div>
            <div id="containers"><Containers s={frame.state} /></div>
          </div>
        </div>
      </>}
      titleblock={["Sheet 03 · docker run, from command to process", "One host, one registry", "Timings illustrative"]}
    />
  );
};
