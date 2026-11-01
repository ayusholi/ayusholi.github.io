"use client";

import { useCallback, useRef, useState } from "react";
import { Caption } from "@/components/simulation/Caption";
import { ComponentInspector } from "@/components/simulation/ComponentInspector";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { Segmented } from "@/components/ui/Segmented";
import { transportKeys, useFirstSight, usePauseWhenHidden, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { LatencyStrips } from "./LatencyStrips";
import { useRedis } from "./RedisProvider";
import { RedisSchematic } from "./RedisSchematic";
import { describe, ROLES } from "./redis-content";
import { isLive, ttlLeft } from "./redis-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./redis-scenarios";
import type { FailurePolicy, Invalidation, RedisNodeId, RedisState, RedisStats } from "./redis-types";

const COUNTERS: [keyof RedisStats, string][] = [["requests", "Requests"], ["hits", "Hits"], ["misses", "Misses"], ["dbQueries", "DB queries"], ["stale", "Stale reads"], ["failed", "Failed"]];

const Keyspace = ({ s }: { s: RedisState }) => {
  const keys = Object.entries(s.cache);
  if (!keys.length) return <p className="mono">{s.redisUp ? "(empty keyspace)" : "(unreachable)"}</p>;
  return (
    <table className="keys mono">
      <thead><tr><th>key</th><th>value</th><th>ttl</th></tr></thead>
      <tbody>
        {keys.map(([k, e]) => {
          const live = isLive(e, s.now);
          const left = ttlLeft(e, s.now), total = (e.expiresAt - e.storedAt) / 1000;
          const stale = live && e.value.version < (s.db[k]?.version ?? 0);
          return (
            <tr key={k + e.storedAt} className={live ? "" : "is-ghost"}>
              <td>{k}</td>
              <td>{JSON.stringify({ name: e.value.name, plan: e.value.plan })}{stale ? " ◐ stale" : ""}</td>
              <td>{live ? <>{left} s<span className="ttlbar" style={{ transform: `scaleX(${left / total})` }} /></> : "expired"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const Rows = ({ s }: { s: RedisState }) => (
  <table className="keys mono">
    <thead><tr><th>id</th><th>name</th><th>plan</th></tr></thead>
    <tbody>
      {Object.entries(s.db).map(([k, r]) => <tr key={k}><td>{k.split(":")[1]}</td><td>{r.name}</td><td>{r.plan}</td></tr>)}
    </tbody>
  </table>
);

export const RedisBench = () => {
  const { timeline, scenario, lesson, act, configure, runScenario, reset } = useRedis();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<RedisNodeId | null>(null);
  const bench = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(bench, timeline);
  useFirstSight(stage, useCallback(() => runScenario("miss"), [runScenario]), 0.35);

  const s = frame.state;
  const present = timeline.present;   // controls show the present, even while rewound
  const [title, text] = describe(frame);
  const step = timeline.cursor - timeline.traceStart + 1;
  const total = (timeline.frames.length - timeline.traceStart);

  return (
    <div className="bench sheet" id="bench" ref={bench} onKeyDown={transportKeys(timeline)}>
      <div className="tabs" id="tabs" role="group" aria-label="Scenarios">
        {(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => (
          <button key={id} type="button" className="tab" data-value={id} aria-pressed={scenario === id} onClick={() => runScenario(id)}>
            <span className="label">{sc.label}</span><b>{sc.title}</b>
          </button>
        ))}
      </div>
      <p className="lesson" id="lesson">{lesson}</p>

      <div className="bench-grid">
        <div className="bench-main">
          <div id="stage" ref={stage}>
            <RedisSchematic timeline={timeline} frame={frame} selected={selected} onSelect={setSelected} />
          </div>
          <ComponentInspector item={selected && ROLES[selected]} className="bench-inspect" />
          <Caption id="caption" title={title} text={text} step={step} />
          {/* Speaks at rest, not on every packet */}
          <p className="sr" id="status" role="status">{frame.type === "request.done" || !timeline.running ? `${title}. ${text}` : ""}</p>
          <div className="transport-bar">
            <SimulationControls timeline={timeline} label={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, total)}`} />
          </div>
        </div>

        <div className="controls" aria-label="Experiment">
          <div className="control">
            <span className="label">Send a request</span>
            <div className="control__row">
              <button type="button" className="btn btn--solid" id="get-42" onClick={() => act(ACTIONS.get("user:42"))}>GET user:42</button>
              <button type="button" className="btn" id="get-7" onClick={() => act(ACTIONS.get("user:7"))}>GET user:7</button>
            </div>
          </div>
          <div className="control">
            <span className="label">Time · <span id="clock">t = {(s.now / 1000).toFixed(s.now % 1000 ? 3 : 0)} s</span></span>
            <div className="control__row">
              <button type="button" className="btn" id="clock-10" onClick={() => act(ACTIONS.clock(10))}>+10 s</button>
              <button type="button" className="btn" id="clock-60" onClick={() => act(ACTIONS.clock(60))}>+60 s</button>
            </div>
            <label className="label" htmlFor="ttl">TTL for new entries · <span id="ttl-out">{present.ttl} s</span></label>
            <input className="range" type="range" id="ttl" min="10" max="300" step="10" value={present.ttl} onChange={(e) => configure({ ttl: Number(e.target.value) })} />
          </div>
          <div className="control">
            <span className="label">Source of truth</span>
            <button type="button" className="btn btn--wide" id="update" onClick={() => act(ACTIONS.update("user:42"))}>UPDATE user:42 plan</button>
            <span className="label">Invalidation</span>
            <Segmented<Invalidation> id="inval" label="Invalidation" value={present.invalidation} options={[["delete", "Delete on write"], ["none", "Skip"]]} onChange={(invalidation) => configure({ invalidation })} />
          </div>
          <div className="control">
            <span className="label">Failure</span>
            <button type="button" className="btn btn--wide" id="toggle-redis" onClick={() => act(ACTIONS.setUp(!present.redisUp))}>{present.redisUp ? "Stop Redis" : "Start Redis"}</button>
            <span className="label">If Redis is down</span>
            <Segmented<FailurePolicy> id="policy" label="If Redis is down" value={present.policy} options={[["fallback", "Bypass cache"], ["strict", "Fail request"]]} onChange={(policy) => configure({ policy })} />
          </div>
          <div className="control">
            <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset the bench</button>
          </div>
        </div>
      </div>

      <div className="readouts">
        <div className="readout">
          <div className="readout__h label"><span>Each request, to scale</span><span>0–200 ms</span></div>
          <LatencyStrips id="strips" state={s} limit={6} />
        </div>
        <div className="readout">
          <div className="readout__h label"><span>Counters</span></div>
          <div className="counters" id="counters">
            {COUNTERS.map(([k, name]) => (
              <div className="counter" data-c={k} key={k}><b key={s.stats[k]}>{s.stats[k]}</b><span className="label">{name}</span></div>
            ))}
          </div>
        </div>
      </div>
      <div className="readouts">
        <div className="readout">
          <div className="readout__h label"><span>Redis keyspace</span><span>in memory</span></div>
          <div id="keyspace"><Keyspace s={s} /></div>
        </div>
        <div className="readout">
          <div className="readout__h label"><span>PostgreSQL users</span><span>on disk</span></div>
          <div id="rows"><Rows s={s} /></div>
        </div>
      </div>

      <div className="titleblock label">
        <span><b>Sheet 01</b> · Cache-aside read path</span>
        <span>One app, one Redis, one Postgres</span>
        <span>Timings illustrative, not to scale of any system</span>
      </div>
    </div>
  );
};
